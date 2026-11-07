import { DEFAULT_SESSION_SIZE } from './srs.js';
import { toLocalDateKey } from './date-utils.js';

const ACTIVE_TEST_KEY = 'activeTestId';
const PRACTICE_MODE_KEY = 'practiceMode';
const PRACTICE_CATEGORY_KEY = 'practiceCategoryByTest';
const STUDY_CATEGORY_KEY = 'studyCategoryByTest';
const SESSION_SIZE_KEY = 'sessionSize';
const SESSION_SIZE_CUSTOM_KEY = 'sessionSizeIsCustom';
const DONE_TODAY_KEY = 'doneForToday';
const ONBOARDING_KEY = 'onboardingComplete';
const HELP_EXPANDED_KEY = 'helpExpanded';
const ACTIVE_SESSION_KEY = 'activePracticeSession';
const ACTIVE_EXAM_KEY = 'activeExamSession';
const EXAM_HISTORY_KEY = 'examHistory';

function readCategoryMap() {
  try {
    return JSON.parse(localStorage.getItem(PRACTICE_CATEGORY_KEY) || '{}');
  } catch {
    return {};
  }
}

function todayKey() {
  return toLocalDateKey();
}

export function getActiveTestId() {
  return localStorage.getItem(ACTIVE_TEST_KEY) || null;
}

export function setActiveTestId(testId) {
  if (testId) {
    localStorage.setItem(ACTIVE_TEST_KEY, testId);
  } else {
    localStorage.removeItem(ACTIVE_TEST_KEY);
  }
}

/** @returns {'auto' | 'mc' | 'type'} */
export function getPracticeMode() {
  const mode = localStorage.getItem(PRACTICE_MODE_KEY);
  return mode === 'mc' || mode === 'type' ? mode : 'auto';
}

export function setPracticeMode(mode) {
  localStorage.setItem(PRACTICE_MODE_KEY, mode);
}

export function getPracticeCategory(testId) {
  if (!testId) return 'all';
  return readCategoryMap()[testId] || 'all';
}

export function setPracticeCategory(testId, category) {
  if (!testId) return;
  const map = readCategoryMap();
  if (!category || category === 'all') {
    delete map[testId];
  } else {
    map[testId] = category;
  }
  localStorage.setItem(PRACTICE_CATEGORY_KEY, JSON.stringify(map));
}

function readStudyCategoryMap() {
  try {
    return JSON.parse(localStorage.getItem(STUDY_CATEGORY_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getStudyCategory(testId) {
  if (!testId) return 'all';
  return readStudyCategoryMap()[testId] || 'all';
}

export function setStudyCategory(testId, category) {
  if (!testId) return;
  const map = readStudyCategoryMap();
  if (!category || category === 'all') {
    delete map[testId];
  } else {
    map[testId] = category;
  }
  localStorage.setItem(STUDY_CATEGORY_KEY, JSON.stringify(map));
}

export function getSessionSize() {
  const raw = localStorage.getItem(SESSION_SIZE_KEY);
  if (raw === 'all') return 'all';
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_SESSION_SIZE;
}

export function getSessionSizeIsCustom() {
  return localStorage.getItem(SESSION_SIZE_CUSTOM_KEY) === '1';
}

export function setSessionSize(size, isCustom = false) {
  localStorage.setItem(SESSION_SIZE_KEY, String(size));
  if (isCustom) {
    localStorage.setItem(SESSION_SIZE_CUSTOM_KEY, '1');
  } else {
    localStorage.removeItem(SESSION_SIZE_CUSTOM_KEY);
  }
}

export function isDoneForToday(testId) {
  if (!testId) return false;
  try {
    const map = JSON.parse(localStorage.getItem(DONE_TODAY_KEY) || '{}');
    return map[testId] === todayKey();
  } catch {
    return false;
  }
}

export function markDoneForToday(testId) {
  if (!testId) return;
  try {
    const map = JSON.parse(localStorage.getItem(DONE_TODAY_KEY) || '{}');
    map[testId] = todayKey();
    localStorage.setItem(DONE_TODAY_KEY, JSON.stringify(map));
  } catch {
    localStorage.setItem(DONE_TODAY_KEY, JSON.stringify({ [testId]: todayKey() }));
  }
}

export function clearDoneForToday(testId) {
  if (!testId) return;
  try {
    const map = JSON.parse(localStorage.getItem(DONE_TODAY_KEY) || '{}');
    delete map[testId];
    localStorage.setItem(DONE_TODAY_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function isOnboardingComplete() {
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function setOnboardingComplete() {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

export function isHelpExpanded() {
  return localStorage.getItem(HELP_EXPANDED_KEY) === '1';
}

export function setHelpExpanded(expanded) {
  localStorage.setItem(HELP_EXPANDED_KEY, expanded ? '1' : '0');
}

function readSessionMap() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY) || '{}');
  } catch {
    return {};
  }
}

/** @returns {object|null} */
export function getActivePracticeSession(testId) {
  if (!testId) return null;
  const saved = readSessionMap()[testId];
  if (!saved || saved.testId !== testId) return null;
  return saved;
}

export function saveActivePracticeSession(testId, session) {
  if (!testId || !session) return;
  const map = readSessionMap();
  map[testId] = { ...session, testId, savedAt: new Date().toISOString() };
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(map));
}

export function clearActivePracticeSession(testId) {
  if (!testId) return;
  const map = readSessionMap();
  delete map[testId];
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(map));
}

function readExamSessionMap() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_EXAM_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getActiveExamSession(testId) {
  if (!testId) return null;
  const saved = readExamSessionMap()[testId];
  if (!saved || saved.testId !== testId) return null;
  return saved;
}

export function saveActiveExamSession(testId, session) {
  if (!testId || !session) return;
  const map = readExamSessionMap();
  map[testId] = { ...session, testId, savedAt: new Date().toISOString() };
  localStorage.setItem(ACTIVE_EXAM_KEY, JSON.stringify(map));
}

export function clearActiveExamSession(testId) {
  if (!testId) return;
  const map = readExamSessionMap();
  delete map[testId];
  localStorage.setItem(ACTIVE_EXAM_KEY, JSON.stringify(map));
}

export function getExamHistory(testId) {
  if (!testId) return [];
  try {
    const map = JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY) || '{}');
    return map[testId] || [];
  } catch {
    return [];
  }
}

export function getExamHistoryEntry(testId, id) {
  if (!testId || !id) return null;
  return getExamHistory(testId).find((e) => e.id === id) ?? null;
}

export function addExamHistoryEntry(testId, entry) {
  if (!testId) return;
  const record = {
    ...entry,
    id: entry.id || crypto.randomUUID(),
    completedAt: new Date().toISOString(),
  };
  try {
    const map = JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY) || '{}');
    const list = map[testId] || [];
    list.unshift(record);
    map[testId] = list.slice(0, 20);
    localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(map));
  } catch {
    localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify({ [testId]: [record] }));
  }
}
