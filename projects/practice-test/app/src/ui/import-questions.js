import {
  bulkSaveQuestions,
  createQuestionId,
  ensureDefaultTest,
  updateTestCategories,
  getAllQuestions,
} from '../db.js';
import { getActiveTestId } from '../context.js';
import { parseImportFileText, revalidateDraft } from '../import/parse-import.js';
import { flagExistingDuplicates } from '../question-meta.js';
import {
  escapeHtml,
  questionNumberHtml,
  sortQuestionsByNumber,
  normalizeQuestionNumber,
  compareQuestionNumbers,
} from './helpers.js';
import { armGhostClickGuard } from './navigation-guard.js';

const LETTERS = ['A', 'B', 'C', 'D'];

export async function renderImportQuestions(container) {
  await ensureDefaultTest();
  const testId = getActiveTestId();
  const existingQuestions = await getAllQuestions(testId);
  let drafts = [];
  let filter = 'all';
  let expandedId = null;

  function flagDraftDuplicateNumbers() {
    const dupMsg = (n) => `Duplicate question number #${n}`;
    drafts.forEach((d) => {
      d.issues = d.issues.filter((i) => !i.startsWith('Duplicate question number'));
    });
    const seen = new Map();
    for (const draft of sortQuestionsByNumber(drafts.map((d) => ({ ...d, id: d._importId })))) {
      const d = drafts.find((x) => x._importId === draft.id);
      const n = normalizeQuestionNumber(d.number);
      if (n === null) continue;
      const key = String(n);
      if (seen.has(key)) {
        d.issues.push(dupMsg(key));
      } else {
        seen.set(key, true);
      }
    }
  }

  function render() {
    const issueCount = drafts.filter((d) => d.issues.length > 0).length;
    const selectedCount = drafts.filter((d) => d.included && d.issues.length === 0).length;

    container.innerHTML = `
      <section class="page import-page">
        <header class="page-header">
          <p class="breadcrumb">Add Questions › Import</p>
          <h1>Import Questions</h1>
          <p class="subtitle">Upload a JSON file, review each question, then import into your current test.</p>
        </header>

        <div class="import-upload-panel">
          <label class="import-file-label">
            <span class="btn btn-secondary">Choose JSON file</span>
            <input type="file" id="import-json-file" accept=".json,application/json" class="import-file-input" />
          </label>
          <a href="#add" class="btn btn-secondary">Type manually instead</a>
        </div>

        <details class="import-format-help">
          <summary>JSON format (for AI or scripts)</summary>
          <pre class="import-format-sample">[
  {
    "number": 1,
    "question": "What is the capital of France?",
    "options": ["London", "Paris", "Berlin", "Madrid"],
    "correctIndex": 1,
    "category": "Geography",
    "explanation": "Paris is the capital and largest city of France."
  },
  {
    "number": 2,
    "question": "Another question...",
    "options": ["A text", "B text", "C text", "D text"],
    "correctAnswer": "B",
    "category": "Procedure"
  }
]</pre>
          <p class="import-format-note">
            Required: <code>question</code>, four <code>options</code> (or <code>choices</code>/<code>answers</code>), and
            <code>correctIndex</code> (0–3) or <code>correctAnswer</code> ("A"–"D" or matching option text).
            Optional: <code>number</code>, <code>category</code>, <code>explanation</code>.
            Also accepts <code>{ "questions": [ ... ] }</code> or a top-level array.
            Set <code>needs_review": true</code> to flag uncertain items during import.
          </p>
        </details>

        ${
          drafts.length > 0
            ? `
          <div class="import-summary">
            <p><strong>${drafts.length}</strong> questions loaded · <strong>${issueCount}</strong> need attention · <strong>${selectedCount}</strong> ready to import</p>
            <div class="import-summary-actions">
              <select id="import-filter" class="category-filter-select">
                <option value="all" ${filter === 'all' ? 'selected' : ''}>Show all</option>
                <option value="issues" ${filter === 'issues' ? 'selected' : ''}>Needs attention only</option>
              </select>
              <button type="button" class="btn btn-small btn-secondary" id="select-all-btn">Select all valid</button>
              <button type="button" class="btn btn-small btn-secondary" id="deselect-issues-btn">Skip flagged</button>
            </div>
          </div>

          <div id="import-review-list" class="import-review-list"></div>

          <div class="import-footer-actions">
            <button type="button" class="btn btn-primary btn-large" id="confirm-import-btn" ${selectedCount === 0 ? 'disabled' : ''}>
              Import ${selectedCount} question${selectedCount === 1 ? '' : 's'}
            </button>
            <button type="button" class="btn btn-secondary" id="clear-import-btn">Clear &amp; choose another file</button>
          </div>
        `
            : ''
        }
      </section>
    `;

    bindHandlers();
    armGhostClickGuard();

    if (drafts.length > 0) {
      renderReviewList();
    }
  }

  function filteredDrafts() {
    const list = filter === 'issues' ? drafts.filter((d) => d.issues.length > 0) : [...drafts];
    return list.sort((a, b) => {
      const cmp = compareQuestionNumbers(a, b);
      if (cmp !== 0) return cmp;
      return a._importId.localeCompare(b._importId);
    });
  }

  function renderReviewList() {
    const list = container.querySelector('#import-review-list');
    if (!list) return;

    const shown = filteredDrafts();
    if (shown.length === 0) {
      list.innerHTML = '<p class="empty-msg">No questions match this filter.</p>';
      return;
    }

    list.innerHTML = shown.map((d) => renderDraftCard(d)).join('');
    bindReviewListHandlers();
    updateImportButton();
  }

  function renderDraftCard(d) {
    const isOpen = expandedId === d._importId;
    const hasIssues = d.issues.length > 0;
    const correct = LETTERS[d.correctIndex] ?? '?';

    return `
      <article class="import-draft-card ${hasIssues ? 'has-issues' : ''} ${!d.included ? 'excluded' : ''}" data-id="${d._importId}">
        <div class="import-draft-header">
          <label class="import-include">
            <input type="checkbox" class="include-check" data-id="${d._importId}" ${d.included ? 'checked' : ''} ${hasIssues ? '' : ''} />
            Include
          </label>
          ${questionNumberHtml(d.number)}
          <span class="import-draft-preview">${escapeHtml(d.question || '(empty question)')}</span>
          ${hasIssues ? `<span class="import-issue-badge">${d.issues.length} issue${d.issues.length === 1 ? '' : 's'}</span>` : '<span class="import-ok-badge">OK</span>'}
          <button type="button" class="btn btn-small btn-secondary toggle-edit" data-id="${d._importId}">${isOpen ? 'Collapse' : 'Edit'}</button>
        </div>
        ${hasIssues ? `<ul class="import-issues-list">${d.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''}
        <p class="import-draft-answer">Correct: <strong>${correct}</strong> — ${escapeHtml(d.options[d.correctIndex] || '')}</p>
        ${
          isOpen
            ? `
          <div class="import-draft-edit">
            <label>Question # <input type="number" class="edit-number" min="1" step="1" value="${d.number != null ? escapeHtml(String(d.number)) : ''}" /></label>
            <label>Category <input type="text" class="edit-category" value="${escapeHtml(d.category)}" /></label>
            <label>Question <textarea class="edit-question" rows="3">${escapeHtml(d.question)}</textarea></label>
            ${LETTERS.map(
              (letter, i) => `
              <label>${letter} <textarea class="edit-option" data-opt="${i}" rows="2">${escapeHtml(d.options[i] || '')}</textarea></label>
            `
            ).join('')}
            <label>Correct answer
              <select class="edit-correct">
                ${LETTERS.map((letter, i) => `<option value="${i}" ${d.correctIndex === i ? 'selected' : ''}>${letter}</option>`).join('')}
              </select>
            </label>
            <button type="button" class="btn btn-small btn-primary save-draft-btn" data-id="${d._importId}">Save edits</button>
          </div>
        `
            : ''
        }
      </article>
    `;
  }

  function bindReviewListHandlers() {
    const list = container.querySelector('#import-review-list');
    if (!list) return;

    list.querySelectorAll('.include-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        const d = drafts.find((x) => x._importId === cb.dataset.id);
        if (d) d.included = cb.checked;
        renderReviewList();
      });
    });

    list.querySelectorAll('.toggle-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        expandedId = expandedId === btn.dataset.id ? null : btn.dataset.id;
        renderReviewList();
      });
    });

    list.querySelectorAll('.save-draft-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.import-draft-card');
        const d = drafts.find((x) => x._importId === btn.dataset.id);
        if (!d || !card) return;

        d.number = normalizeQuestionNumber(card.querySelector('.edit-number').value);
        d.category = card.querySelector('.edit-category').value.trim();
        d.question = card.querySelector('.edit-question').value.trim();
        d.options = [0, 1, 2, 3].map((i) => card.querySelector(`.edit-option[data-opt="${i}"]`).value.trim());
        d.correctIndex = parseInt(card.querySelector('.edit-correct').value, 10);
        revalidateDraft(d);
        flagDraftDuplicateNumbers();
        expandedId = d._importId;
        render();
      });
    });
  }

  function updateImportButton() {
    const btn = container.querySelector('#confirm-import-btn');
    if (!btn) return;
    const count = drafts.filter((d) => d.included && d.issues.length === 0).length;
    btn.disabled = count === 0;
    btn.textContent = `Import ${count} question${count === 1 ? '' : 's'}`;
  }

  function bindHandlers() {
    container.querySelector('#import-json-file')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        drafts = parseImportFileText(text);
        flagExistingDuplicates(drafts, existingQuestions);
        expandedId = null;
        filter = 'all';
        render();
      } catch (err) {
        alert(`Could not read file: ${err.message}`);
        e.target.value = '';
      }
    });

    container.querySelector('#import-filter')?.addEventListener('change', (e) => {
      filter = e.target.value;
      renderReviewList();
    });

    container.querySelector('#select-all-btn')?.addEventListener('click', () => {
      drafts.forEach((d) => {
        if (d.issues.length === 0) d.included = true;
      });
      render();
    });

    container.querySelector('#deselect-issues-btn')?.addEventListener('click', () => {
      drafts.forEach((d) => {
        if (d.issues.length > 0) d.included = false;
      });
      render();
    });

    container.querySelector('#confirm-import-btn')?.addEventListener('click', async () => {
      const toImport = drafts.filter((d) => d.included && d.issues.length === 0);
      if (toImport.length === 0) return;
      if (!confirm(`Import ${toImport.length} question${toImport.length === 1 ? '' : 's'} into your current test?`)) return;

      const questions = toImport.map((d) => ({
        id: createQuestionId(),
        testId,
        number: d.number,
        question: d.question,
        options: d.options,
        correctIndex: d.correctIndex,
        category: d.category,
        explanation: d.explanation || '',
      }));

      await bulkSaveQuestions(questions);
      if (testId) await updateTestCategories(testId);
      window.location.hash = '#questions';
    });

    container.querySelector('#clear-import-btn')?.addEventListener('click', () => {
      drafts = [];
      expandedId = null;
      const input = container.querySelector('#import-json-file');
      if (input) input.value = '';
      render();
    });
  }

  render();
}
