import { getActiveTests, ensureDefaultTest } from '../db.js';
import { getActiveTestId, setActiveTestId } from '../context.js';
import { escapeHtml } from './helpers.js';

export async function renderTestSelector(container) {
  if (!container) return;
  await ensureDefaultTest();
  const tests = await getActiveTests();
  const activeId = getActiveTestId();
  const validActive = tests.find((t) => t.id === activeId);

  if (activeId && !validActive && tests.length > 0) {
    setActiveTestId(tests[0].id);
  }

  const currentId = getActiveTestId() || tests[0]?.id;

  if (tests.length === 0) {
    container.innerHTML = '<a href="#tests" class="current-test-label no-test">No active test — create one</a>';
    return;
  }

  if (tests.length === 1) {
    container.innerHTML = `<span class="current-test-label">${escapeHtml(tests[0].name)}</span>`;
    return;
  }

  container.innerHTML = `
    <label class="test-select-label">
      <span class="sr-only">Current test</span>
      <select id="global-test-select" class="test-select" title="Switch practice test">
        ${tests.map((t) => `<option value="${t.id}" ${t.id === currentId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
      </select>
    </label>
  `;

  container.querySelector('#global-test-select').addEventListener('change', (e) => {
    setActiveTestId(e.target.value);
    window.location.reload();
  });
}
