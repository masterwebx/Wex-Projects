import {
  getAllQuestions,
  getAllProgress,
  getTest,
  ensureDefaultTest,
} from '../db.js';
import {
  getActiveTestId,
  isDoneForToday,
  clearDoneForToday,
  getExamHistory,
  isOnboardingComplete,
  setOnboardingComplete,
} from '../context.js';
import {
  buildStats,
  getTestReadiness,
  buildMistakeQueue,
  buildUnseenQueue,
} from '../srs.js';
import { escapeHtml, todayPracticeLink } from './helpers.js';

export async function renderDashboard(container) {
  await ensureDefaultTest();
  const testId = getActiveTestId();
  const test = testId ? await getTest(testId) : null;
  const questions = await getAllQuestions(testId);
  const progress = await getAllProgress();
  const qIds = new Set(questions.map((q) => q.id));
  const scopedProgress = progress.filter((p) => qIds.has(p.questionId));
  const stats = buildStats(questions, scopedProgress);
  const examHistory = getExamHistory(testId);
  const readiness = getTestReadiness(questions, scopedProgress);
  const mistakePreview = buildMistakeQueue(questions, scopedProgress, { sessionSize: 'all' });
  const unseenPreview = buildUnseenQueue(questions, scopedProgress, { sessionSize: 'all' });
  const doneToday = isDoneForToday(testId);
  const lastExam = examHistory[0];
  const showOnboarding = questions.length > 0 && !isOnboardingComplete();

  container.innerHTML = `
    <section class="page home-page">
      <header class="hero">
        <p class="breadcrumb">${test ? escapeHtml(test.name) : 'Practice Test'} › Home</p>
        <h1>${test ? escapeHtml(test.name) : 'Your Practice Test'}</h1>
        <p class="hero-sub">${
          stats.total > 0
            ? `${readiness.seenOnce}/${readiness.total} answered once · ${readiness.mastered} memorized (${readiness.masteredPercent}%)`
            : 'Add questions, then practice a little each day.'
        }</p>
        ${
          stats.total > 0
            ? `
          <div class="hero-actions">
            <a href="${todayPracticeLink()}" class="btn btn-primary btn-large">Start today's practice</a>
            <a href="#practice?focus=mistakes" class="btn btn-secondary btn-large ${mistakePreview.totalDue > 0 ? 'hero-mistakes-btn' : ''}">
              Review mistakes${mistakePreview.totalDue > 0 ? ` (${mistakePreview.totalDue})` : ''}
            </a>
            <a href="#practice?focus=unseen" class="btn btn-secondary btn-large">
              New questions${unseenPreview.totalDue > 0 ? ` (${unseenPreview.totalDue})` : ''}
            </a>
          </div>
        `
            : ''
        }
      </header>

      ${
        questions.length === 0
          ? renderEmptyState()
          : `
        ${showOnboarding ? renderOnboardingModal() : ''}
        ${doneToday ? renderDoneTodayBanner() : ''}
        ${lastExam ? renderLastExamBanner(lastExam) : ''}

      `
      }
    </section>
  `;

  container.querySelector('#clear-done-today')?.addEventListener('click', () => {
    clearDoneForToday(testId);
    renderDashboard(container);
  });

  container.querySelector('#dismiss-onboarding')?.addEventListener('click', () => {
    setOnboardingComplete();
    container.querySelector('.onboarding-overlay')?.remove();
  });
}

function renderOnboardingModal() {
  return `
    <div class="onboarding-overlay" role="dialog" aria-labelledby="onboarding-title" aria-modal="true">
      <div class="onboarding-card">
        <h2 id="onboarding-title">Welcome to Practice Test</h2>
        <ol class="onboarding-steps">
          <li><strong>Practice daily</strong> — spaced repetition builds long-term memory.</li>
          <li><strong>Review mistakes</strong> — fix weak spots before they stick.</li>
          <li><strong>Mock exams</strong> — simulate the real test with no hints.</li>
          <li><strong>Progress tab</strong> — track readiness, calendar, and mock performance.</li>
        </ol>
        <button type="button" class="btn btn-primary" id="dismiss-onboarding">Got it — let's study</button>
      </div>
    </div>
  `;
}

function renderDoneTodayBanner() {
  return `
    <div class="done-today-banner">
      <strong>You marked today complete.</strong> Rest up — or keep going if you want.
      <button type="button" class="btn btn-small btn-secondary" id="clear-done-today">Practice more today</button>
    </div>
  `;
}

function renderLastExamBanner(exam) {
  const when = new Date(exam.completedAt).toLocaleDateString();
  return `
    <div class="exam-history-banner ${exam.passed ? 'exam-passed' : ''}">
      <strong>Last mock exam:</strong> ${exam.correct}/${exam.total} (${exam.percent}%) on ${when}
      ${exam.passed ? ' — Passed' : ''}
      <a href="#exam" class="focus-link">Take another →</a>
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="getting-started">
      <h2>Welcome — here's how to start</h2>
      <ol class="steps-list">
        <li>
          <strong>Create your test</strong>
          <p>Use Manage Tests if you want a separate exam or subject.</p>
        </li>
        <li>
          <strong>Add your questions</strong>
          <p>Type each question and its four answer choices.</p>
          <a href="#add" class="btn btn-primary btn-large">Add Your First Question</a>
        </li>
        <li>
          <strong>Practice a little each day</strong>
          <p>Sessions default to 20 questions (~15 min).</p>
        </li>
      </ol>
    </div>
    <p class="home-help-link"><a href="#help">How this app works</a></p>
  `;
}
