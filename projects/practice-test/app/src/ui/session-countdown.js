const COUNTDOWN_SEQUENCE = ['3', '2', '1', 'Go!'];

function blockPointerEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Fun 3-2-1-Go overlay before the first question — blocks clicks until finished.
 * @param {HTMLElement} mountEl
 * @returns {Promise<void>}
 */
export function runSessionCountdown(mountEl) {
  return new Promise((resolve) => {
    const host = mountEl || document.body;
    host.classList.add('is-countdown-active');

    const overlay = document.createElement('div');
    overlay.className = 'session-countdown-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.setAttribute('aria-label', 'Session starting countdown');
    overlay.innerHTML = '<span class="session-countdown-num">3</span>';

    for (const type of ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'contextmenu']) {
      overlay.addEventListener(type, blockPointerEvent);
    }

    host.appendChild(overlay);

    const numEl = overlay.querySelector('.session-countdown-num');
    let step = 0;

    const finish = () => {
      host.classList.remove('is-countdown-active');
      overlay.remove();
      resolve();
    };

    const tick = () => {
      if (step >= COUNTDOWN_SEQUENCE.length) {
        overlay.classList.add('session-countdown-done');
        setTimeout(finish, 320);
        return;
      }

      numEl.textContent = COUNTDOWN_SEQUENCE[step];
      numEl.classList.remove('session-countdown-pop');
      void numEl.offsetWidth;
      numEl.classList.add('session-countdown-pop');

      const delay = step === COUNTDOWN_SEQUENCE.length - 1 ? 550 : 750;
      step++;
      setTimeout(tick, delay);
    };

    tick();
  });
}
