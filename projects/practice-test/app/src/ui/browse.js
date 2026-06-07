import {
  getAllQuestions,
  getAllProgress,
  saveQuestion,
  deleteQuestion,
  createQuestionId,
  getTest,
  ensureDefaultTest,
  updateTestCategories,
  getCategoriesForTest,
} from '../db.js';
import { getActiveTestId } from '../context.js';
import {
  getEffectiveStage,
  buildCategoryStats,
  getQuestionCategory,
  isDue,
} from '../srs.js';
import {
  escapeHtml,
  friendlyStage,
  autoResizeTextarea,
  questionNumberHtml,
  sortQuestionsByNumber,
  normalizeQuestionNumber,
} from './helpers.js';
import { getMemorizeHint } from '../srs.js';

const PAGE_SIZE = 25;

export async function renderBrowse(container) {
  await ensureDefaultTest();
  const testId = getActiveTestId();
  const test = testId ? await getTest(testId) : null;

  let questions = await getAllQuestions(testId);
  const progressList = await getAllProgress();
  const progressMap = new Map(progressList.map((p) => [p.questionId, p]));
  const categoryStats = buildCategoryStats(questions, progressList);

  let compactView = localStorage.getItem('browseCompact') === '1';
  let currentPage = 0;
  let stageFilter = '';
  let categoryFilter = '';
  let searchTerm = '';

  questions = sortQuestionsByNumber(questions);

  container.innerHTML = `
    <section class="page questions-page">
      <header class="page-header">
        <p class="breadcrumb">${test ? escapeHtml(test.name) : 'Practice Test'} › My Questions</p>
        <h1>My Questions</h1>
        <p class="subtitle">${questions.length} question${questions.length === 1 ? '' : 's'}</p>
      </header>

      <div class="page-actions">
        <a href="#add" class="btn btn-primary">+ Add Question</a>
        <a href="#import" class="btn btn-secondary">Import JSON</a>
        <a href="#practice" class="btn btn-secondary">Practice</a>
      </div>

      ${
        questions.length === 0
          ? `<div class="empty-state">
              <p>You have not added any questions yet.</p>
              <a href="#add" class="btn btn-primary btn-large">Add Your First Question</a>
            </div>`
          : `
        <div class="browse-toolbar">
          <input type="search" id="browse-search" class="search-input" placeholder="Search questions..." />
          <select id="browse-category" class="category-filter-select">
            <option value="">All categories</option>
            ${categoryStats.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} (${c.total})</option>`).join('')}
          </select>
          <select id="browse-stage" class="category-filter-select">
            <option value="">All stages</option>
            <option value="due">Ready to review</option>
            <option value="new">Not started</option>
            <option value="learning">Needs practice</option>
            <option value="mc">Learning</option>
            <option value="type">Almost there</option>
            <option value="mastered">Memorized</option>
          </select>
          <button type="button" class="btn btn-small btn-secondary" id="toggle-compact">${compactView ? 'Expanded view' : 'Compact view'}</button>
        </div>
        <p class="browse-result-count" id="result-count"></p>
        <div id="browse-list" class="browse-list ${compactView ? 'browse-compact' : ''}"></div>
        <div class="browse-pagination" id="pagination"></div>
      `
      }
    </section>
  `;

  const search = container.querySelector('#browse-search');
  const catSelect = container.querySelector('#browse-category');
  const stageSelect = container.querySelector('#browse-stage');
  const list = container.querySelector('#browse-list');
  const pagination = container.querySelector('#pagination');
  const resultCount = container.querySelector('#result-count');

  if (!list) return;

  function getFiltered() {
    return questions.filter((q) => {
      const p = progressMap.get(q.id);
      const stage = p ? getEffectiveStage(p) : 'new';
      const numStr = q.number != null ? String(q.number) : '';
      const matchesSearch =
        !searchTerm ||
        q.question.toLowerCase().includes(searchTerm) ||
        numStr.includes(searchTerm);
      const matchesCat = !categoryFilter || getQuestionCategory(q) === categoryFilter;
      let matchesStage = true;
      if (stageFilter === 'due') matchesStage = !p || isDue(p);
      else if (stageFilter) matchesStage = stage === stageFilter;
      return matchesSearch && matchesCat && matchesStage;
    });
  }

  function refreshList() {
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    const pageItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    resultCount.textContent = `${filtered.length} question${filtered.length === 1 ? '' : 's'} shown`;

    list.innerHTML =
      pageItems.length === 0
        ? '<p class="empty-msg">No questions match your filters.</p>'
        : pageItems
            .map((q) => renderBrowseItem(q, progressMap.get(q.id), compactView))
            .join('');

    pagination.innerHTML =
      totalPages > 1
        ? `
      <button type="button" class="btn btn-small btn-secondary" id="page-prev" ${currentPage === 0 ? 'disabled' : ''}>Previous</button>
      <span>Page ${currentPage + 1} of ${totalPages}</span>
      <button type="button" class="btn btn-small btn-secondary" id="page-next" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Next</button>
    `
        : '';

    attachHandlers();
  }

  function attachHandlers() {
    list.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.hash = `#edit/${btn.dataset.edit}`;
      });
    });
    list.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this question?')) {
          await deleteQuestion(btn.dataset.delete);
          questions = await getAllQuestions(testId);
          refreshList();
        }
      });
    });
    pagination.querySelector('#page-prev')?.addEventListener('click', () => {
      currentPage--;
      refreshList();
    });
    pagination.querySelector('#page-next')?.addEventListener('click', () => {
      currentPage++;
      refreshList();
    });
  }

  search?.addEventListener('input', () => {
    searchTerm = search.value.toLowerCase();
    currentPage = 0;
    refreshList();
  });
  catSelect?.addEventListener('change', () => {
    categoryFilter = catSelect.value;
    currentPage = 0;
    refreshList();
  });
  stageSelect?.addEventListener('change', () => {
    stageFilter = stageSelect.value;
    currentPage = 0;
    refreshList();
  });
  container.querySelector('#toggle-compact')?.addEventListener('click', () => {
    compactView = !compactView;
    localStorage.setItem('browseCompact', compactView ? '1' : '0');
    list.classList.toggle('browse-compact', compactView);
    container.querySelector('#toggle-compact').textContent = compactView ? 'Expanded view' : 'Compact view';
    refreshList();
  });

  refreshList();
}

function renderBrowseItem(q, progress, compact) {
  const stage = progress ? getEffectiveStage(progress) : 'new';
  const hint = progress ? getMemorizeHint(progress) : '';

  if (compact) {
    const preview = q.question.length > 100 ? q.question.slice(0, 100) + '…' : q.question;
    return `
      <article class="browse-item browse-item-compact">
        <div class="browse-item-header">
          ${questionNumberHtml(q.number)}
          ${q.category ? `<span class="cat-tag">${escapeHtml(q.category)}</span>` : '<span class="cat-tag">—</span>'}
          <span class="stage-badge stage-${stage}">${friendlyStage(stage)}</span>
        </div>
        <p class="browse-question-compact">${escapeHtml(preview)}</p>
        <div class="browse-actions">
          <button type="button" class="btn btn-small" data-edit="${q.id}">Edit</button>
          <button type="button" class="btn btn-small btn-danger" data-delete="${q.id}">Delete</button>
        </div>
      </article>
    `;
  }

  const letters = ['A', 'B', 'C', 'D'];
  const correct = letters[q.correctIndex] || '?';

  return `
    <article class="browse-item">
      <div class="browse-item-header">
        ${questionNumberHtml(q.number)}
        <span class="q-label">${q.category ? `<span class="cat-tag">${escapeHtml(q.category)}</span>` : 'Question'}</span>
        <span class="stage-badge stage-${stage}">${friendlyStage(stage)}</span>
      </div>
      <p class="browse-question">${escapeHtml(q.question)}</p>
      <p class="browse-answer"><strong>${correct}.</strong> ${escapeHtml(q.options[q.correctIndex] || '')}</p>
      ${hint ? `<p class="browse-hint">${escapeHtml(hint)}</p>` : ''}
      <div class="browse-actions">
        <button type="button" class="btn btn-small" data-edit="${q.id}">Edit</button>
        <button type="button" class="btn btn-small btn-danger" data-delete="${q.id}">Delete</button>
      </div>
    </article>
  `;
}

export async function renderAddEditForm(container, existing = null) {
  await ensureDefaultTest();
  const testId = getActiveTestId();
  const isEdit = !!existing;
  const existingCategories = testId ? await getCategoriesForTest(testId) : [];

  const q = existing || {
    id: createQuestionId(),
    testId,
    number: null,
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    category: '',
    explanation: '',
  };

  container.innerHTML = `
    <section class="page form-page">
      <header class="page-header">
        <p class="breadcrumb">Add Questions</p>
        <h1>${isEdit ? 'Edit Question' : 'Add a Question'}</h1>
        <p class="subtitle">Long answers are fine. Add a <strong>category</strong> to study by topic.</p>
        ${isEdit ? '' : '<div class="page-actions"><a href="#import" class="btn btn-secondary">Import from JSON</a></div>'}
      </header>

      <form id="question-form" class="question-form">
        <label class="form-field form-field-inline">
          Question # <span class="optional">(optional — matches your study guide)</span>
          <input type="number" name="number" min="1" step="1" value="${q.number != null ? escapeHtml(String(q.number)) : ''}" placeholder="e.g. 12" />
        </label>

        <label class="form-field">
          Category <span class="optional">(recommended for large tests)</span>
          <input type="text" name="category" list="category-suggestions" value="${escapeHtml(q.category || '')}" placeholder="e.g. Procedure, Regulations..." />
          <datalist id="category-suggestions">
            ${existingCategories.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('')}
          </datalist>
        </label>

        <label class="form-field form-highlight">
          Question
          <textarea name="question" class="auto-grow" rows="4" required placeholder="Type or paste the full question here...">${escapeHtml(q.question)}</textarea>
        </label>

        <fieldset class="options-fieldset">
          <legend>Answer choices</legend>
          <p class="fieldset-hint">Mark the <strong>correct answer</strong>. Boxes grow as you type.</p>
          <div class="options-grid">
            ${['A', 'B', 'C', 'D']
              .map(
                (letter, i) => `
              <div class="option-card ${q.correctIndex === i ? 'is-correct-option' : ''}" data-option="${i}">
                <div class="option-card-header">
                  <span class="option-letter">${letter}</span>
                  <label class="correct-radio">
                    <input type="radio" name="correctPick" value="${i}" ${q.correctIndex === i ? 'checked' : ''} />
                    Correct answer
                  </label>
                </div>
                <textarea name="option${i}" class="auto-grow option-textarea" rows="3" required placeholder="Answer choice ${letter}...">${escapeHtml(q.options[i] || '')}</textarea>
              </div>
            `
              )
              .join('')}
          </div>
        </fieldset>

        <label class="form-field">
          Explanation <span class="optional">(optional — shown after wrong answers)</span>
          <textarea name="explanation" class="auto-grow" rows="3" placeholder="Why is this the correct answer?">${escapeHtml(q.explanation || '')}</textarea>
        </label>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-large">${isEdit ? 'Save Changes' : 'Save Question'}</button>
          <a href="#questions" class="btn btn-secondary">Cancel</a>
        </div>
      </form>

      <div id="add-success" class="add-success hidden"></div>
    </section>
  `;

  const form = container.querySelector('#question-form');
  const successPanel = container.querySelector('#add-success');

  form.querySelectorAll('.auto-grow').forEach(autoResizeTextarea);

  form.querySelectorAll('input[name="correctPick"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      form.querySelectorAll('.option-card').forEach((card) => {
        card.classList.toggle('is-correct-option', parseInt(radio.value, 10) === parseInt(card.dataset.option, 10));
      });
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const correctRadio = form.querySelector('input[name="correctPick"]:checked');
    const question = {
      id: q.id,
      testId: q.testId || testId,
      number: normalizeQuestionNumber(fd.get('number')),
      category: fd.get('category')?.trim() || '',
      question: fd.get('question').trim(),
      options: [0, 1, 2, 3].map((i) => fd.get(`option${i}`).trim()),
      correctIndex: correctRadio ? parseInt(correctRadio.value, 10) : 0,
      explanation: fd.get('explanation')?.trim() || '',
    };

    await saveQuestion(question);
    if (question.testId) await updateTestCategories(question.testId);

    if (isEdit) {
      window.location.hash = '#questions';
      return;
    }

    form.reset();
    form.querySelector('input[name="correctPick"][value="0"]').checked = true;
    form.querySelectorAll('.option-card').forEach((card, i) => {
      card.classList.toggle('is-correct-option', i === 0);
    });
    form.querySelectorAll('.auto-grow').forEach((ta) => {
      ta.style.height = 'auto';
    });

    successPanel.classList.remove('hidden');
    successPanel.innerHTML = `
      <p class="success-msg">Question saved!</p>
      <div class="success-actions">
        <button type="button" class="btn btn-primary" id="add-another-btn">Add Another Question</button>
        <a href="#practice?quick=1" class="btn btn-secondary">Start Practicing</a>
        <a href="#questions" class="btn btn-secondary">View All Questions</a>
      </div>
    `;
    successPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    successPanel.querySelector('#add-another-btn')?.addEventListener('click', () => {
      successPanel.classList.add('hidden');
      form.querySelector('[name="question"]').focus();
    });
  });
}
