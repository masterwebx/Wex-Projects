import { getAllQuestions } from '../db.js';
import { getExamHistoryEntry } from '../context.js';
import { escapeHtml, questionNumberHtml, explanationBlockHtml } from './helpers.js';

function truncateText(text, max = 120) {
  if (!text || text.length <= max) return text || '';
  return `${text.slice(0, max)}…`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function renderExamReview(container, { testId, test, reviewId, returnTo }) {
  const entry = getExamHistoryEntry(testId, reviewId);
  const backHref = returnTo === 'exam' ? '#exam' : '#practice';
  const backLabel = returnTo === 'exam' ? 'Mock exam' : 'Practice';

  if (!entry) {
    container.innerHTML = `
      <section class="page exam-page">
        <div class="empty-state">
          <h2>Exam not found</h2>
          <p>That mock exam result could not be found.</p>
          <a href="${backHref}" class="btn btn-primary">Back to ${escapeHtml(backLabel)}</a>
        </div>
      </section>
    `;
    return;
  }

  const scope =
    entry.category && entry.category !== 'all' ? escapeHtml(entry.category) : 'All categories';
  const when = entry.completedAt
    ? new Date(entry.completedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';
  const timeLine =
    entry.durationSec != null && entry.timerMinutes
      ? `${formatTime(entry.durationSec)} of ${formatTime(entry.timerMinutes * 60)}`
      : entry.durationSec != null
        ? formatTime(entry.durationSec)
        : '';

  if (!entry.answers?.length) {
    container.innerHTML = `
      <section class="page exam-page">
        <header class="page-header">
          <p class="breadcrumb">${test ? escapeHtml(test.name) : 'Practice Test'} › Mock exam review</p>
          <h1>Mock exam review</h1>
        </header>
        <div class="exam-review-summary">
          <p><strong>${escapeHtml(when)}</strong> · ${scope} · ${entry.correct}/${entry.total} (${entry.percent}%)</p>
          ${timeLine ? `<p class="exam-time-line">Time: <strong>${timeLine}</strong></p>` : ''}
          <p class="exam-history-empty">Detailed review unavailable for older attempts.</p>
          <a href="${backHref}" class="btn btn-secondary">← Back to ${escapeHtml(backLabel)}</a>
        </div>
      </section>
    `;
    return;
  }

  const allQuestions = await getAllQuestions(testId);
  const qMap = new Map(allQuestions.map((q) => [q.id, q]));

  const reviewHtml = entry.answers
    .map((ans, i) => {
      const q = qMap.get(ans.questionId);
      if (!q) return '';
      return `
        <li class="session-review-item ${ans.correct ? 'is-correct' : 'is-incorrect'}">
          <span class="session-review-num">${i + 1}</span>
          <div class="session-review-body">
            <p class="session-review-q">${questionNumberHtml(q.number)}${escapeHtml(truncateText(q.question))}</p>
            <p class="session-review-detail"><span class="session-review-label">Your answer:</span> ${escapeHtml(ans.selectedText || '—')}</p>
            <p class="session-review-detail session-review-correct"><span class="session-review-label">Correct:</span> ${escapeHtml(ans.correctText)}</p>
            ${!ans.correct ? explanationBlockHtml(q) : ''}
          </div>
          <span class="session-review-badge">${ans.correct ? 'Correct' : 'Incorrect'}</span>
        </li>
      `;
    })
    .filter(Boolean)
    .join('');

  const heading = entry.timedOut ? "Time's up" : entry.passed ? 'Passed!' : 'Keep studying';

  container.innerHTML = `
    <section class="page exam-page">
      <header class="page-header">
        <p class="breadcrumb">${test ? escapeHtml(test.name) : 'Practice Test'} › Mock exam review</p>
        <h1>Mock exam review</h1>
        <p class="page-sub">${escapeHtml(when)} · ${scope}</p>
      </header>
      <div class="session-complete exam-complete exam-review ${entry.passed ? 'exam-passed' : 'exam-failed'} ${entry.timedOut ? 'exam-timed-out' : ''}">
        <h2>${heading}</h2>
        <p class="session-score-line">Score: <strong>${entry.correct}</strong> / <strong>${entry.total}</strong> (${entry.percent}%)</p>
        ${timeLine ? `<p class="exam-time-line">Time: <strong>${timeLine}</strong></p>` : ''}
        <div class="session-review">
          <h3>Your answers</h3>
          <ol class="session-review-list">${reviewHtml}</ol>
        </div>
        <div class="success-actions">
          <a href="${backHref}" class="btn btn-secondary">← Back to ${escapeHtml(backLabel)}</a>
          <a href="#exam" class="btn btn-primary">New mock exam</a>
        </div>
      </div>
    </section>
  `;
}
