import {
  getAllQuestions,
  getAllProgress,
  getProgress,
  getQuestion,
  saveProgress,
  getTest,
  ensureDefaultTest,
} from '../db.js';
import {
  getActiveTestId,
  getPracticeMode,
  setPracticeMode,
  getPracticeCategory,
  setPracticeCategory,
  getSessionSize,
  getSessionSizeIsCustom,
  setSessionSize,
  markDoneForToday,
  clearDoneForToday,
  getActivePracticeSession,
  saveActivePracticeSession,
  clearActivePracticeSession,
} from '../context.js';
import {
  buildSessionQueue,
  buildMistakeQueue,
  buildUnseenQueue,
  analyzeSessionQueue,
  recordAnswer,
  getOrCreateProgress,
  createDefaultProgress,
  buildCategoryStats,
  filterQuestionsByCategory,
  getQuestionCategory,
  resolveQuestionMode,
  estimateMinutes,
  DEFAULT_SESSION_SIZE,
  STAGES,
} from '../srs.js';
import { renderMcQuestion, cleanupMcQuestion } from '../study/mc-mode.js';
import { renderTypeQuestion } from '../study/type-mode.js';
import { escapeHtml, questionNumberHtml, explanationBlockHtml, hasCustomExplanation } from './helpers.js';
import { runSessionCountdown } from './session-countdown.js';
import { setSessionChrome } from './session-chrome.js';
import { guardClick } from './click-guard.js';

async function ensureProgress(questionId) {
  return getOrCreateProgress(questionId, getProgress, saveProgress);
}

function modeLabel(mode) {
  return {
    auto: 'Auto',
    mc: 'Multiple choice only',
    type: 'Type answer only',
  }[mode] || mode;
}

function modeDescription(mode) {
  return {
    auto: 'Each question uses multiple choice or type-from-memory based on your progress with that card.',
    mc: 'Every question is multiple choice with shuffled options.',
    type: 'Every question asks you to type the answer from memory.',
  }[mode];
}

function isDefaultSessionOptions(mode, category, size, sizeCustom, focus) {
  return (
    mode === 'auto' &&
    category === 'all' &&
    !sizeCustom &&
    size === DEFAULT_SESSION_SIZE &&
    focus === 'due'
  );
}

function formatSetupDetail(mode, category, size, preview, focus) {
  const categoryLabel = category === 'all' ? 'All categories' : category;
  const sizeLabel = formatSizeLabel(size);
  const breakdown = analyzeSessionQueue(preview.queue, mode);
  const modeDetail =
    mode === 'auto'
      ? `Auto (${breakdown.mc} MC · ${breakdown.type} type)`
      : modeLabel(mode);
  const focusNote =
    focus === 'mistakes'
      ? ' · Mistakes drill'
      : focus === 'unseen'
        ? ' · New questions only'
        : '';
  return `Answer mode: ${modeDetail} · Category: ${categoryLabel} · Size: ${sizeLabel}${focusNote}`;
}

function serializeSessionAnswers(answers) {
  return answers.map((a) => ({
    questionId: a.question.id,
    correct: a.correct,
    mode: a.mode,
    userInput: a.userInput,
    selectedAnswer: a.selectedAnswer,
    correctAnswer: a.correctAnswer,
  }));
}

function restoreSessionAnswers(saved, allQuestions) {
  const qMap = new Map(allQuestions.map((q) => [q.id, q]));
  return (saved.sessionAnswers || [])
    .map((entry) => {
      const question = qMap.get(entry.questionId);
      if (!question) return null;
      return {
        question,
        correct: entry.correct,
        mode: entry.mode,
        userInput: entry.userInput,
        selectedAnswer: entry.selectedAnswer,
        correctAnswer: entry.correctAnswer,
      };
    })
    .filter(Boolean);
}

function persistSessionState(testId, state) {
  if (!testId || !state.sessionActive) return;
  saveActivePracticeSession(testId, {
    lockedMode: state.lockedMode,
    lockedCategory: state.lockedCategory,
    lockedSize: state.lockedSize,
    sessionFocus: state.sessionFocus,
    queueQuestionIds: state.queue.map((item) => item.question.id),
    currentIndex: state.currentIndex,
    sessionStats: state.sessionStats,
    sessionNewlyMemorized: state.sessionNewlyMemorized,
    totalDue: state.totalDue,
    remainingAfter: state.remainingAfter,
    sessionAnswers: serializeSessionAnswers(state.sessionAnswers || []),
  });
}

function restoreQueueFromSession(saved, allQuestions, progressList) {
  const qMap = new Map(allQuestions.map((q) => [q.id, q]));
  const pMap = new Map(progressList.map((p) => [p.questionId, p]));
  return saved.queueQuestionIds
    .map((id) => {
      const question = qMap.get(id);
      if (!question) return null;
      return {
        question,
        progress: pMap.get(id) || createDefaultProgress(id),
      };
    })
    .filter(Boolean);
}

const PRESET_SESSION_SIZES = [10, 20, 30];
const MAX_CUSTOM_SESSION_SIZE = 500;

function formatSizeLabel(size) {
  return size === 'all' ? 'all due' : size;
}

function formatSessionPreview(preview, setupSize) {
  const parts = [`${preview.totalDue} due overall`, `This session: ${preview.sessionCount}`];
  if (preview.remainingAfterSession > 0) {
    parts.push(`${preview.remainingAfterSession} saved for later`);
  }
  if (typeof setupSize === 'number' && preview.sessionCount < setupSize && preview.totalDue >= setupSize) {
    parts.push(`(fewer than ${setupSize} available right now)`);
  }
  return parts.join(' · ');
}

export async function renderStudy(container, params = {}) {
  await ensureDefaultTest();
  const testId = getActiveTestId();
  const test = testId ? await getTest(testId) : null;

  const allQuestions = await getAllQuestions(testId);
  const qIds = new Set(allQuestions.map((q) => q.id));
  const progressList = (await getAllProgress()).filter((p) => qIds.has(p.questionId));

  if (allQuestions.length === 0) {
    container.innerHTML = `
      <section class="page practice-page">
        <div class="empty-state">
          <h2>No questions yet</h2>
          <p>Add some questions first, then come back here to practice.</p>
          <a href="#add" class="btn btn-primary btn-large">Add Questions</a>
        </div>
      </section>
    `;
    return;
  }

  const categoryStats = buildCategoryStats(allQuestions, progressList);
  const categoryNames = categoryStats.map((c) => c.name);

  let setupMode = params.mode || getPracticeMode();
  if (!['auto', 'mc', 'type'].includes(setupMode)) setupMode = 'auto';

  let setupCategory = 'all';
  if (params.category) {
    const decoded = decodeURIComponent(params.category);
    if (categoryNames.includes(decoded)) setupCategory = decoded;
  } else {
    const saved = getPracticeCategory(testId);
    if (saved !== 'all' && categoryNames.includes(saved)) setupCategory = saved;
  }

  let setupSize = params.quick ? DEFAULT_SESSION_SIZE : getSessionSize();
  let setupSizeCustom = getSessionSizeIsCustom();
  if (params.size) {
    if (params.size === 'all') {
      setupSize = 'all';
      setupSizeCustom = false;
    } else {
      const s = parseInt(params.size, 10);
      if (Number.isFinite(s) && s > 0) {
        setupSize = Math.min(s, MAX_CUSTOM_SESSION_SIZE);
        setupSizeCustom = !PRESET_SESSION_SIZES.includes(setupSize);
      }
    }
  }
  if (setupSize === 'all') setupSizeCustom = false;

  let setupExpanded = params.setup === '1' || params.setup === true;
  let sessionFocus = ['mistakes', 'unseen'].includes(params.focus) ? params.focus : 'due';

  let sessionActive = false;
  let lockedMode = setupMode;
  let lockedCategory = setupCategory;
  let lockedSize = setupSize;
  let lockedFocus = sessionFocus;
  let queue = [];
  let totalDue = 0;
  let remainingAfter = 0;
  let sessionNewlyMemorized = 0;
  let currentIndex = 0;
  let sessionStats = { correct: 0, total: 0 };
  let sessionAnswers = [];
  let showingResult = false;
  let pendingSessionCountdown = false;
  let resumingSession = false;

  if (params.quick === '1' || params.quick === true) {
    clearDoneForToday(testId);
  }

  function getFilteredQuestions() {
    return filterQuestionsByCategory(allQuestions, setupCategory);
  }

  function buildQueueForFocus(filtered) {
    if (sessionFocus === 'mistakes') {
      return buildMistakeQueue(filtered, progressList, { sessionSize: setupSize });
    }
    if (sessionFocus === 'unseen') {
      return buildUnseenQueue(filtered, progressList, { sessionSize: setupSize });
    }
    return buildSessionQueue(filtered, progressList, { sessionSize: setupSize });
  }

  function getPreview() {
    const filtered = getFilteredQuestions();
    return buildQueueForFocus(filtered);
  }

  function focusLabel() {
    if (sessionFocus === 'mistakes') return 'Review mistakes';
    if (sessionFocus === 'unseen') return 'New questions';
    return null;
  }

  function render() {
    sessionActive ? renderSession() : renderSetup();
  }

  function renderResumeBanner(saved) {
    const at = Math.min(saved.currentIndex + 1, saved.queueQuestionIds.length);
    const total = saved.queueQuestionIds.length;
    const score = saved.sessionStats || { correct: 0, total: 0 };
    return `
      <div class="resume-session-banner">
        <p>Saved session: question <strong>${at}</strong> of <strong>${total}</strong> (${score.correct}/${score.total} correct so far)</p>
        <div class="resume-session-actions">
          <button type="button" class="btn btn-primary btn-small" id="resume-session-btn">Resume session</button>
          <button type="button" class="btn btn-secondary btn-small" id="discard-session-btn">Discard &amp; start new</button>
        </div>
      </div>
    `;
  }

  function renderSetup() {
    setPracticeSessionChrome(false);
    const preview = getPreview();
    const mins = estimateMinutes(preview.sessionCount);
    const savedSession = getActivePracticeSession(testId);
    const showResume =
      savedSession && savedSession.currentIndex < savedSession.queueQuestionIds.length;

    const customSizeActive = setupSizeCustom;
    const customSizeValue = typeof setupSize === 'number' ? setupSize : DEFAULT_SESSION_SIZE;
    const usingDefaults = isDefaultSessionOptions(
      setupMode,
      setupCategory,
      setupSize,
      setupSizeCustom,
      sessionFocus
    );

    container.innerHTML = `
      <section class="page practice-page">
        <header class="page-header">
          <p class="breadcrumb">${test ? escapeHtml(test.name) : 'Practice Test'} › Practice</p>
          <h1>Practice</h1>
        </header>

        ${showResume ? renderResumeBanner(savedSession) : ''}
        ${focusLabel() ? `<div class="session-focus-banner">${escapeHtml(focusLabel())}</div>` : ''}

        <div class="practice-quick-start">
          <p class="setup-summary-main"><strong>${preview.sessionCount}</strong> questions · ~${mins} min</p>
          <p class="setup-summary-detail">${escapeHtml(formatSetupDetail(setupMode, setupCategory, setupSize, preview, sessionFocus))}</p>
          ${
            usingDefaults
              ? '<p class="setup-defaults-note">Default spaced-repetition session (20 questions, all categories, auto answer mode).</p>'
              : '<p class="setup-defaults-note setup-custom-note">Custom session — change options below anytime.</p>'
          }
          <div class="practice-quick-start-actions">
            ${
              preview.sessionCount === 0
                ? '<p class="setup-warning">Nothing to practice with these options.</p>'
                : `<button type="button" class="btn btn-primary btn-large" id="start-practice-btn">Start Practice</button>`
            }
            <button
              type="button"
              class="btn btn-secondary btn-large ${setupExpanded ? 'is-active' : ''}"
              id="toggle-setup-btn"
              aria-expanded="${setupExpanded}"
            >
              ${setupExpanded ? 'Hide options' : 'Adjust session'}
            </button>
          </div>
        </div>

        <div class="practice-setup-grid ${setupExpanded ? '' : 'hidden'}">
          <div class="setup-panel">
            <h2>How to practice</h2>
            <div class="practice-mode-options" role="group">
              <button type="button" class="mode-chip ${setupMode === 'auto' ? 'active' : ''}" data-mode="auto" title="Picks MC or type per question based on your SRS stage">Auto</button>
              <button type="button" class="mode-chip ${setupMode === 'mc' ? 'active' : ''}" data-mode="mc">Multiple choice</button>
              <button type="button" class="mode-chip ${setupMode === 'type' ? 'active' : ''}" data-mode="type">Type answer</button>
            </div>
            <p class="setup-desc">${modeDescription(setupMode)}</p>
          </div>

          <div class="setup-panel">
            <h2>Category</h2>
            <select id="setup-category" class="category-filter-select">
              <option value="all" ${setupCategory === 'all' ? 'selected' : ''}>All categories</option>
              ${categoryStats
                .map((c) => {
                  const val = c.name.replace(/"/g, '&quot;');
                  return `<option value="${val}" ${c.name === setupCategory ? 'selected' : ''}>${escapeHtml(c.name)} (${c.stillLearning} learning)</option>`;
                })
                .join('')}
            </select>
            <p class="setup-desc" id="setup-category-desc"></p>
          </div>

          <div class="setup-panel">
            <h2>Session size</h2>
            <div class="size-options" role="group">
              ${[10, 20, 30, 'all', 'custom']
                .map((s) => {
                  const active = s === 'custom' ? customSizeActive : setupSize === s;
                  const label =
                    s === 'all' ? 'All due' : s === 'custom' ? 'Custom' : s;
                  return `
                <button type="button" class="mode-chip ${active ? 'active' : ''}" data-size="${s}">
                  ${label}
                </button>
              `;
                })
                .join('')}
            </div>
            <div class="size-custom-field ${customSizeActive ? '' : 'hidden'}" id="size-custom-field">
              <input
                type="number"
                id="setup-size-custom"
                class="size-custom-input"
                min="1"
                max="${MAX_CUSTOM_SESSION_SIZE}"
                value="${customSizeValue}"
                aria-label="Custom session size"
              />
              <span class="size-custom-suffix">questions</span>
            </div>
            <p class="setup-desc">${formatSessionPreview(preview, setupSize)}</p>
          </div>
        </div>
      </section>
    `;

    updateSetupCategoryDesc();
    bindSetupHandlers();
    container.querySelector('#resume-session-btn')?.addEventListener('click', (e) => {
      resumeSession(savedSession, e.currentTarget);
    });
    container.querySelector('#discard-session-btn')?.addEventListener('click', () => {
      clearActivePracticeSession(testId);
      renderSetup();
    });
  }

  function updateSetupCategoryDesc() {
    const el = container.querySelector('#setup-category-desc');
    if (!el) return;
    if (setupCategory === 'all') {
      el.textContent = 'Questions from every category.';
      return;
    }
    const cat = categoryStats.find((c) => c.name === setupCategory);
    if (!cat) return;
    el.textContent = cat.isComplete
      ? 'Category complete — all memorized!'
      : `${cat.masteredPercent}% memorized · ~${cat.sessionsLeft} sessions at ${setupSize === 'all' ? 20 : setupSize}/day`;
  }

  function refreshSetupSummary() {
    const preview = getPreview();
    const mins = estimateMinutes(preview.sessionCount);
    const usingDefaults = isDefaultSessionOptions(
      setupMode,
      setupCategory,
      setupSize,
      setupSizeCustom,
      sessionFocus
    );
    const quickStart = container.querySelector('.practice-quick-start');
    if (quickStart) {
      const main = quickStart.querySelector('.setup-summary-main');
      const detail = quickStart.querySelector('.setup-summary-detail');
      const defaultsNote = quickStart.querySelector('.setup-defaults-note');
      if (main) main.innerHTML = `<strong>${preview.sessionCount}</strong> questions · ~${mins} min`;
      if (detail) {
        detail.textContent = formatSetupDetail(
          setupMode,
          setupCategory,
          setupSize,
          preview,
          sessionFocus
        );
      }
      if (defaultsNote) {
        defaultsNote.textContent = usingDefaults
          ? 'Default spaced-repetition session (20 questions, all categories, auto answer mode).'
          : 'Custom session — change options below anytime.';
        defaultsNote.classList.toggle('setup-custom-note', !usingDefaults);
      }
    }
    const modeDesc = container.querySelector('.setup-panel:nth-child(1) .setup-desc');
    if (modeDesc) modeDesc.textContent = modeDescription(setupMode);
    const sizeDesc = container.querySelector('.setup-panel:nth-child(3) .setup-desc');
    if (sizeDesc) sizeDesc.textContent = formatSessionPreview(preview, setupSize);
    updateSetupCategoryDesc();
    updateSizeSelectionUI();
    updateSetupStartButton(preview);
  }

  function updateSizeSelectionUI() {
    container.querySelectorAll('[data-size]').forEach((chip) => {
      const size = chip.dataset.size;
      const active =
        size === 'custom' ? setupSizeCustom : !setupSizeCustom && size === String(setupSize);
      chip.classList.toggle('active', active);
    });
    container.querySelector('#size-custom-field')?.classList.toggle('hidden', !setupSizeCustom);
    const input = container.querySelector('#setup-size-custom');
    if (input && setupSizeCustom && typeof setupSize === 'number') {
      input.value = setupSize;
    }
  }

  function applyCustomSessionSize(rawValue) {
    let val = parseInt(rawValue, 10);
    if (!Number.isFinite(val) || val < 1) val = 1;
    if (val > MAX_CUSTOM_SESSION_SIZE) val = MAX_CUSTOM_SESSION_SIZE;
    setupSizeCustom = true;
    setupSize = val;
    updateSizeSelectionUI();
    refreshSetupSummary();
    return val;
  }

  function updateSetupStartButton(preview) {
    const actions = container.querySelector('.practice-quick-start-actions');
    if (!actions) return;
    actions.querySelector('#start-practice-btn')?.remove();
    actions.querySelector('.setup-warning')?.remove();
    if (preview.sessionCount === 0) {
      const toggleBtn = actions.querySelector('#toggle-setup-btn');
      const warning = document.createElement('p');
      warning.className = 'setup-warning';
      warning.textContent = 'Nothing to practice with these options.';
      toggleBtn?.insertAdjacentElement('beforebegin', warning);
      return;
    }
    const toggleBtn = actions.querySelector('#toggle-setup-btn');
    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'btn btn-primary btn-large';
    startBtn.id = 'start-practice-btn';
    startBtn.textContent = 'Start Practice';
    toggleBtn?.insertAdjacentElement('beforebegin', startBtn);
    startBtn.addEventListener('click', () => startSession(startBtn));
  }

  function bindSetupHandlers() {
    container.querySelector('#toggle-setup-btn')?.addEventListener('click', () => {
      setupExpanded = !setupExpanded;
      const grid = container.querySelector('.practice-setup-grid');
      const btn = container.querySelector('#toggle-setup-btn');
      grid?.classList.toggle('hidden', !setupExpanded);
      if (btn) {
        btn.textContent = setupExpanded ? 'Hide options' : 'Adjust session';
        btn.classList.toggle('is-active', setupExpanded);
        btn.setAttribute('aria-expanded', String(setupExpanded));
      }
    });
    container.querySelectorAll('[data-mode]').forEach((chip) => {
      chip.addEventListener('click', () => {
        setupMode = chip.dataset.mode;
        container.querySelectorAll('[data-mode]').forEach((c) => c.classList.toggle('active', c.dataset.mode === setupMode));
        refreshSetupSummary();
      });
    });

    container.querySelector('#setup-category')?.addEventListener('change', (e) => {
      setupCategory = e.target.value;
      refreshSetupSummary();
    });

    container.querySelectorAll('[data-size]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const size = chip.dataset.size;
        if (size === 'custom') {
          setupSizeCustom = true;
          if (setupSize === 'all' || typeof setupSize !== 'number') {
            setupSize = DEFAULT_SESSION_SIZE;
          }
          updateSizeSelectionUI();
          refreshSetupSummary();
          container.querySelector('#setup-size-custom')?.focus();
          return;
        }
        setupSizeCustom = false;
        setupSize = size === 'all' ? 'all' : parseInt(size, 10);
        updateSizeSelectionUI();
        refreshSetupSummary();
      });
    });

    const customSizeInput = container.querySelector('#setup-size-custom');
    customSizeInput?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (Number.isFinite(val) && val > 0) {
        setupSizeCustom = true;
        setupSize = Math.min(val, MAX_CUSTOM_SESSION_SIZE);
        updateSizeSelectionUI();
        refreshSetupSummary();
      }
    });
    customSizeInput?.addEventListener('change', (e) => {
      e.target.value = applyCustomSessionSize(e.target.value);
    });

    container.querySelector('#start-practice-btn')?.addEventListener('click', (e) => {
      startSession(e.currentTarget);
    });
  }

  function applySessionFromQueue(
    built,
    startIndex = 0,
    stats = { correct: 0, total: 0 },
    memorized = 0,
    answers = []
  ) {
    lockedMode = setupMode;
    lockedCategory = setupCategory;
    lockedSize = setupSize;
    lockedFocus = sessionFocus;
    queue = built.queue;
    totalDue = built.totalDue;
    remainingAfter = built.remainingAfterSession;
    currentIndex = startIndex;
    sessionStats = stats;
    sessionAnswers = answers;
    sessionNewlyMemorized = memorized;
    sessionActive = true;
    setPracticeMode(lockedMode);
    setPracticeCategory(testId, lockedCategory);
    setSessionSize(lockedSize, setupSizeCustom);
    persistSessionState(testId, {
      sessionActive,
      lockedMode,
      lockedCategory,
      lockedSize,
      sessionFocus,
      queue,
      currentIndex,
      sessionStats,
      sessionNewlyMemorized,
      sessionAnswers,
      totalDue,
      remainingAfter,
    });
    renderSession();
  }

  function startSession(triggerBtn = null) {
    if (sessionActive || pendingSessionCountdown) return;
    if (triggerBtn) triggerBtn.disabled = true;
    clearActivePracticeSession(testId);
    pendingSessionCountdown = true;
    const filtered = filterQuestionsByCategory(allQuestions, setupCategory);
    const built = buildQueueForFocus(filtered);
    applySessionFromQueue(built);
  }

  async function refreshProgressList() {
    const fresh = await getAllProgress();
    progressList.length = 0;
    progressList.push(...fresh.filter((p) => qIds.has(p.questionId)));
  }

  async function resumeSession(saved, triggerBtn = null) {
    if (sessionActive || resumingSession) return;
    resumingSession = true;
    if (triggerBtn) triggerBtn.disabled = true;
    await refreshProgressList();
    setupMode = saved.lockedMode;
    lockedMode = saved.lockedMode;
    lockedCategory = saved.lockedCategory;
    lockedSize = saved.lockedSize;
    lockedFocus = saved.sessionFocus || 'due';
    setupCategory = saved.lockedCategory;
    setupSize = saved.lockedSize;
    sessionFocus = lockedFocus;
    queue = restoreQueueFromSession(saved, allQuestions, progressList);
    if (queue.length === 0) {
      clearActivePracticeSession(testId);
      renderSetup();
      return;
    }
    currentIndex = Math.min(saved.currentIndex, queue.length);
    sessionStats = saved.sessionStats || { correct: 0, total: 0 };
    sessionAnswers = restoreSessionAnswers(saved, allQuestions);
    sessionNewlyMemorized = saved.sessionNewlyMemorized || 0;
    totalDue = saved.totalDue || queue.length;
    remainingAfter = saved.remainingAfter || 0;
    sessionActive = true;
    renderSession();
  }

  function saveAndExitSession() {
    setPracticeSessionChrome(false);
    if (sessionActive && currentIndex < queue.length) {
      persistSessionState(testId, {
        sessionActive,
        lockedMode,
        lockedCategory,
        lockedSize,
        sessionFocus: lockedFocus,
        queue,
        currentIndex,
        sessionStats,
        sessionNewlyMemorized,
        sessionAnswers,
        totalDue,
        remainingAfter,
      });
    } else {
      clearActivePracticeSession(testId);
    }
    sessionActive = false;
    window.location.hash = '#home';
  }

  function exitAndRestartSession() {
    if (
      currentIndex < queue.length &&
      !confirm(
        'Exit and start a new session? Answers you already submitted stay saved, but your place in this session will be lost.'
      )
    ) {
      return;
    }
    clearActivePracticeSession(testId);
    sessionActive = false;
    window.location.hash = '#practice?setup=1';
  }

  function endSessionToSetup() {
    setPracticeSessionChrome(false);
    clearActivePracticeSession(testId);
    sessionActive = false;
    setupMode = lockedMode;
    setupCategory = lockedCategory;
    setupSize = lockedSize;
    renderSetup();
  }

  function setPracticeSessionChrome(active) {
    setSessionChrome(active);
  }

  function formatAnswerFeedback(result, mode, correctIndex) {
    if (mode === 'mc') {
      const letters = ['A', 'B', 'C', 'D'];
      return result.correct
        ? 'Correct!'
        : `Incorrect — the answer is ${letters[correctIndex]}.`;
    }
    return result.correct ? 'Marked correct' : 'Marked incorrect';
  }

  function truncateText(text, max = 120) {
    if (!text || text.length <= max) return text || '';
    return `${text.slice(0, max)}…`;
  }

  function getSessionReviewAnswerLines(entry) {
    const q = entry.question;
    const correctText = entry.correctAnswer ?? q.options[q.correctIndex] ?? '—';
    let yourText = '—';
    if (entry.mode === 'type') {
      yourText = entry.userInput?.trim() ? entry.userInput : '(blank)';
    } else if (entry.mode === 'mc') {
      yourText = entry.selectedAnswer ?? '—';
    }
    return { yourText, correctText };
  }

  function renderSessionReviewItem(entry, index) {
    const q = entry.question;
    const { yourText, correctText } = getSessionReviewAnswerLines(entry);
    return `
      <li class="session-review-item ${entry.correct ? 'is-correct' : 'is-incorrect'}">
        <span class="session-review-num">${index + 1}</span>
        <div class="session-review-body">
          <p class="session-review-q">${questionNumberHtml(q.number)}${escapeHtml(truncateText(q.question))}</p>
          <p class="session-review-detail"><span class="session-review-label">Your answer:</span> ${escapeHtml(yourText)}</p>
          <p class="session-review-detail session-review-correct"><span class="session-review-label">Correct:</span> ${escapeHtml(correctText)}</p>
          ${!entry.correct ? explanationBlockHtml(q) : ''}
        </div>
        <span class="session-review-badge">${entry.correct ? 'Correct' : 'Incorrect'}</span>
      </li>
    `;
  }

  function renderSession() {
    setPracticeSessionChrome(true);
    const sizeLabel = lockedSize === 'all' ? 'All due' : lockedSize;
    const categoryLabel =
      lockedCategory === 'all' ? 'All categories' : escapeHtml(lockedCategory);

    container.innerHTML = `
      <section class="page practice-page practice-session">
        <div class="practice-session-header">
          <div class="practice-progress-bar">
            <div class="practice-progress-fill" id="progress-fill"></div>
          </div>
          <div class="practice-session-meta">
            <span class="session-settings-chip">${modeLabel(lockedMode)} · ${categoryLabel} · ${sizeLabel}</span>
            <div class="practice-session-stats">
              <span id="study-counter">Question ${currentIndex + 1} of ${queue.length}</span>
              <span id="study-score">Correct: ${sessionStats.correct} / ${sessionStats.total}</span>
            </div>
          </div>
        </div>

        <div id="study-content" class="study-content"></div>

        <div class="practice-session-bottom" id="practice-session-bottom">
          <div id="answer-feedback" class="answer-feedback" aria-live="polite"></div>
          <div id="answer-explanation" class="answer-explanation-panel hidden" role="note" aria-live="polite"></div>
          <div id="study-actions" class="study-actions is-waiting">
            <button type="button" class="btn btn-primary" id="next-btn" disabled>Next Question</button>
          </div>
          <div class="session-exit-actions session-exit-compact">
            <div class="session-exit-buttons">
              <button type="button" class="btn btn-secondary btn-small" id="save-exit-btn">Save &amp; exit</button>
              <button type="button" class="btn btn-secondary btn-small" id="exit-restart-btn">Exit</button>
            </div>
          </div>
        </div>
      </section>
    `;

    container.querySelector('#save-exit-btn').addEventListener('click', () => {
      if (
        currentIndex < queue.length &&
        !confirm('Save progress and exit? You can resume this session from Practice later.')
      ) {
        return;
      }
      saveAndExitSession();
    });

    container.querySelector('#exit-restart-btn').addEventListener('click', exitAndRestartSession);

    const content = container.querySelector('#study-content');
    const actions = container.querySelector('#study-actions');
    const answerFeedback = container.querySelector('#answer-feedback');
    const nextBtn = container.querySelector('#next-btn');
    const counter = container.querySelector('#study-counter');
    const scoreEl = container.querySelector('#study-score');
    const progressFill = container.querySelector('#progress-fill');
    const sessionBottom = container.querySelector('#practice-session-bottom');

    function updateProgressBar(completedCount = currentIndex) {
      if (!progressFill || queue.length === 0) return;
      const pct = Math.min(100, (completedCount / queue.length) * 100);
      progressFill.style.width = `${pct}%`;
    }

    function hideSessionBottom() {
      sessionBottom?.classList.add('hidden');
    }

    function showSessionBottom() {
      sessionBottom?.classList.remove('hidden');
    }

    const explanationPanel = container.querySelector('#answer-explanation');

    function clearAnswerFeedback() {
      if (!answerFeedback) return;
      answerFeedback.textContent = '';
      answerFeedback.className = 'answer-feedback';
      explanationPanel?.classList.add('hidden');
      if (explanationPanel) explanationPanel.innerHTML = '';
    }

    function showAnswerFeedback(text, correct, question = null) {
      if (!answerFeedback) return;
      answerFeedback.textContent = text;
      answerFeedback.className = `answer-feedback ${correct ? 'correct' : 'incorrect'} is-visible`;
      if (explanationPanel && question && hasCustomExplanation(question)) {
        explanationPanel.innerHTML = explanationBlockHtml(question);
        explanationPanel.classList.remove('hidden');
      }
    }

    function setStudyActionsReady(ready) {
      actions?.classList.toggle('is-ready', ready);
      actions?.classList.toggle('is-waiting', !ready);
      if (!nextBtn) return;
      nextBtn.disabled = !ready;
      if (ready) delete nextBtn.dataset.busy;
      nextBtn.textContent =
        ready && currentIndex >= queue.length - 1 ? 'Finish' : 'Next Question';
    }

    const keyHandler = (e) => {
      if (e.key === 'Enter' && showingResult && !e.target.closest('form')) {
        e.preventDefault();
        nextBtn.click();
      }
    };
    document.addEventListener('keydown', keyHandler);

    function renderSessionComplete({ doneForToday = false } = {}) {
      document.removeEventListener('keydown', keyHandler);
      const reviewHtml = sessionAnswers.map(renderSessionReviewItem).join('');

      content.innerHTML = `
        <div class="session-complete ${doneForToday ? 'done-today' : ''}">
          <h2>${doneForToday ? "You're done for today!" : 'Session complete!'}</h2>
          <p class="session-score-line">You got <strong>${sessionStats.correct}</strong> out of <strong>${sessionStats.total}</strong> correct.</p>
          ${sessionNewlyMemorized > 0 ? `<p class="success-msg">+${sessionNewlyMemorized} newly memorized this session</p>` : ''}
          ${
            doneForToday
              ? remainingAfter > 0
                ? `<p>${remainingAfter} more ready to review — come back tomorrow or practice more when ready.</p>`
                : '<p>All caught up for now. Great work!</p>'
              : ''
          }
          <div class="session-review">
            <h3>Your answers</h3>
            <ol class="session-review-list">${reviewHtml}</ol>
          </div>
          <div class="success-actions">
            ${
              doneForToday
                ? `<a href="#home" class="btn btn-primary">Back to Home</a>
                   ${remainingAfter > 0 ? '<button type="button" class="btn btn-secondary" id="more-btn">Practice more</button>' : ''}`
                : `<button type="button" class="btn btn-primary" id="done-today-btn">Done for today</button>
                   ${remainingAfter > 0 ? '<button type="button" class="btn btn-secondary" id="more-btn">Practice more</button>' : ''}
                   <a href="#home" class="btn btn-secondary">Back to Home</a>`
            }
          </div>
        </div>
      `;

      counter.textContent = 'Session complete';
      scoreEl.textContent = `${sessionStats.correct} / ${sessionStats.total} correct`;
      updateProgressBar(queue.length);
      hideSessionBottom();
      container.querySelector('.practice-session')?.classList.add('is-finished');
      setPracticeSessionChrome(false);
      clearActivePracticeSession(testId);

      content.querySelector('#done-today-btn')?.addEventListener('click', () => {
        markDoneForToday(testId);
        renderSessionComplete({ doneForToday: true });
      });
      content.querySelector('#more-btn')?.addEventListener('click', () => {
        if (doneForToday) clearDoneForToday(testId);
        endSessionToSetup();
      });
    }

    async function showQuestion() {
      cleanupMcQuestion(content);
      showingResult = false;
      setStudyActionsReady(false);
      clearAnswerFeedback();

      if (currentIndex >= queue.length) {
        renderSessionComplete();
        return;
      }

      showSessionBottom();

      const { question, progress } = queue[currentIndex];
      const wasMastered = progress.stage === STAGES.MASTERED;
      const mode = resolveQuestionMode(progress, lockedMode);

      counter.textContent = `Question ${currentIndex + 1} of ${queue.length}`;
      updateProgressBar(currentIndex);

      const catTag =
        lockedCategory === 'all' && getQuestionCategory(question) !== 'Uncategorized'
          ? `<span class="practice-cat-tag">${escapeHtml(getQuestionCategory(question))}</span>`
          : '';

      content.innerHTML = `
        <p class="practice-hint">${mode === 'type' ? 'Type your answer, then check and self-grade' : 'Pick the correct answer'} ${catTag}</p>
        <div id="question-area"></div>
      `;
      const area = content.querySelector('#question-area');
      let currentMcShuffle = null;

      const handleAnswer = async (result) => {
        if (showingResult) return;
        showingResult = true;
        sessionStats.total++;
        if (result.correct) sessionStats.correct++;
        scoreEl.textContent = `Correct: ${sessionStats.correct} / ${sessionStats.total}`;
        updateProgressBar(currentIndex + 1);

        const correctAnswerText = question.options[question.correctIndex];
        let selectedAnswerText = null;
        if (result.mode === 'mc' && currentMcShuffle) {
          selectedAnswerText = currentMcShuffle.shuffled[result.selectedIndex]?.text ?? null;
        }

        sessionAnswers.push({
          question,
          correct: result.correct,
          mode: result.mode,
          userInput: result.input,
          selectedAnswer: selectedAnswerText,
          correctAnswer:
            result.mode === 'mc' && currentMcShuffle
              ? currentMcShuffle.shuffled[currentMcShuffle.correctIndex]?.text ?? correctAnswerText
              : correctAnswerText,
        });

        const currentProgress = await ensureProgress(question.id);
        const updated = recordAnswer(currentProgress, result.correct, result.mode);
        await saveProgress(updated);
        queue[currentIndex].progress = updated;

        if (!wasMastered && updated.stage === STAGES.MASTERED) {
          sessionNewlyMemorized++;
        }

        persistSessionState(testId, {
          sessionActive,
          lockedMode,
          lockedCategory,
          lockedSize,
          sessionFocus: lockedFocus,
          queue,
          currentIndex,
          sessionStats,
          sessionNewlyMemorized,
          sessionAnswers,
          totalDue,
          remainingAfter,
        });

        const freshQuestion = (await getQuestion(question.id)) || question;
        queue[currentIndex].question = freshQuestion;

        if (mode === 'mc') {
          renderMcQuestion(area, freshQuestion, {
            onAnswer: () => {},
            showResult: result,
            shuffle: currentMcShuffle,
            compact: true,
          });
          showAnswerFeedback(
            formatAnswerFeedback(result, mode, currentMcShuffle?.correctIndex ?? freshQuestion.correctIndex),
            result.correct,
            freshQuestion
          );
        } else {
          renderTypeQuestion(area, freshQuestion, {
            onAnswer: () => {},
            showResult: result,
          });
          showAnswerFeedback(formatAnswerFeedback(result, mode), result.correct, freshQuestion);
        }

        setStudyActionsReady(true);
        nextBtn?.focus({ preventScroll: true });
      };

      if (mode === 'mc') {
        const mcResult = renderMcQuestion(area, question, { onAnswer: handleAnswer });
        currentMcShuffle = { shuffled: mcResult.shuffled, correctIndex: mcResult.correctIndex };
      } else {
        renderTypeQuestion(area, question, { onAnswer: handleAnswer });
      }
    }

    guardClick(nextBtn, () => {
      if (!showingResult) return;
      currentIndex++;
      persistSessionState(testId, {
        sessionActive,
        lockedMode,
        lockedCategory,
        lockedSize,
        sessionFocus: lockedFocus,
        queue,
        currentIndex,
        sessionStats,
        sessionNewlyMemorized,
        sessionAnswers,
        totalDue,
        remainingAfter,
      });
      showQuestion();
    });

    function beginSessionQuestions() {
      if (pendingSessionCountdown) {
        pendingSessionCountdown = false;
        const sessionEl = container.querySelector('.practice-session');
        runSessionCountdown(sessionEl || container).then(() => showQuestion());
        return;
      }
      showQuestion();
    }

    beginSessionQuestions();
  }

  const savedSession = getActivePracticeSession(testId);
  const wantsQuickStart = params.quick === '1' || params.quick === true;
  const wantsFocusStart = sessionFocus === 'mistakes' || sessionFocus === 'unseen';
  const wantsSetup = params.setup === '1' || params.setup === true;

  if (wantsQuickStart || wantsFocusStart) {
    clearActivePracticeSession(testId);
    const preview = getPreview();
    if (preview.sessionCount > 0) {
      startSession();
      return;
    }
  } else if (
    !wantsSetup &&
    savedSession &&
    savedSession.currentIndex < savedSession.queueQuestionIds.length
  ) {
    resumeSession(savedSession);
    return;
  }

  render();
}
