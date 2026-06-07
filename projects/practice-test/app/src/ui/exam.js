import { getAllQuestions, getAllProgress, getTest, ensureDefaultTest } from '../db.js';
import {
  getActiveTestId,
  getActiveExamSession,
  saveActiveExamSession,
  clearActiveExamSession,
  addExamHistoryEntry,
} from '../context.js';
import {
  buildCategoryStats,
  filterQuestionsByCategory,
  getQuestionCategory,
} from '../srs.js';
import { renderMcQuestion, cleanupMcQuestion } from '../study/mc-mode.js';
import { runSessionCountdown } from './session-countdown.js';
import { setSessionChrome } from './session-chrome.js';
import { escapeHtml, questionNumberHtml, sortQuestionsByNumber, explanationBlockHtml } from './helpers.js';

const EXAM_PASS_PERCENT = 70;
const TIMER_PRESETS = [
  { value: 0, label: 'No timer' },
  { value: 60, label: '60 min' },
  { value: 90, label: '90 min' },
  { value: 120, label: '120 min' },
];

function shuffleQuestions(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function truncateText(text, max = 120) {
  if (!text || text.length <= max) return text || '';
  return `${text.slice(0, max)}…`;
}

export async function renderExam(container, params = {}) {
  await ensureDefaultTest();
  const testId = getActiveTestId();
  const test = testId ? await getTest(testId) : null;
  const allQuestions = await getAllQuestions(testId);

  if (allQuestions.length === 0) {
    container.innerHTML = `
      <section class="page exam-page">
        <div class="empty-state">
          <h2>No questions yet</h2>
          <p>Add questions before running a mock exam.</p>
          <a href="#add" class="btn btn-primary">Add Questions</a>
        </div>
      </section>
    `;
    return;
  }

  const progressList = (await getAllProgress()).filter((p) =>
    allQuestions.some((q) => q.id === p.questionId)
  );
  const categoryStats = buildCategoryStats(allQuestions, progressList);
  const categoryNames = categoryStats.map((c) => c.name);
  const saved = getActiveExamSession(testId);

  if (params.resume === '1' && saved?.questionIds?.length) {
    await runExamSession(container, { test, testId, saved, allQuestions });
    return;
  }

  if (params.start === '1') {
    const category = params.category && categoryNames.includes(decodeURIComponent(params.category))
      ? decodeURIComponent(params.category)
      : 'all';
    const timerMinutes = parseInt(params.timer, 10) || 0;
    const filtered = filterQuestionsByCategory(allQuestions, category);
    let questions = sortQuestionsByNumber(filtered);
    if (params.shuffle === '1') questions = shuffleQuestions(questions);
    if (questions.length === 0) {
      container.innerHTML = `
        <section class="page exam-page">
          <div class="empty-state"><p>No questions in that category.</p><a href="#exam" class="btn btn-primary">Back</a></div>
        </section>
      `;
      return;
    }
    clearActiveExamSession(testId);
    await runExamSession(container, {
      test,
      testId,
      fresh: true,
      category,
      timerMinutes,
      questions,
      allQuestions,
    });
    return;
  }

  renderExamSetup(container, { test, testId, allQuestions, categoryStats, saved });
}

function renderExamSetup(container, { test, testId, allQuestions, categoryStats, saved }) {
  const defaultTimer = allQuestions.length >= 200 ? 90 : 60;

  container.innerHTML = `
    <section class="page exam-page">
      <header class="page-header">
        <p class="breadcrumb">${test ? escapeHtml(test.name) : 'Practice Test'} › Mock exam</p>
        <h1>Mock exam</h1>
        <p class="page-sub">Simulate a real test — no hints, no spaced-repetition updates until you finish.</p>
      </header>

      ${
        saved?.questionIds?.length
          ? `
        <div class="resume-session-banner">
          <p>Paused exam: question <strong>${Math.min(saved.currentIndex + 1, saved.questionIds.length)}</strong> of <strong>${saved.questionIds.length}</strong></p>
          <div class="resume-session-actions">
            <a href="#exam?resume=1" class="btn btn-primary btn-small">Resume exam</a>
            <button type="button" class="btn btn-secondary btn-small" id="discard-exam-btn">Discard</button>
          </div>
        </div>`
          : ''
      }

      <div class="exam-setup-card">
        <div class="setup-panel">
          <h2>Scope</h2>
          <select id="exam-category" class="category-filter-select">
            <option value="all">All categories (${allQuestions.length})</option>
            ${categoryStats
              .filter((c) => c.name !== 'Uncategorized' || categoryStats.length === 1)
              .map((c) => {
                const val = c.name.replace(/"/g, '&quot;');
                return `<option value="${val}">${escapeHtml(c.name)} (${c.total})</option>`;
              })
              .join('')}
          </select>
        </div>

        <div class="setup-panel">
          <h2>Timer</h2>
          <div class="size-options" role="group" id="exam-timer-options">
            ${TIMER_PRESETS.map(
              (t) => `
              <button type="button" class="mode-chip ${t.value === defaultTimer ? 'active' : ''}" data-timer="${t.value}">
                ${t.label}
              </button>
            `
            ).join('')}
          </div>
          <p class="setup-desc">Timer is optional. Full exams are often ~90 minutes.</p>
        </div>

        <label class="exam-shuffle-option">
          <input type="checkbox" id="exam-shuffle" />
          Shuffle question order
        </label>

        <p class="exam-setup-summary" id="exam-setup-summary"></p>
        <button type="button" class="btn btn-primary btn-large" id="start-exam-btn">Start mock exam</button>
      </div>
    </section>
  `;

  let timerMinutes = defaultTimer;

  function updateSummary() {
    const cat = container.querySelector('#exam-category')?.value || 'all';
    const count = filterQuestionsByCategory(allQuestions, cat).length;
    const el = container.querySelector('#exam-setup-summary');
    if (el) {
      const scopeNote =
        cat === 'all'
          ? 'Counts toward readiness score'
          : 'Practice only — does not affect readiness score';
      el.textContent = `${count} questions · ${timerMinutes ? `${timerMinutes} min limit` : 'untimed'} · ${scopeNote}`;
    }
  }

  container.querySelector('#exam-category')?.addEventListener('change', updateSummary);
  container.querySelectorAll('[data-timer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      timerMinutes = parseInt(btn.dataset.timer, 10);
      container.querySelectorAll('[data-timer]').forEach((b) =>
        b.classList.toggle('active', parseInt(b.dataset.timer, 10) === timerMinutes)
      );
      updateSummary();
    });
  });
  container.querySelector('#start-exam-btn')?.addEventListener('click', () => {
    const cat = container.querySelector('#exam-category')?.value || 'all';
    const shuffle = container.querySelector('#exam-shuffle')?.checked;
    const q = new URLSearchParams({ start: '1', timer: String(timerMinutes) });
    if (cat !== 'all') q.set('category', cat);
    if (shuffle) q.set('shuffle', '1');
    window.location.hash = `#exam?${q.toString()}`;
  });

  container.querySelector('#discard-exam-btn')?.addEventListener('click', () => {
    clearActiveExamSession(testId);
    renderExamSetup(container, { test, testId, allQuestions, categoryStats, saved: null });
  });

  updateSummary();
}

async function runExamSession(container, ctx) {
  const { test, testId } = ctx;
  const allQuestions = ctx.allQuestions || (await getAllQuestions(testId));
  const wantsStartCountdown = Boolean(ctx.fresh);
  let questions;
  let category;
  let timerMinutes;
  let currentIndex;
  let answers;
  let startedAt;
  let timerId = null;
  let timeLeftSec = null;

  if (ctx.saved && !ctx.fresh) {
    const qMap = new Map(allQuestions.map((q) => [q.id, q]));
    questions = ctx.saved.questionIds.map((id) => qMap.get(id)).filter(Boolean);
    category = ctx.saved.category || 'all';
    timerMinutes = ctx.saved.timerMinutes || 0;
    currentIndex = ctx.saved.currentIndex || 0;
    answers = ctx.saved.answers || [];
    startedAt = ctx.saved.startedAt || Date.now();
  } else {
    questions = ctx.questions;
    category = ctx.category;
    timerMinutes = ctx.timerMinutes;
    currentIndex = 0;
    answers = [];
    startedAt = Date.now();
  }

  if (!questions?.length) {
    container.innerHTML = `<div class="empty-state"><p>Exam could not be loaded.</p><a href="#exam" class="btn btn-primary">Back</a></div>`;
    return;
  }

  if (ctx.fresh || ctx.saved) {
    saveActiveExamSession(testId, {
      questionIds: questions.map((q) => q.id),
      category,
      timerMinutes,
      currentIndex,
      answers,
      startedAt,
    });
  }

  function persist() {
    saveActiveExamSession(testId, {
      questionIds: questions.map((q) => q.id),
      category,
      timerMinutes,
      currentIndex,
      answers,
      startedAt,
    });
  }

  function setExamChrome(active) {
    setSessionChrome(active);
  }

  function render() {
    setExamChrome(true);
    const catLabel = category === 'all' ? 'All categories' : category;

    container.innerHTML = `
      <section class="page practice-page practice-session exam-session">
        <div class="practice-session-header">
          <div class="practice-progress-bar">
            <div class="practice-progress-fill" id="exam-progress-fill"></div>
          </div>
          <div class="practice-session-meta">
            <span class="session-settings-chip">Mock exam · ${escapeHtml(catLabel)}</span>
            <div class="practice-session-stats">
              <span id="exam-counter">Question 1 of ${questions.length}</span>
              <span id="exam-timer"></span>
            </div>
          </div>
        </div>
        <div id="exam-content" class="study-content"></div>
        <div class="practice-session-bottom" id="exam-bottom">
          <div id="exam-actions" class="study-actions is-waiting">
            <button type="button" class="btn btn-primary" id="exam-next-btn" disabled>Next Question</button>
          </div>
          <div class="session-exit-actions session-exit-compact">
            <div class="session-exit-buttons">
              <button type="button" class="btn btn-secondary btn-small" id="exam-pause-btn">Pause exam</button>
              <button type="button" class="btn btn-secondary btn-small" id="exam-quit-btn">Quit</button>
            </div>
          </div>
        </div>
      </section>
    `;

    const content = container.querySelector('#exam-content');
    const nextBtn = container.querySelector('#exam-next-btn');
    const counter = container.querySelector('#exam-counter');
    const timerEl = container.querySelector('#exam-timer');
    const progressFill = container.querySelector('#exam-progress-fill');

    if (timerMinutes > 0) {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      timeLeftSec = Math.max(0, timerMinutes * 60 - elapsed);
      timerEl.textContent = formatTime(timeLeftSec);
      timerId = setInterval(() => {
        timeLeftSec--;
        if (timeLeftSec <= 0) {
          clearInterval(timerId);
          finishExam();
          return;
        }
        timerEl.textContent = formatTime(timeLeftSec);
        if (timeLeftSec <= 300) timerEl.classList.add('exam-timer-warning');
      }, 1000);
    } else {
      timerEl.textContent = 'Untimed';
    }

    container.querySelector('#exam-pause-btn')?.addEventListener('click', () => {
      persist();
      setExamChrome(false);
      clearInterval(timerId);
      window.location.hash = '#exam';
    });

    container.querySelector('#exam-quit-btn')?.addEventListener('click', () => {
      if (!confirm('Quit this exam? Progress on this attempt will be lost.')) return;
      clearActiveExamSession(testId);
      clearInterval(timerId);
      setExamChrome(false);
      window.location.hash = '#exam';
    });

    function updateProgress() {
      progressFill.style.width = `${(currentIndex / questions.length) * 100}%`;
      counter.textContent = `Question ${currentIndex + 1} of ${questions.length}`;
    }

    function showComplete() {
      clearInterval(timerId);
      setExamChrome(false);
      clearActiveExamSession(testId);

      const correct = answers.filter((a) => a.correct).length;
      const total = answers.length;
      const pct = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
      const passed = pct >= EXAM_PASS_PERCENT;

      const byCategory = new Map();
      for (const a of answers) {
        const cat = getQuestionCategory(a.question);
        if (!byCategory.has(cat)) byCategory.set(cat, { correct: 0, total: 0 });
        const row = byCategory.get(cat);
        row.total++;
        if (a.correct) row.correct++;
      }

      const bankTotal = allQuestions.length;
      addExamHistoryEntry(testId, {
        category,
        correct,
        total,
        percent: pct,
        passed,
        timerMinutes,
        durationSec: Math.floor((Date.now() - startedAt) / 1000),
        bankTotal,
        isFullExam: category === 'all' && total === bankTotal,
      });

      const catRows = [...byCategory.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, row]) => {
          const p = row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0;
          return `<li><strong>${escapeHtml(name)}</strong> — ${row.correct}/${row.total} (${p}%)</li>`;
        })
        .join('');

      const reviewHtml = answers
        .map((entry, i) => {
          const q = entry.question;
          return `
            <li class="session-review-item ${entry.correct ? 'is-correct' : 'is-incorrect'}">
              <span class="session-review-num">${i + 1}</span>
              <div class="session-review-body">
                <p class="session-review-q">${questionNumberHtml(q.number)}${escapeHtml(truncateText(q.question))}</p>
                <p class="session-review-detail"><span class="session-review-label">Your answer:</span> ${escapeHtml(entry.selectedText || '—')}</p>
                <p class="session-review-detail session-review-correct"><span class="session-review-label">Correct:</span> ${escapeHtml(entry.correctText)}</p>
                ${!entry.correct ? explanationBlockHtml(q) : ''}
              </div>
              <span class="session-review-badge">${entry.correct ? 'Correct' : 'Incorrect'}</span>
            </li>
          `;
        })
        .join('');

      container.innerHTML = `
        <section class="page exam-page">
          <div class="session-complete exam-complete ${passed ? 'exam-passed' : 'exam-failed'}">
            <h2>${passed ? 'Passed!' : 'Keep studying'}</h2>
            <p class="session-score-line">Score: <strong>${correct}</strong> / <strong>${total}</strong> (${pct}%)</p>
            <p class="exam-pass-line">${passed ? `At or above ${EXAM_PASS_PERCENT}% pass threshold.` : `Below ${EXAM_PASS_PERCENT}% — review mistakes and try again.`}</p>
            ${catRows ? `<div class="exam-category-scores"><h3>By category</h3><ul>${catRows}</ul></div>` : ''}
            <div class="session-review">
              <h3>Your answers</h3>
              <ol class="session-review-list">${reviewHtml}</ol>
            </div>
            <div class="success-actions">
              <a href="#practice?focus=mistakes" class="btn btn-primary">Review mistakes</a>
              <a href="#exam" class="btn btn-secondary">New mock exam</a>
              <a href="#home" class="btn btn-secondary">Home</a>
            </div>
          </div>
        </section>
      `;
    }

    function finishExam() {
      currentIndex = questions.length;
      showComplete();
    }

    let pending = null;
    let mcShuffle = null;
    let activeQuestion = null;

    function resetNextButton() {
      nextBtn.disabled = true;
      nextBtn.textContent = 'Next Question';
      const actions = container.querySelector('#exam-actions');
      actions?.classList.add('is-waiting');
      actions?.classList.remove('is-ready');
    }

    function enableNext() {
      nextBtn.disabled = false;
      nextBtn.textContent =
        currentIndex >= questions.length - 1 ? 'Finish exam' : 'Next Question';
      const actions = container.querySelector('#exam-actions');
      actions?.classList.remove('is-waiting');
      actions?.classList.add('is-ready');
      nextBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function handleNext() {
      if (!pending || !activeQuestion || !mcShuffle) return;
      nextBtn.disabled = true;
      const question = activeQuestion;
      const selectedText = mcShuffle.shuffled[pending.selectedIndex]?.text ?? '';
      const correctText =
        mcShuffle.shuffled[mcShuffle.correctIndex]?.text ??
        question.options[question.correctIndex];
      answers.push({
        question,
        correct: pending.correct,
        selectedText,
        correctText,
      });
      currentIndex++;
      pending = null;
      mcShuffle = null;
      activeQuestion = null;
      persist();
      resetNextButton();
      showQuestion();
    }

    nextBtn.addEventListener('click', handleNext);

    function showQuestion() {
      const prevArea = content.querySelector('#exam-question-area');
      if (prevArea) cleanupMcQuestion(prevArea);

      if (currentIndex >= questions.length) {
        showComplete();
        return;
      }

      updateProgress();
      const question = questions[currentIndex];
      activeQuestion = question;
      pending = null;

      content.innerHTML = `
        <p class="practice-hint" id="exam-hint">Mock exam — select your answer, then press Next</p>
        <div id="exam-question-area"></div>
      `;
      const area = content.querySelector('#exam-question-area');

      const mcResult = renderMcQuestion(area, question, {
        selectOnly: true,
        onAnswer: (result) => {
          pending = result;
          const hint = content.querySelector('#exam-hint');
          if (hint) hint.textContent = 'Answer selected — press Next to continue';
          enableNext();
        },
      });
      mcShuffle = { shuffled: mcResult.shuffled, correctIndex: mcResult.correctIndex };
    }

    let pendingExamCountdown = wantsStartCountdown;

    function beginExamQuestions() {
      if (pendingExamCountdown) {
        pendingExamCountdown = false;
        const sessionEl = container.querySelector('.practice-session');
        runSessionCountdown(sessionEl || container).then(() => showQuestion());
        return;
      }
      showQuestion();
    }

    resetNextButton();
    beginExamQuestions();
  }

  render();
}
