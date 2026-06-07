import { getAllQuestions, getTest, ensureDefaultTest } from '../db.js';
import { getActiveTestId, getStudyCategory, setStudyCategory } from '../context.js';
import { buildCategoryStats, getQuestionCategory } from '../srs.js';
import {
  escapeHtml,
  sortQuestionsByNumber,
  questionNumberHtml,
  explanationBlockHtml,
} from './helpers.js';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function renderQuestionItem(question) {
  const correctIndex = question.correctIndex ?? 0;
  const options = question.options || [];

  const optionsHtml = options
    .map((text, i) => {
      const isCorrect = i === correctIndex;
      return `
        <li class="study-option ${isCorrect ? 'study-option-correct' : ''}">
          <span class="study-option-letter" aria-hidden="true">${OPTION_LETTERS[i] ?? i + 1}.</span>
          <span class="study-option-text">${escapeHtml(text)}</span>
          ${isCorrect ? '<span class="study-option-tag">Correct</span>' : ''}
        </li>
      `;
    })
    .join('');

  const badge = questionNumberHtml(question.number);

  return `
    <article class="study-list-item">
      <div class="study-list-question">
        ${badge ? badge.replace('q-number-badge', 'q-number-badge study-q-num') : ''}
        <p class="study-list-text">${escapeHtml(question.question)}</p>
      </div>
      <ol class="study-options-list">${optionsHtml}</ol>
      ${explanationBlockHtml(question)}
    </article>
  `;
}

export async function renderStudyList(container, params = {}) {
  await ensureDefaultTest();
  const testId = getActiveTestId();
  const test = testId ? await getTest(testId) : null;
  let questions = await getAllQuestions(testId);
  const categoryStats = buildCategoryStats(questions, []);

  let category = getStudyCategory(testId);
  if (params.category) {
    const decoded = decodeURIComponent(params.category);
    const names = categoryStats.map((c) => c.name);
    if (names.includes(decoded)) category = decoded;
  }

  const filtered =
    category === 'all'
      ? questions
      : questions.filter((q) => getQuestionCategory(q) === category);

  const sorted = sortQuestionsByNumber(filtered);

  container.innerHTML = `
    <section class="page study-page">
      <header class="page-header">
        <p class="breadcrumb">${test ? escapeHtml(test.name) : 'Practice Test'} › Study</p>
        <h1>Study</h1>
        <p class="subtitle">Read questions with correct answers shown — no shuffling, no scoring.</p>
      </header>

      ${
        questions.length === 0
          ? `<div class="empty-state"><p>No questions yet.</p><a href="#add" class="btn btn-primary">Add questions</a></div>`
          : `
        <div class="study-toolbar">
          <label for="study-category" class="study-category-label">Category</label>
          <select id="study-category" class="category-filter-select">
            <option value="all" ${category === 'all' ? 'selected' : ''}>All categories (${questions.length})</option>
            ${categoryStats
              .map((c) => {
                const val = c.name.replace(/"/g, '&quot;');
                return `<option value="${val}" ${c.name === category ? 'selected' : ''}>${escapeHtml(c.name)} (${c.total})</option>`;
              })
              .join('')}
          </select>
          <p class="study-count">${sorted.length} question${sorted.length === 1 ? '' : 's'}</p>
        </div>
        <div class="study-list">
          ${sorted.length === 0 ? '<p class="empty-state">No questions in this category.</p>' : sorted.map(renderQuestionItem).join('')}
        </div>
      `
      }
    </section>
  `;

  container.querySelector('#study-category')?.addEventListener('change', (e) => {
    const value = e.target.value;
    setStudyCategory(testId, value);
    if (value === 'all') {
      window.location.hash = '#study';
    } else {
      window.location.hash = `#study?category=${encodeURIComponent(value)}`;
    }
  });
}
