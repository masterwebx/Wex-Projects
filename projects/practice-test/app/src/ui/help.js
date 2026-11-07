import { getTest, ensureDefaultTest } from '../db.js';
import { getActiveTestId } from '../context.js';
import { escapeHtml, renderHelpContent } from './helpers.js';

export async function renderHelp(container) {
  await ensureDefaultTest();
  const testId = getActiveTestId();
  const test = testId ? await getTest(testId) : null;

  container.innerHTML = `
    <section class="page help-page">
      <header class="page-header">
        <p class="breadcrumb">${test ? escapeHtml(test.name) : 'Practice Test'} › Help</p>
        <h1>How this app works</h1>
        <p class="subtitle">A quick guide to Study, Practice, Mock exams, and Progress.</p>
      </header>
      <div class="help-guide help-page-body">
        ${renderHelpContent()}
      </div>
    </section>
  `;
}
