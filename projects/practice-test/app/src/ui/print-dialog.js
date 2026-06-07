import { escapeHtml } from './helpers.js';

/**
 * @param {{ title: string, options: { id: string, label: string, description?: string }[] }} config
 * @returns {Promise<string|null>} chosen option id, or null if cancelled
 */
export function showPrintOptionsDialog({ title, options }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'print-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'print-dialog-title');

    const defaultId = options[0]?.id ?? '';

    const optionsHtml = options
      .map(
        (opt, i) => `
        <label class="print-dialog-option">
          <input type="radio" name="print-dialog-choice" value="${escapeHtml(opt.id)}" ${i === 0 ? 'checked' : ''} />
          <span class="print-dialog-option-body">
            <span class="print-dialog-option-label">${escapeHtml(opt.label)}</span>
            ${opt.description ? `<span class="print-dialog-option-desc">${escapeHtml(opt.description)}</span>` : ''}
          </span>
        </label>
      `
      )
      .join('');

    overlay.innerHTML = `
      <div class="print-dialog">
        <h2 class="print-dialog-title" id="print-dialog-title">${escapeHtml(title)}</h2>
        <fieldset class="print-dialog-fieldset">
          <legend class="visually-hidden">${escapeHtml(title)}</legend>
          ${optionsHtml}
        </fieldset>
        <div class="print-dialog-actions">
          <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
          <button type="button" class="btn btn-primary" data-action="confirm">Print</button>
        </div>
      </div>
    `;

    function close(result) {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') close(null);
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'cancel') close(null);
      if (action === 'confirm') {
        const picked = overlay.querySelector('input[name="print-dialog-choice"]:checked');
        close(picked?.value ?? defaultId);
      }
    });

    document.addEventListener('keydown', onKeydown);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-action="confirm"]')?.focus();
  });
}
