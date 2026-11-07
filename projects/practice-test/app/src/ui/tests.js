import {
  getAllTests,
  getActiveTests,
  getTest,
  saveTest,
  deleteTest,
  archiveTest,
  unarchiveTest,
  createTestId,
  getQuestionsByTestId,
  ensureDefaultTest,
  getAllProgress,
  clearProgressForTest,
} from '../db.js';
import {
  getActiveTestId,
  setActiveTestId,
  clearActivePracticeSession,
  clearDoneForToday,
} from '../context.js';
import { buildStats } from '../srs.js';
import { escapeHtml } from './helpers.js';

async function switchAwayFromTest(testId) {
  if (getActiveTestId() !== testId) return;
  const active = await getActiveTests();
  const next = active.find((t) => t.id !== testId);
  setActiveTestId(next?.id || null);
}

export async function renderTests(container) {
  await ensureDefaultTest();
  const allTests = await getAllTests();
  const activeTests = allTests.filter((t) => !t.archived);
  const archivedTests = allTests.filter((t) => t.archived);
  const progress = await getAllProgress();
  const activeId = getActiveTestId();

  async function statsFor(test) {
    const questions = await getQuestionsByTestId(test.id);
    const stats = buildStats(questions, progress);
    return { test, stats, count: questions.length };
  }

  const activeStats = await Promise.all(activeTests.map(statsFor));
  const archivedStats = await Promise.all(archivedTests.map(statsFor));

  container.innerHTML = `
    <section class="page tests-page">
      <header class="page-header">
        <h1>Manage Tests</h1>
        <p class="subtitle">Create separate tests for different exams. Archive old ones to hide them, or delete to remove permanently.</p>
      </header>

      <form id="new-test-form" class="new-test-form">
        <input type="text" id="new-test-name" placeholder="Name your new test (e.g. AMT RPT Mock Exam)" required />
        <button type="submit" class="btn btn-primary">Create Test</button>
      </form>

      <h2 class="section-title">Your Tests</h2>
      <div class="tests-grid">
        ${activeStats.length === 0
          ? '<p class="empty-msg">No active tests. Create one above or restore an archived test.</p>'
          : activeStats.map(({ test, stats, count }) => renderTestCard(test, stats, count, activeId, false)).join('')}
      </div>

      ${archivedStats.length > 0
        ? `
        <h2 class="section-title archived-title">Archived Tests</h2>
        <p class="section-desc">Archived tests are hidden from practice but keep all questions and progress.</p>
        <div class="tests-grid archived-grid">
          ${archivedStats.map(({ test, stats, count }) => renderTestCard(test, stats, count, activeId, true)).join('')}
        </div>
      `
        : ''}

      <p class="hint"><a href="#home">← Back to Home</a></p>
    </section>
  `;

  container.querySelector('#new-test-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#new-test-name').value.trim();
    if (!name) return;
    const test = {
      id: createTestId(),
      name,
      description: '',
      categories: [],
      createdAt: new Date().toISOString(),
    };
    await saveTest(test);
    setActiveTestId(test.id);
    window.location.hash = '#add';
  });

  attachTestHandlers(container);
}

function renderTestCard(test, stats, count, activeId, isArchived) {
  return `
    <article class="test-card ${test.id === activeId && !isArchived ? 'active' : ''} ${isArchived ? 'archived' : ''}" data-test-id="${test.id}">
      <div class="test-card-header">
        <h3 class="test-name-display">${escapeHtml(test.name)}</h3>
        ${test.id === activeId && !isArchived ? '<span class="active-badge">Current</span>' : ''}
        ${isArchived ? '<span class="archived-badge">Archived</span>' : ''}
      </div>
      <p class="test-meta">${count} question${count === 1 ? '' : 's'} · ${stats.masteredPercent}% memorized</p>
      <div class="test-actions">
        ${
          !isArchived && test.id !== activeId
            ? `<button type="button" class="btn btn-primary btn-small" data-activate="${test.id}">Switch to This Test</button>`
            : ''
        }
        ${
          !isArchived && test.id === activeId
            ? '<a href="#add" class="btn btn-secondary btn-small">Add Questions</a>'
            : ''
        }
        <a href="#questions" class="btn btn-secondary btn-small" data-switch="${test.id}">View Questions</a>
        <button type="button" class="btn btn-small btn-muted" data-rename="${test.id}">Rename</button>
        ${
          count > 0 && stats.mastered + stats.mc + stats.type + stats.learning > 0
            ? `<button type="button" class="btn btn-small btn-muted" data-reset-progress="${test.id}">Reset progress</button>`
            : ''
        }
        ${
          isArchived
            ? `<button type="button" class="btn btn-secondary btn-small" data-restore="${test.id}">Restore</button>`
            : `<button type="button" class="btn btn-small btn-muted" data-archive="${test.id}">Archive</button>`
        }
        <button type="button" class="btn btn-small btn-danger" data-delete="${test.id}">Delete</button>
      </div>
    </article>
  `;
}

function attachTestHandlers(container) {
  container.querySelectorAll('[data-activate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveTestId(btn.dataset.activate);
      window.location.reload();
    });
  });

  container.querySelectorAll('[data-switch]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setActiveTestId(link.dataset.switch);
      window.location.hash = '#questions';
    });
  });

  container.querySelectorAll('[data-archive]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Archive this test? It will be hidden from practice but you can restore it later.')) return;
      const id = btn.dataset.archive;
      await archiveTest(id);
      await switchAwayFromTest(id);
      await renderTests(container);
    });
  });

  container.querySelectorAll('[data-restore]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await unarchiveTest(btn.dataset.restore);
      await renderTests(container);
    });
  });

  container.querySelectorAll('[data-reset-progress]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.resetProgress;
      const test = await getTest(id);
      if (!test) return;
      if (
        !confirm(
          `Reset study progress for "${test.name}"?\n\nQuestions are kept. Memorization and review schedules are cleared.`
        )
      ) {
        return;
      }
      await clearProgressForTest(id);
      clearActivePracticeSession(id);
      clearDoneForToday(id);
      await renderTests(container);
    });
  });

  container.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Permanently delete this test and all its questions? This cannot be undone.')) return;
      const id = btn.dataset.delete;
      await deleteTest(id);
      await switchAwayFromTest(id);
      await ensureDefaultTest();
      await renderTests(container);
    });
  });

  container.querySelectorAll('[data-rename]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.test-card');
      const testId = btn.dataset.rename;
      const nameEl = card.querySelector('.test-name-display');
      const currentName = nameEl.textContent;

      if (card.querySelector('.test-rename-form')) return;

      const form = document.createElement('div');
      form.className = 'test-rename-form';
      form.innerHTML = `
        <input type="text" class="test-rename-input" value="" maxlength="120" />
        <div class="test-rename-actions">
          <button type="button" class="btn btn-small btn-primary" data-save-rename>Save</button>
          <button type="button" class="btn btn-small btn-secondary" data-cancel-rename>Cancel</button>
        </div>
      `;
      const input = form.querySelector('.test-rename-input');
      input.value = currentName;

      nameEl.classList.add('hidden');
      card.querySelector('.test-card-header').insertBefore(form, nameEl.nextSibling);
      input.focus();
      input.select();

      form.querySelector('[data-cancel-rename]').addEventListener('click', () => {
        form.remove();
        nameEl.classList.remove('hidden');
      });

      const saveRename = async () => {
        const newName = input.value.trim();
        if (!newName) {
          alert('Please enter a name for the test.');
          input.focus();
          return;
        }
        const test = await getTest(testId);
        if (!test) return;
        test.name = newName;
        await saveTest(test);
        await renderTests(container);
      };

      form.querySelector('[data-save-rename]').addEventListener('click', saveRename);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveRename();
        if (e.key === 'Escape') {
          form.remove();
          nameEl.classList.remove('hidden');
        }
      });
    });
  });
}
