import {
  exportAllData,
  importAllData,
  mergeImportData,
  clearAllData,
  clearProgressForTest,
  ensureDefaultTest,
  getTest,
} from '../db.js';
import {
  setActiveTestId,
  getActiveTestId,
  clearActivePracticeSession,
  clearDoneForToday,
} from '../context.js';
import { escapeHtml } from './helpers.js';

export async function renderSettings(container) {
  await ensureDefaultTest();
  const testId = getActiveTestId();
  const test = testId ? await getTest(testId) : null;
  const testName = test?.name || 'current test';

  container.innerHTML = `
    <section class="page backup-page">
      <header class="page-header">
        <h1>Backup &amp; Restore</h1>
        <p class="subtitle">Save a copy of your data, restore from a backup, or reset study progress.</p>
      </header>

      <div class="settings-section">
        <h2>Save a backup</h2>
        <p>Download a file with all your tests, questions, and study progress.</p>
        <button type="button" class="btn btn-primary" id="export-btn">Download Backup</button>
      </div>

      <div class="settings-section">
        <h2>Restore a backup</h2>
        <p>Replace all data, or merge a backup in (skips duplicate questions by text or number).</p>
        <input type="file" id="import-file" accept=".json,application/json" class="file-input" />
        <fieldset class="restore-mode-fieldset">
          <legend class="sr-only">Restore mode</legend>
          <label class="restore-mode-option">
            <input type="radio" name="restore-mode" value="replace" checked />
            Replace everything
          </label>
          <label class="restore-mode-option">
            <input type="radio" name="restore-mode" value="merge" />
            Merge into existing data
          </label>
        </fieldset>
        <button type="button" class="btn btn-secondary" id="import-btn" disabled>Restore Backup</button>
      </div>

      <div class="settings-section settings-danger">
        <h2>Reset study progress</h2>
        <p>Clear memorization progress for <strong>${escapeHtml(testName)}</strong>. All questions stay — only practice history, stages, and review schedules are wiped.</p>
        <button type="button" class="btn btn-danger" id="reset-progress-btn">Reset Progress for This Test</button>
      </div>

      <div class="settings-section settings-danger">
        <h2>Delete everything</h2>
        <p>Remove all tests, questions, and progress. Use this to see what the app looks like for a brand-new user.</p>
        <button type="button" class="btn btn-danger" id="clear-all-btn">Delete All Data</button>
      </div>

      <p class="hint"><a href="#home">← Back to Home</a></p>
    </section>
  `;

  const importFile = container.querySelector('#import-file');
  const importBtn = container.querySelector('#import-btn');

  importFile.addEventListener('change', () => {
    importBtn.disabled = !importFile.files.length;
  });

  container.querySelector('#export-btn').addEventListener('click', async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `practice-test-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', async () => {
    const file = importFile.files[0];
    if (!file) return;
    const mode = container.querySelector('input[name="restore-mode"]:checked')?.value || 'replace';

    if (mode === 'replace') {
      if (!confirm('This will replace all your questions and progress. Are you sure?')) return;
    } else if (!confirm('Merge this backup into your existing data? Duplicate questions will be skipped.')) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (mode === 'merge') {
        const result = await mergeImportData(data);
        alert(
          `Backup merged: ${result.added} added, ${result.updated} updated, ${result.skipped} duplicates skipped.`
        );
      } else {
        await importAllData(data);
        alert('Backup restored successfully!');
      }
      window.location.hash = '#home';
      window.location.reload();
    } catch (err) {
      alert(`Could not restore backup: ${err.message}`);
    }
  });

  container.querySelector('#reset-progress-btn').addEventListener('click', async () => {
    if (!testId) return;
    if (
      !confirm(
        `Reset all study progress for "${testName}"?\n\nQuestions are kept. Memorization stages and review schedules will be cleared.`
      )
    ) {
      return;
    }
    if (!confirm('Are you sure? This cannot be undone.')) return;

    try {
      await clearProgressForTest(testId);
      clearActivePracticeSession(testId);
      clearDoneForToday(testId);
      alert('Study progress reset. All questions are still here — start fresh from Practice.');
      window.location.hash = '#home';
      window.location.reload();
    } catch (err) {
      alert(`Could not reset progress: ${err.message}`);
    }
  });

  container.querySelector('#clear-all-btn').addEventListener('click', async () => {
    if (
      !confirm(
        'Delete ALL tests, questions, and study progress?\n\nThis cannot be undone. Download a backup first if you want to keep your data.'
      )
    ) {
      return;
    }
    if (!confirm('Are you absolutely sure? Everything will be erased.')) return;

    try {
      await clearAllData();
      setActiveTestId(null);
      alert('All data deleted. The app has been reset.');
      window.location.hash = '#home';
      window.location.reload();
    } catch (err) {
      alert(`Could not delete data: ${err.message}`);
    }
  });
}
