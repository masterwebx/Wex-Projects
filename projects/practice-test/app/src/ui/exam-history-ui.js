import { escapeHtml } from './helpers.js';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function reviewHref(entry, returnTo) {
  if (!entry.id) return null;
  const q = new URLSearchParams({ examReview: entry.id });
  if (returnTo) q.set('returnTo', returnTo);
  return `#practice?${q.toString()}`;
}

function renderHistoryRow(entry, returnTo) {
  const when = entry.completedAt
    ? new Date(entry.completedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';
  const scope =
    entry.category && entry.category !== 'all' ? escapeHtml(entry.category) : 'All categories';
  const timeLine =
    entry.durationSec != null && entry.timerMinutes
      ? `${formatTime(entry.durationSec)} of ${formatTime(entry.timerMinutes * 60)}`
      : entry.durationSec != null
        ? formatTime(entry.durationSec)
        : '';
  const badges = [
    entry.passed
      ? '<span class="exam-history-badge exam-history-passed">Passed</span>'
      : '<span class="exam-history-badge exam-history-failed">Failed</span>',
    entry.isFullExam ? '<span class="exam-history-badge exam-history-full">Full exam</span>' : '',
    entry.timedOut ? '<span class="exam-history-badge exam-history-timeout">Timed out</span>' : '',
  ]
    .filter(Boolean)
    .join('');

  const inner = `
    <div class="exam-history-main">
      <span class="exam-history-date">${escapeHtml(when)}</span>
      <span class="exam-history-scope">${scope}</span>
      <span class="exam-history-score">${entry.correct}/${entry.total} (${entry.percent}%)</span>
      ${timeLine ? `<span class="exam-history-time">${timeLine}</span>` : ''}
    </div>
    <div class="exam-history-badges">${badges}</div>
  `;

  const href = reviewHref(entry, returnTo);
  if (href) {
    return `<li><a href="${href}" class="exam-history-row exam-history-row-link">${inner}</a></li>`;
  }
  return `<li class="exam-history-row">${inner}</li>`;
}

/** @param {object[]} examHistory */
export function renderExamHistorySection(examHistory, options = {}) {
  const { returnTo } = options;

  if (!examHistory.length) {
    return `
      <section class="exam-history-section" aria-labelledby="exam-history-heading">
        <h2 id="exam-history-heading">Previous mock exams</h2>
        <p class="exam-history-empty">No mock exams yet — start one above.</p>
      </section>
    `;
  }

  const rows = examHistory.map((entry) => renderHistoryRow(entry, returnTo)).join('');

  return `
    <section class="exam-history-section" aria-labelledby="exam-history-heading">
      <h2 id="exam-history-heading">Previous mock exams</h2>
      <ul class="exam-history-list">${rows}</ul>
    </section>
  `;
}
