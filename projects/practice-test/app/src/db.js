import { getActiveTestId, setActiveTestId } from './context.js';
import amtRptMockExamData from './data/amt-rpt-mock-exam.json';
import { extractQuestionArray } from './import/parse-import.js';
import { isDuplicateQuestion } from './question-meta.js';

export const AMT_RPT_MOCK_EXAM_ID = 'amt-rpt-mock-exam';
/** Bump when bundled exam content changes — triggers explanation sync into IndexedDB. */
export const AMT_BUNDLE_DATA_VERSION = 3;

const DB_NAME = 'practice-test-db';
const DB_VERSION = 2;
const BUNDLE_SYNC_KEY = 'amtBundleDataVersion';

let dbPromise = null;
let migrationDone = false;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const tx = event.target.transaction;

        if (!db.objectStoreNames.contains('tests')) {
          db.createObjectStore('tests', { keyPath: 'id' });
        }

        let questionStore;
        if (!db.objectStoreNames.contains('questions')) {
          questionStore = db.createObjectStore('questions', { keyPath: 'id' });
        } else {
          questionStore = tx.objectStore('questions');
        }
        if (!questionStore.indexNames.contains('testId')) {
          questionStore.createIndex('testId', 'testId', { unique: false });
        }

        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'questionId' });
        }
      };
    }).then(async (db) => {
      if (!migrationDone) {
        await migrateLegacyData(db);
        migrationDone = true;
      }
      return db;
    });
  }
  return dbPromise;
}

async function migrateLegacyData(db) {

  const questions = await promisifyRequest(
    db.transaction('questions', 'readonly').objectStore('questions').getAll()
  );

  const needsMigration = questions.some((q) => !q.testId);
  if (!needsMigration) return;

  const tests = await promisifyRequest(
    db.transaction('tests', 'readonly').objectStore('tests').getAll()
  );

  let defaultTest = tests.find((t) => t.id === 'default');
  if (!defaultTest) {
    defaultTest = {
      id: 'default',
      name: 'My Practice Test',
      description: 'Migrated from earlier version',
      categories: [],
      createdAt: new Date().toISOString(),
    };
    await promisifyRequest(
      db.transaction('tests', 'readwrite').objectStore('tests').put(defaultTest)
    );
  }

  const writeTx = db.transaction('questions', 'readwrite');
  const store = writeTx.objectStore('questions');
  for (const q of questions) {
    if (!q.testId) {
      q.testId = defaultTest.id;
      if (!q.category) q.category = '';
      store.put(q);
    }
  }

  await new Promise((resolve, reject) => {
    writeTx.oncomplete = resolve;
    writeTx.onerror = () => reject(writeTx.error);
  });

  if (!getActiveTestId()) {
    setActiveTestId(defaultTest.id);
  }
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  });
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createTestId() {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createQuestionId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// --- Tests ---

export async function getAllTests() {
  const store = await tx('tests');
  return promisifyRequest(store.getAll());
}

export async function getActiveTests() {
  const all = await getAllTests();
  return all.filter((t) => !t.archived);
}

export async function getTest(id) {
  const store = await tx('tests');
  return promisifyRequest(store.get(id));
}

export async function saveTest(test) {
  const store = await tx('tests', 'readwrite');
  return promisifyRequest(store.put(test));
}

export async function deleteTest(id) {
  const questions = await getQuestionsByTestId(id);
  const db = await openDB();
  const txMulti = db.transaction(['tests', 'questions', 'progress'], 'readwrite');

  txMulti.objectStore('tests').delete(id);
  for (const q of questions) {
    txMulti.objectStore('questions').delete(q.id);
    txMulti.objectStore('progress').delete(q.id);
  }

  return new Promise((resolve, reject) => {
    txMulti.oncomplete = () => resolve();
    txMulti.onerror = () => reject(txMulti.error);
  });
}

export async function archiveTest(id) {
  const test = await getTest(id);
  if (!test) return;
  test.archived = true;
  test.archivedAt = new Date().toISOString();
  await saveTest(test);
}

export async function unarchiveTest(id) {
  const test = await getTest(id);
  if (!test) return;
  delete test.archived;
  delete test.archivedAt;
  await saveTest(test);
}

async function seedAmtRptMockExam() {
  const existing = await getTest(AMT_RPT_MOCK_EXAM_ID);
  if (existing) return existing;

  const rawItems = extractQuestionArray(amtRptMockExamData);

  const test = {
    id: AMT_RPT_MOCK_EXAM_ID,
    name: 'AMT RPT Mock Exam',
    description: '210-question American Medical Technologists RPT mock exam',
    categories: [],
    createdAt: new Date().toISOString(),
  };
  await saveTest(test);

  const questions = rawItems.map((raw, i) => {
    const number = raw.number ?? i + 1;
    return {
      id: `${AMT_RPT_MOCK_EXAM_ID}-q-${number}`,
      testId: AMT_RPT_MOCK_EXAM_ID,
      number,
      question: String(raw.question ?? '').trim(),
      options: raw.options.map((o) => String(o ?? '').trim()).slice(0, 4),
      correctIndex: raw.correctIndex,
      category: String(raw.category ?? '').trim(),
      explanation: String(raw.explanation ?? raw.rationale ?? '').trim(),
    };
  });

  await bulkSaveQuestions(questions);
  await updateTestCategories(AMT_RPT_MOCK_EXAM_ID);

  setActiveTestId(AMT_RPT_MOCK_EXAM_ID);

  return test;
}

function bundleLookupKey(number) {
  const n = Number(number);
  return Number.isFinite(n) && n > 0 ? n : String(number ?? '');
}

function buildBundleByNumber(rawItems) {
  const byNumber = new Map();
  for (const raw of rawItems) {
    const key = bundleLookupKey(raw.number);
    byNumber.set(key, {
      category: String(raw.category ?? '').trim(),
      explanation: String(raw.explanation ?? raw.rationale ?? '').trim(),
    });
  }
  return byNumber;
}

async function syncAmtRptBundle() {
  const existing = await getTest(AMT_RPT_MOCK_EXAM_ID);
  if (!existing) return;

  const rawItems = extractQuestionArray(amtRptMockExamData);
  const byNumber = buildBundleByNumber(rawItems);
  const questions = await getQuestionsByTestId(AMT_RPT_MOCK_EXAM_ID);
  if (questions.length === 0) return;

  let forceExplanations = false;
  try {
    const synced = parseInt(localStorage.getItem(BUNDLE_SYNC_KEY) || '0', 10);
    forceExplanations = synced < AMT_BUNDLE_DATA_VERSION;
  } catch {
    forceExplanations = true;
  }

  const updates = [];
  for (const q of questions) {
    const bundle = byNumber.get(bundleLookupKey(q.number));
    if (!bundle) continue;
    const next = { ...q };
    let changed = false;
    if (bundle.category && q.category !== bundle.category) {
      next.category = bundle.category;
      changed = true;
    }
    if (bundle.explanation && (forceExplanations || q.explanation !== bundle.explanation)) {
      next.explanation = bundle.explanation;
      changed = true;
    }
    if (changed) updates.push(next);
  }

  if (updates.length > 0) {
    await bulkSaveQuestions(updates);
    await updateTestCategories(AMT_RPT_MOCK_EXAM_ID);
  }

  if (forceExplanations) {
    try {
      localStorage.setItem(BUNDLE_SYNC_KEY, String(AMT_BUNDLE_DATA_VERSION));
    } catch {
      /* ignore */
    }
  }
}

/** Idempotent: loads bundled AMT RPT Mock Exam when missing; syncs bundle fields from JSON. */
export async function seedBundledExams() {
  const test = await seedAmtRptMockExam();
  await syncAmtRptBundle();
  return test;
}

export async function ensureDefaultTest() {
  await seedBundledExams();

  const tests = await getActiveTests();
  if (tests.length === 0) return [];

  const activeId = getActiveTestId();
  const validActive = tests.some((t) => t.id === activeId);
  if (!validActive) {
    const preferred = tests.find((t) => t.id === AMT_RPT_MOCK_EXAM_ID) ?? tests[0];
    setActiveTestId(preferred.id);
  }

  return tests;
}

// --- Questions ---

export async function getAllQuestions(testId = null) {
  const store = await tx('questions');
  const all = await promisifyRequest(store.getAll());
  const tid = testId ?? getActiveTestId();
  if (!tid) return all;
  return all.filter((q) => q.testId === tid);
}

export async function getQuestionsByTestId(testId) {
  const store = await tx('questions');
  const all = await promisifyRequest(store.getAll());
  return all.filter((q) => q.testId === testId);
}

export async function getQuestion(id) {
  const store = await tx('questions');
  return promisifyRequest(store.get(id));
}

export async function saveQuestion(question) {
  const store = await tx('questions', 'readwrite');
  return promisifyRequest(store.put(question));
}

export async function deleteQuestion(id) {
  const store = await tx('questions', 'readwrite');
  const progressStore = await tx('progress', 'readwrite');
  await promisifyRequest(store.delete(id));
  await promisifyRequest(progressStore.delete(id));
}

export async function bulkSaveQuestions(questions) {
  const db = await openDB();
  const transaction = db.transaction('questions', 'readwrite');
  const store = transaction.objectStore('questions');
  for (const q of questions) {
    store.put(q);
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCategoriesForTest(testId) {
  const questions = await getQuestionsByTestId(testId);
  const cats = new Set();
  for (const q of questions) {
    if (q.category?.trim()) cats.add(q.category.trim());
  }
  return [...cats].sort();
}

export async function updateTestCategories(testId) {
  const cats = await getCategoriesForTest(testId);
  const test = await getTest(testId);
  if (test) {
    test.categories = cats;
    await saveTest(test);
  }
}

// --- Progress ---

export async function getAllProgress() {
  const store = await tx('progress');
  return promisifyRequest(store.getAll());
}

export async function getProgress(questionId) {
  const store = await tx('progress');
  return promisifyRequest(store.get(questionId));
}

export async function saveProgress(progress) {
  const store = await tx('progress', 'readwrite');
  return promisifyRequest(store.put(progress));
}

export async function clearProgressForTest(testId) {
  const questions = await getQuestionsByTestId(testId);
  if (questions.length === 0) return 0;

  const db = await openDB();
  const txMulti = db.transaction('progress', 'readwrite');
  const store = txMulti.objectStore('progress');
  for (const q of questions) {
    store.delete(q.id);
  }

  await new Promise((resolve, reject) => {
    txMulti.oncomplete = () => resolve();
    txMulti.onerror = () => reject(txMulti.error);
  });

  return questions.length;
}

// --- Export / Import ---

export async function exportAllData() {
  const [tests, questions, progress] = await Promise.all([
    getAllTests(),
    promisifyRequest((await tx('questions')).getAll()),
    getAllProgress(),
  ]);
  return { tests, questions, progress, exportedAt: new Date().toISOString(), version: 2 };
}

export async function importAllData(data) {
  const db = await openDB();
  const txMulti = db.transaction(['tests', 'questions', 'progress'], 'readwrite');

  if (data.version >= 2 && data.tests) {
    txMulti.objectStore('tests').clear();
    for (const t of data.tests) txMulti.objectStore('tests').put(t);
  }

  if (!data?.questions || !Array.isArray(data.questions)) {
    throw new Error('Invalid import file: missing questions array');
  }

  txMulti.objectStore('questions').clear();
  txMulti.objectStore('progress').clear();

  for (const q of data.questions) {
    if (!q.testId) q.testId = data.tests?.[0]?.id || 'default';
    txMulti.objectStore('questions').put(q);
  }
  if (data.progress && Array.isArray(data.progress)) {
    for (const p of data.progress) txMulti.objectStore('progress').put(p);
  }

  return new Promise((resolve, reject) => {
    txMulti.oncomplete = () => resolve();
    txMulti.onerror = () => reject(txMulti.error);
  });
}

/** Merge backup into existing data — skips duplicate questions by text or number. */
export async function mergeImportData(data) {
  if (!data?.questions || !Array.isArray(data.questions)) {
    throw new Error('Invalid import file: missing questions array');
  }

  const existingQuestions = await promisifyRequest((await tx('questions')).getAll());
  const byTest = new Map();
  for (const q of existingQuestions) {
    if (!byTest.has(q.testId)) byTest.set(q.testId, []);
    byTest.get(q.testId).push(q);
  }

  const db = await openDB();
  const txMulti = db.transaction(['tests', 'questions', 'progress'], 'readwrite');
  let added = 0;
  let skipped = 0;
  let updated = 0;

  if (data.tests && Array.isArray(data.tests)) {
    for (const t of data.tests) txMulti.objectStore('tests').put(t);
  }

  const questionStore = txMulti.objectStore('questions');
  for (const q of data.questions) {
    if (!q.testId) q.testId = data.tests?.[0]?.id || getActiveTestId() || 'default';
    const pool = byTest.get(q.testId) || [];
    const dup = pool.find((e) => e.id !== q.id && isDuplicateQuestion(e, q));
    if (dup) {
      skipped++;
      continue;
    }
    const existing = pool.find((e) => e.id === q.id);
    if (existing) updated++;
    else {
      added++;
      pool.push(q);
      byTest.set(q.testId, pool);
    }
    questionStore.put(q);
  }

  if (data.progress && Array.isArray(data.progress)) {
    const progressStore = txMulti.objectStore('progress');
    for (const p of data.progress) progressStore.put(p);
  }

  return new Promise((resolve, reject) => {
    txMulti.oncomplete = () => resolve({ added, skipped, updated });
    txMulti.onerror = () => reject(txMulti.error);
  });
}

export async function clearAllData() {
  const db = await openDB();
  const txMulti = db.transaction(['tests', 'questions', 'progress'], 'readwrite');

  txMulti.objectStore('tests').clear();
  txMulti.objectStore('questions').clear();
  txMulti.objectStore('progress').clear();

  return new Promise((resolve, reject) => {
    txMulti.oncomplete = () => resolve();
    txMulti.onerror = () => reject(txMulti.error);
  });
}
