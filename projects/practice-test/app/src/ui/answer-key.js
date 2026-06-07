import {
  ensureDefaultTest,
  AMT_RPT_MOCK_EXAM_ID,
  getQuestionsByTestId,
  getTest,
  bulkSaveQuestions,
} from '../db.js';
import { sortQuestionsByNumber, escapeHtml } from './helpers.js';
import { guardClick } from './click-guard.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const COLS = 4;
const ROWS_PER_COL = 25;
const QUESTIONS_PER_PAGE = COLS * ROWS_PER_COL;

function renderChoiceRow(question) {
  const num = question.number ?? '?';
  const choices = LETTERS.map((letter, idx) => {
    const selected = question.correctIndex === idx;
    return `
      <button
        type="button"
        class="answer-key-choice ${selected ? 'is-selected' : ''}"
        data-id="${escapeHtml(question.id)}"
        data-index="${idx}"
        aria-label="Question ${num} answer ${letter}"
        aria-pressed="${selected ? 'true' : 'false'}"
      >${letter}</button>
    `;
  }).join('');

  return `
    <div class="answer-key-row" data-question-id="${escapeHtml(question.id)}">
      <span class="answer-key-num">${escapeHtml(String(num))}</span>
      <div class="answer-key-choices" role="group" aria-label="Question ${escapeHtml(String(num))}">${choices}</div>
    </div>
  `;
}

function renderColumn(questions) {
  const rows = questions.map(renderChoiceRow).join('');
  return `<div class="answer-key-column">${rows}</div>`;
}

export async function renderAnswerKey(container, params = {}) {
  await ensureDefaultTest();
  const test = await getTest(AMT_RPT_MOCK_EXAM_ID);

  if (!test) {
    container.innerHTML = `
      <section class="page answer-key-page-wrap">
        <div class="empty-state">
          <h2>AMT RPT Mock Exam not found</h2>
          <p>Load the bundled exam first, then return here.</p>
          <a href="#home" class="btn btn-primary">Go Home</a>
        </div>
      </section>
    `;
    return;
  }

  const baseline = sortQuestionsByNumber(await getQuestionsByTestId(AMT_RPT_MOCK_EXAM_ID));
  if (baseline.length === 0) {
    container.innerHTML = `
      <section class="page answer-key-page-wrap">
        <div class="empty-state">
          <h2>No questions in this exam</h2>
          <a href="#home" class="btn btn-primary">Go Home</a>
        </div>
      </section>
    `;
    return;
  }

  let draft = baseline.map((q) => ({ ...q }));
  let dirty = false;
  let page = Math.max(0, parseInt(params.page, 10) || 0);
  const totalPages = Math.ceil(draft.length / QUESTIONS_PER_PAGE);
  if (page >= totalPages) page = totalPages - 1;

  function countChanges() {
    return draft.filter((q) => {
      const orig = baseline.find((b) => b.id === q.id);
      return orig && orig.correctIndex !== q.correctIndex;
    }).length;
  }

  function updateHashPage() {
    const next = `#answer-key?page=${page}`;
    if (window.location.hash !== next) {
      history.replaceState(null, '', next);
    }
  }

  function beforeUnload(e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  }

  function paint() {
    const start = page * QUESTIONS_PER_PAGE;
    const end = Math.min(start + QUESTIONS_PER_PAGE, draft.length);
    const pageQuestions = draft.slice(start, end);
    const columns = Array.from({ length: COLS }, () => []);

    pageQuestions.forEach((q, i) => {
      const col = Math.floor(i / ROWS_PER_COL);
      if (col < COLS) columns[col].push(q);
    });

    const changeCount = countChanges();

    container.innerHTML = `
      <section class="page answer-key-page-wrap">
        <header class="page-header answer-key-header">
          <p class="breadcrumb">${escapeHtml(test.name)} › Answer Key</p>
          <h1>AMT RPT Answer Key</h1>
          <p class="answer-key-desc">
            ${draft.length} questions · tap A–D to set the correct answer · ${COLS} columns × ${ROWS_PER_COL} rows per page
          </p>
        </header>

        <div class="answer-key-toolbar no-print">
          <div class="answer-key-toolbar-left">
            <button type="button" class="btn btn-secondary btn-small" id="answer-key-prev" ${page === 0 ? 'disabled' : ''}>Previous page</button>
            <span class="answer-key-page-label">
              Page <strong>${page + 1}</strong> of <strong>${totalPages}</strong>
              <span class="answer-key-range">(Q${start + 1}–${end})</span>
            </span>
            <button type="button" class="btn btn-secondary btn-small" id="answer-key-next" ${page >= totalPages - 1 ? 'disabled' : ''}>Next page</button>
          </div>
          <div class="answer-key-toolbar-right">
            <span class="answer-key-status ${dirty ? 'is-dirty' : ''}" id="answer-key-status" aria-live="polite">
              ${dirty ? `${changeCount} unsaved change${changeCount === 1 ? '' : 's'}` : 'All changes saved'}
            </span>
            <button type="button" class="btn btn-primary" id="answer-key-save" ${dirty ? '' : 'disabled'}>Save answers</button>
            <button type="button" class="btn btn-secondary btn-small" id="answer-key-print">Print page</button>
          </div>
        </div>

        <div class="answer-key-grid">
          ${columns.map((col) => renderColumn(col)).join('')}
        </div>

        <p class="answer-key-footnote no-print">
          Changes update grading for practice sessions and mock exams. Use <a href="#questions">My Questions</a> to edit full question text.
        </p>
      </section>
    `;

    container.querySelector('#answer-key-prev')?.addEventListener('click', () => {
      if (page <= 0) return;
      if (dirty && !confirm('You have unsaved changes. Go to the previous page anyway?')) return;
      page--;
      updateHashPage();
      paint();
    });

    container.querySelector('#answer-key-next')?.addEventListener('click', () => {
      if (page >= totalPages - 1) return;
      if (dirty && !confirm('You have unsaved changes. Go to the next page anyway?')) return;
      page++;
      updateHashPage();
      paint();
    });

    container.querySelectorAll('.answer-key-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const index = parseInt(btn.dataset.index, 10);
        const q = draft.find((item) => item.id === id);
        if (!q || q.correctIndex === index) return;
        q.correctIndex = index;
        dirty = countChanges() > 0;
        paint();
      });
    });

    const saveBtn = container.querySelector('#answer-key-save');
    if (saveBtn) {
      guardClick(saveBtn, async () => {
        const changed = draft.filter((q) => {
          const orig = baseline.find((b) => b.id === q.id);
          return orig && orig.correctIndex !== q.correctIndex;
        });
        if (changed.length === 0) {
          dirty = false;
          paint();
          return;
        }
        await bulkSaveQuestions(changed);
        for (const q of changed) {
          const b = baseline.find((item) => item.id === q.id);
          if (b) b.correctIndex = q.correctIndex;
        }
        dirty = false;
        paint();
        const status = container.querySelector('#answer-key-status');
        if (status) {
          status.textContent = `Saved ${changed.length} answer${changed.length === 1 ? '' : 's'}`;
          status.classList.remove('is-dirty');
        }
      });
    }

    container.querySelector('#answer-key-print')?.addEventListener('click', () => window.print());
  }

  window.addEventListener('beforeunload', beforeUnload);
  const cleanup = () => window.removeEventListener('beforeunload', beforeUnload);
  container._answerKeyCleanup = cleanup;

  updateHashPage();
  paint();
}
