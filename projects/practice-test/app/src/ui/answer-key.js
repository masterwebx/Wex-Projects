import {
  ensureDefaultTest,
  AMT_RPT_MOCK_EXAM_ID,
  getQuestionsByTestId,
  getTest,
  bulkSaveQuestions,
} from '../db.js';
import { getActiveTestId } from '../context.js';
import amtRptMockExamData from '../data/amt-rpt-mock-exam.json';
import { extractQuestionArray } from '../import/parse-import.js';
import { sortQuestionsByNumber, escapeHtml } from './helpers.js';
import { guardClick } from './click-guard.js';
import { LETTERS, letterAt, pageQuestionRange, splitIntoColumns } from './print-sheet.js';

const COLS_EDIT = 4;
const ROWS_PER_COL_EDIT = 25;
const QUESTIONS_PER_PAGE = COLS_EDIT * ROWS_PER_COL_EDIT;

const bundledCorrectByNumber = (() => {
  const map = new Map();
  for (const raw of extractQuestionArray(amtRptMockExamData)) {
    const n = Number(raw.number);
    if (Number.isFinite(n)) map.set(n, raw.correctIndex);
  }
  return map;
})();

function needsExplanationStorageKey(testId) {
  return `answerKeyNeedsExplanation:${testId}`;
}

function loadNeedsExplanationIds(testId) {
  try {
    const raw = localStorage.getItem(needsExplanationStorageKey(testId));
    if (!raw) return new Set();
    const ids = JSON.parse(raw);
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function saveNeedsExplanationIds(testId, ids) {
  try {
    localStorage.setItem(needsExplanationStorageKey(testId), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function buildChangesVsBundle(questions, testId) {
  if (testId !== AMT_RPT_MOCK_EXAM_ID) return [];
  return questions
    .filter((q) => {
      const bundled = bundledCorrectByNumber.get(Number(q.number));
      return bundled !== undefined && bundled !== q.correctIndex;
    })
    .map((q) => {
      const oldIndex = bundledCorrectByNumber.get(Number(q.number));
      return {
        number: q.number,
        fromIndex: oldIndex,
        toIndex: q.correctIndex,
        fromLetter: letterAt(oldIndex),
        toLetter: letterAt(q.correctIndex),
        fromText: q.options[oldIndex] ?? '',
        toText: q.options[q.correctIndex] ?? '',
        question: q.question,
        explanation: q.explanation ?? '',
        category: q.category ?? '',
      };
    })
    .sort((a, b) => Number(a.number) - Number(b.number));
}

function formatChangesForReview(changes, testName) {
  if (changes.length === 0) return 'No answer changes compared to the bundled exam file.';

  const lines = [
    `${testName} Answer Key Changes (${changes.length} question${changes.length === 1 ? '' : 's'})`,
    '',
  ];

  for (const c of changes) {
    lines.push(
      `Q${c.number}: ${c.fromLetter} → ${c.toLetter}`,
      `Question: ${c.question}`,
      `Old answer (${c.fromLetter}): ${c.fromText}`,
      `New answer (${c.toLetter}): ${c.toText}`,
      `Category: ${c.category || '(none)'}`,
      `Current explanation: ${c.explanation || '(none — needs writing)'}`,
      ''
    );
  }

  return lines.join('\n').trim();
}

function renderBundleChangesPanel(changes) {
  if (changes.length === 0) return '';

  const items = changes
    .map(
      (c) => `
      <li class="answer-key-change-item">
        <strong>Q${escapeHtml(String(c.number))}</strong>
        <span class="answer-key-change-arrow">${escapeHtml(c.fromLetter)} → ${escapeHtml(c.toLetter)}</span>
        <span class="answer-key-change-preview">${escapeHtml(c.toText.slice(0, 60))}${c.toText.length > 60 ? '…' : ''}</span>
      </li>
    `
    )
    .join('');

  return `
    <details class="answer-key-changes-panel no-print">
      <summary>${changes.length} answer${changes.length === 1 ? '' : 's'} differ from bundled exam (share to update source file)</summary>
      <ul class="answer-key-change-list">${items}</ul>
    </details>
  `;
}

function renderNeedsExplanationPanel(questions, needsIds) {
  const pending = questions
    .filter((q) => needsIds.has(q.id))
    .sort((a, b) => Number(a.number) - Number(b.number));

  if (pending.length === 0) {
    return '<p class="answer-key-needs-empty no-print">No questions waiting for new explanations.</p>';
  }

  const items = pending
    .map((q) => {
      const letter = letterAt(q.correctIndex);
      const answerText = q.options[q.correctIndex] ?? '';
      return `
        <li class="answer-key-needs-item">
          <strong>Q${escapeHtml(String(q.number))}</strong>
          <span class="answer-key-needs-answer">Correct: ${escapeHtml(letter)} — ${escapeHtml(answerText.slice(0, 80))}${answerText.length > 80 ? '…' : ''}</span>
        </li>
      `;
    })
    .join('');

  return `
    <div class="answer-key-needs-panel no-print" role="status">
      <h3 class="answer-key-needs-title">Needs new explanation (${pending.length})</h3>
      <p class="answer-key-needs-desc">These questions had answer changes saved. Write or paste updated explanations in <a href="#questions">My Questions</a>.</p>
      <ul class="answer-key-needs-list">${items}</ul>
    </div>
  `;
}

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
  params = params ?? {};
  await ensureDefaultTest();

  const testId = getActiveTestId();
  const test = testId ? await getTest(testId) : null;

  if (!test) {
    container.innerHTML = `
      <section class="page answer-key-page-wrap">
        <div class="empty-state">
          <h2>No test selected</h2>
          <p>Choose a test from the header, then return here.</p>
          <a href="#home" class="btn btn-primary">Go Home</a>
        </div>
      </section>
    `;
    return;
  }

  const baseline = sortQuestionsByNumber(await getQuestionsByTestId(testId));
  if (baseline.length === 0) {
    container.innerHTML = `
      <section class="page answer-key-page-wrap">
        <div class="empty-state">
          <h2>No questions in this test</h2>
          <a href="#home" class="btn btn-primary">Go Home</a>
        </div>
      </section>
    `;
    return;
  }

  let draft = baseline.map((q) => ({ ...q }));
  let dirty = false;
  let saveBannerVisible = false;
  let saveBannerMessage = '';
  let needsExplanationIds = loadNeedsExplanationIds(testId);
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

  function updateRowSelection(questionId, selectedIndex) {
    const row = container.querySelector(`[data-question-id="${CSS.escape(questionId)}"]`);
    if (!row) return;
    row.querySelectorAll('.answer-key-choice').forEach((btn) => {
      const idx = parseInt(btn.dataset.index, 10);
      const selected = idx === selectedIndex;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function updateChrome(statusMessage = null) {
    const changeCount = countChanges();
    const bundleChanges = buildChangesVsBundle(draft, testId);
    const range = pageQuestionRange(draft, page, QUESTIONS_PER_PAGE);

    const status = container.querySelector('#answer-key-status');
    if (status) {
      status.textContent =
        statusMessage ??
        (dirty ? `${changeCount} unsaved change${changeCount === 1 ? '' : 's'}` : 'All changes saved');
      status.classList.toggle('is-dirty', dirty && !statusMessage);
      status.classList.toggle('is-saved', !dirty && !statusMessage);
    }

    const banner = container.querySelector('#answer-key-save-banner');
    const bannerText = container.querySelector('.answer-key-save-banner-text');
    if (banner) banner.classList.toggle('is-visible', saveBannerVisible);
    if (bannerText && saveBannerVisible) bannerText.textContent = saveBannerMessage;

    const saveBtn = container.querySelector('#answer-key-save');
    if (saveBtn) {
      saveBtn.disabled = !dirty;
      saveBtn.dataset.busy = '0';
    }

    const copyBtn = container.querySelector('#answer-key-copy-changes');
    const downloadBtn = container.querySelector('#answer-key-download-changes');
    if (copyBtn) copyBtn.disabled = bundleChanges.length === 0;
    if (downloadBtn) downloadBtn.disabled = bundleChanges.length === 0;

    const pageLabel = container.querySelector('#answer-key-page-label');
    if (pageLabel) {
      pageLabel.innerHTML = `
        Page <strong>${page + 1}</strong> of <strong>${totalPages}</strong>
        <span class="answer-key-range">(${escapeHtml(range.label)})</span>
      `;
    }

    const prevBtn = container.querySelector('#answer-key-prev');
    const nextBtn = container.querySelector('#answer-key-next');
    if (prevBtn) prevBtn.disabled = page === 0;
    if (nextBtn) nextBtn.disabled = page >= totalPages - 1;

    const changesHost = container.querySelector('#answer-key-changes-host');
    if (changesHost) {
      const bundlePanel =
        testId === AMT_RPT_MOCK_EXAM_ID
          ? bundleChanges.length > 0
            ? renderBundleChangesPanel(bundleChanges)
            : '<p class="answer-key-changes-empty">No differences from bundled exam.</p>'
          : '';
      changesHost.innerHTML = renderNeedsExplanationPanel(draft, needsExplanationIds) + bundlePanel;
    }
  }

  function renderGrid() {
    const grid = container.querySelector('#answer-key-grid');
    if (!grid) return;

    const start = page * QUESTIONS_PER_PAGE;
    const pageQuestions = draft.slice(start, start + QUESTIONS_PER_PAGE);
    const columns = splitIntoColumns(pageQuestions, COLS_EDIT, ROWS_PER_COL_EDIT);

    grid.innerHTML = columns.map((col) => renderColumn(col)).join('');
  }

  function handleAnswerPick(btn) {
    const id = btn.dataset.id;
    const index = parseInt(btn.dataset.index, 10);
    const q = draft.find((item) => item.id === id);
    if (!q || q.correctIndex === index) return;
    q.correctIndex = index;
    dirty = countChanges() > 0;
    saveBannerVisible = false;
    updateRowSelection(id, index);
    updateChrome();
  }

  function bindEvents() {
    const root = container.querySelector('.answer-key-page-wrap');
    if (!root || root._answerKeyBound) return;
    root._answerKeyBound = true;

    root.addEventListener('click', (e) => {
      const choice = e.target.closest('.answer-key-choice');
      if (choice) {
        e.preventDefault();
        handleAnswerPick(choice);
        return;
      }

      if (e.target.closest('#answer-key-prev')) {
        if (page <= 0) return;
        if (dirty && !confirm('You have unsaved changes. Go to the previous page anyway?')) return;
        page--;
        updateHashPage();
        renderGrid();
        updateChrome();
        return;
      }

      if (e.target.closest('#answer-key-next')) {
        if (page >= totalPages - 1) return;
        if (dirty && !confirm('You have unsaved changes. Go to the next page anyway?')) return;
        page++;
        updateHashPage();
        renderGrid();
        updateChrome();
        return;
      }

      if (e.target.closest('#answer-key-copy-changes')) {
        const text = formatChangesForReview(buildChangesVsBundle(draft, testId), test.name);
        navigator.clipboard.writeText(text).then(
          () => updateChrome('Changes copied — paste into chat'),
          () => prompt('Copy this list of changes:', text)
        );
        return;
      }

      if (e.target.closest('#answer-key-download-changes')) {
        const changes = buildChangesVsBundle(draft, testId);
        const blob = new Blob([JSON.stringify(changes, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${test.id}-answer-changes-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      if (e.target.closest('#answer-key-dismiss-banner')) {
        saveBannerVisible = false;
        updateChrome();
      }
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
          updateChrome();
          return;
        }

        const toSave = changed.map((q) => {
          const copy = { ...q, explanation: '' };
          q.explanation = '';
          needsExplanationIds.add(q.id);
          return copy;
        });

        await bulkSaveQuestions(toSave);
        saveNeedsExplanationIds(testId, needsExplanationIds);

        for (const q of changed) {
          const b = baseline.find((item) => item.id === q.id);
          if (b) {
            b.correctIndex = q.correctIndex;
            b.explanation = '';
          }
        }

        dirty = false;
        saveBannerMessage = `Saved ${changed.length} answer${changed.length === 1 ? '' : 's'}. Explanations cleared for changed questions — see list below.`;
        saveBannerVisible = true;
        updateChrome();
      });
    }
  }

  function paint() {
    const range = pageQuestionRange(draft, page, QUESTIONS_PER_PAGE);

    container.innerHTML = `
      <section class="page answer-key-page-wrap">
        <header class="page-header answer-key-header no-print">
          <p class="breadcrumb">${escapeHtml(test.name)} › Answer Key</p>
          <h1>Answer Key</h1>
          <p class="answer-key-desc">
            ${draft.length} questions · tap A–D to set the correct answer · ${COLS_EDIT} columns × ${ROWS_PER_COL_EDIT} rows per page
          </p>
        </header>

        <div class="answer-key-save-banner no-print" id="answer-key-save-banner" role="status" aria-live="assertive">
          <span class="answer-key-save-banner-text"></span>
          <button type="button" class="answer-key-save-banner-dismiss" id="answer-key-dismiss-banner" aria-label="Dismiss">×</button>
        </div>

        <div class="answer-key-toolbar no-print">
          <div class="answer-key-toolbar-left">
            <button type="button" class="btn btn-secondary btn-small" id="answer-key-prev">Previous page</button>
            <span class="answer-key-page-label" id="answer-key-page-label">
              Page <strong>${page + 1}</strong> of <strong>${totalPages}</strong>
              <span class="answer-key-range">(${escapeHtml(range.label)})</span>
            </span>
            <button type="button" class="btn btn-secondary btn-small" id="answer-key-next">Next page</button>
          </div>
          <div class="answer-key-toolbar-right">
            <span class="answer-key-status" id="answer-key-status" aria-live="polite">All changes saved</span>
            <button type="button" class="btn btn-primary" id="answer-key-save" disabled>Save answers</button>
            <button type="button" class="btn btn-secondary btn-small" id="answer-key-copy-changes" disabled>Copy changes</button>
            <button type="button" class="btn btn-secondary btn-small" id="answer-key-download-changes" disabled>Download changes</button>
          </div>
        </div>

        <div id="answer-key-changes-host" class="answer-key-changes-host no-print"></div>

        <div class="answer-key-grid no-print" id="answer-key-grid"></div>

        <p class="answer-key-footnote no-print">
          Save updates grading in your browser. Changed answers clear their explanations until you rewrite them in My Questions. Use <strong>Print Exam</strong> in the footer to print the exam or answer key.
        </p>
      </section>
    `;

    bindEvents();
    renderGrid();
    updateChrome();
  }

  window.addEventListener('beforeunload', beforeUnload);
  const cleanup = () => window.removeEventListener('beforeunload', beforeUnload);
  container._answerKeyCleanup = cleanup;

  updateHashPage();
  paint();
}
