import { escapeHtml } from './helpers.js';

export const PRINT_COLS = 4;
export const PRINT_ROWS_PER_COL = 40;
export const QUESTIONS_PER_PRINT_PAGE = PRINT_COLS * PRINT_ROWS_PER_COL;
export const LETTERS = ['A', 'B', 'C', 'D'];

export function letterAt(index) {
  return LETTERS[index] ?? String(index + 1);
}

/** Column-major chunks: col0 = items 0–39, col1 = 40–79, etc. */
export function splitIntoColumns(questions, cols = PRINT_COLS, rowsPerCol = PRINT_ROWS_PER_COL) {
  const columns = Array.from({ length: cols }, () => []);
  questions.forEach((q, i) => {
    const col = Math.floor(i / rowsPerCol);
    if (col < cols) columns[col].push(q);
  });
  return columns;
}

export function pageQuestionRange(questions, page, perPage = QUESTIONS_PER_PRINT_PAGE) {
  const start = page * perPage;
  const slice = questions.slice(start, start + perPage);
  if (slice.length === 0) return { start: 0, end: 0, label: '' };
  const first = slice[0].number ?? start + 1;
  const last = slice[slice.length - 1].number ?? start + slice.length;
  return { start: first, end: last, label: `Q${first}–${last}` };
}

function renderSheetHeader(title, subtitle) {
  if (!title) return '';
  return `
    <header class="print-sheet-header">
      <h2 class="print-sheet-title">${escapeHtml(title)}</h2>
      ${subtitle ? `<p class="print-sheet-subtitle">${escapeHtml(subtitle)}</p>` : ''}
    </header>
  `;
}

/** Compact A–D letter grid row (original answer-key print style). */
export function renderCompactKeyRow(question) {
  const num = question.number ?? '?';
  const choices = LETTERS.map((letter, idx) => {
    const selected = question.correctIndex === idx;
    return `<span class="print-key-choice ${selected ? 'is-selected' : ''}">${letter}</span>`;
  }).join('');

  return `
    <div class="print-key-row">
      <span class="print-key-num">${escapeHtml(String(num))}</span>
      <div class="print-key-choices">${choices}</div>
    </div>
  `;
}

export function renderCompactKeyColumn(questions) {
  const rows = questions.map(renderCompactKeyRow).join('');
  return `<div class="print-key-column">${rows}</div>`;
}

export function renderCompactKeyPage(questions, { title, subtitle } = {}) {
  const columns = splitIntoColumns(questions);
  const colsHtml = columns.map((col) => renderCompactKeyColumn(col)).join('');

  return `
    <section class="print-sheet-page print-sheet-compact">
      ${renderSheetHeader(title, subtitle)}
      <div class="print-key-grid">${colsHtml}</div>
    </section>
  `;
}

export function renderAllCompactKeyPages(
  questions,
  {
    title,
    perPage = QUESTIONS_PER_PRINT_PAGE,
    pageQuestions = null,
    pageIndex = null,
    showPageLabels = true,
  } = {}
) {
  if (pageQuestions) {
    const page = pageIndex ?? 0;
    const rangeLabel = pageQuestionRange(questions, page, perPage);
    return renderCompactKeyPage(pageQuestions, {
      title,
      subtitle: rangeLabel.label ? `Questions ${rangeLabel.label}` : undefined,
    });
  }

  const totalPages = Math.max(1, Math.ceil(questions.length / perPage));
  const pages = [];

  for (let page = 0; page < totalPages; page++) {
    const start = page * perPage;
    const pageQuestionsSlice = questions.slice(start, start + perPage);
    const range = pageQuestionRange(questions, page, perPage);
    let subtitle;
    if (!showPageLabels) {
      subtitle = page === 0 ? `${questions.length} questions` : range.label;
    } else {
      subtitle =
        totalPages > 1 ? `Page ${page + 1} of ${totalPages} · ${range.label}` : `${questions.length} questions`;
    }
    pages.push(
      renderCompactKeyPage(pageQuestionsSlice, {
        title: page === 0 ? title : title ? `${title} (continued)` : undefined,
        subtitle,
      })
    );
  }

  return pages.join('');
}

export function renderExamQuestionBlock(question, { showCorrect = false } = {}) {
  const num = question.number ?? '?';
  const options = question.options || [];
  const correctIndex = question.correctIndex ?? 0;

  const optionsHtml = options
    .map((text, i) => {
      const letter = LETTERS[i] ?? String(i + 1);
      const isCorrect = showCorrect && i === correctIndex;
      return `
        <li class="print-exam-option ${isCorrect ? 'is-correct' : ''}">
          <span class="print-exam-option-letter">${escapeHtml(letter)}.</span>
          <span class="print-exam-option-text">${escapeHtml(text)}</span>
        </li>
      `;
    })
    .join('');

  return `
    <article class="print-exam-item">
      <p class="print-exam-question">
        <span class="print-exam-number">${escapeHtml(String(num))}.</span>
        <span class="print-exam-question-text">${escapeHtml(question.question)}</span>
      </p>
      <ol class="print-exam-options">${optionsHtml}</ol>
    </article>
  `;
}

/** Single continuous exam document — all questions, natural page breaks only. */
export function renderFullWidthExam(questions, { title, showCorrect = false } = {}) {
  const blocks = questions.map((q) => renderExamQuestionBlock(q, { showCorrect })).join('');

  return `
    <section class="print-sheet-document print-sheet-fullwidth">
      ${renderSheetHeader(title, `${questions.length} questions`)}
      <div class="print-sheet-stack">${blocks}</div>
    </section>
  `;
}

/** Answer key appendix using the same A–D grid as the answer key editor. */
export function renderAnswerKeyAppendix(questions, { title = 'Answer Key' } = {}) {
  return `
    <div class="print-answer-key-appendix-wrap">
      ${renderAllCompactKeyPages(questions, { title, showPageLabels: false })}
    </div>
  `;
}

export function renderExamPrintDocument(questions, mode, { title } = {}) {
  if (mode === 'key-only') {
    return renderAllCompactKeyPages(questions, { title: title || 'Answer Key', showPageLabels: false });
  }
  if (mode === 'underlined') {
    return renderFullWidthExam(questions, { title, showCorrect: true });
  }
  if (mode === 'key-at-end') {
    return (
      renderFullWidthExam(questions, { title, showCorrect: false }) + renderAnswerKeyAppendix(questions)
    );
  }
  return renderFullWidthExam(questions, { title, showCorrect: false });
}
