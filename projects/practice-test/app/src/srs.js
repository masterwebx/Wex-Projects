export const STAGES = {
  NEW: 'new',
  MC: 'mc',
  TYPE: 'type',
  MASTERED: 'mastered',
  LEARNING: 'learning',
};

export const MC_PROMOTE_STREAK = 3;
export const TYPE_PROMOTE_STREAK = 2;
export const DEFAULT_SESSION_SIZE = 20;
export const NEW_CARD_LIMIT = 5;
const INTERVALS = [1, 3, 7, 14, 30];

export function createDefaultProgress(questionId) {
  return {
    questionId,
    stage: STAGES.NEW,
    correctStreak: 0,
    intervalDays: 0,
    intervalIndex: 0,
    nextReview: null,
    history: [],
  };
}

export async function getOrCreateProgress(questionId, getProgress, saveProgress) {
  let progress = await getProgress(questionId);
  if (!progress) {
    progress = createDefaultProgress(questionId);
    await saveProgress(progress);
  }
  return progress;
}

function addHistory(progress, mode, correct) {
  progress.history = progress.history || [];
  progress.history.push({
    date: new Date().toISOString(),
    mode,
    correct,
  });
  if (progress.history.length > 50) {
    progress.history = progress.history.slice(-50);
  }
}

function scheduleDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function scheduleMinutes(minutes) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

export function getStudyStage(progress) {
  if (progress.stage === STAGES.NEW || progress.stage === STAGES.LEARNING) {
    return STAGES.MC;
  }
  if (progress.stage === STAGES.MC) {
    return STAGES.MC;
  }
  if (progress.stage === STAGES.TYPE) {
    return STAGES.TYPE;
  }
  if (progress.stage === STAGES.MASTERED) {
    return STAGES.TYPE;
  }
  return STAGES.MC;
}

export function resolveQuestionMode(progress, practiceMode) {
  if (practiceMode === 'mc') return 'mc';
  if (practiceMode === 'type') return 'type';
  const studyStage = getStudyStage(progress);
  return studyStage === STAGES.TYPE || studyStage === STAGES.MASTERED ? 'type' : 'mc';
}

export function getMemorizeHint(progress) {
  if (!progress || progress.stage === STAGES.NEW) {
    return `${MC_PROMOTE_STREAK} multiple choice correct → then ${TYPE_PROMOTE_STREAK} typed correct to memorize`;
  }
  if (progress.stage === STAGES.LEARNING || progress.stage === STAGES.MC) {
    const need = MC_PROMOTE_STREAK - (progress.correctStreak || 0);
    if (need > 0) {
      return `${need} more multiple choice correct → then type from memory`;
    }
    return `Next: type the answer from memory`;
  }
  if (progress.stage === STAGES.TYPE) {
    const need = TYPE_PROMOTE_STREAK - (progress.correctStreak || 0);
    return need > 0
      ? `${need} more typed correct to memorize this question`
      : `Almost memorized — keep going`;
  }
  if (progress.stage === STAGES.MASTERED) {
    return `Memorized — occasional review to keep it fresh`;
  }
  return '';
}

export function recordAnswer(progress, correct, mode) {
  const updated = { ...progress, history: [...(progress.history || [])] };
  addHistory(updated, mode, correct);

  if (!correct) {
    updated.correctStreak = 0;
    if (progress.stage === STAGES.MASTERED) {
      updated.stage = STAGES.TYPE;
    } else {
      updated.stage = STAGES.LEARNING;
    }
    updated.nextReview = scheduleMinutes(10);
    updated.intervalDays = 0;
    updated.intervalIndex = 0;
    return updated;
  }

  updated.correctStreak = (updated.correctStreak || 0) + 1;

  if (progress.stage === STAGES.MASTERED) {
    const idx = Math.min(updated.intervalIndex || 0, INTERVALS.length - 1);
    updated.intervalDays = INTERVALS[idx];
    updated.nextReview = scheduleDays(INTERVALS[idx]);
    updated.intervalIndex = Math.min(idx + 1, INTERVALS.length - 1);
    return updated;
  }

  if (mode === 'mc') {
    updated.stage = STAGES.MC;
    if (updated.correctStreak >= MC_PROMOTE_STREAK) {
      updated.stage = STAGES.TYPE;
      updated.correctStreak = 0;
    }
    updated.nextReview = scheduleMinutes(30);
  } else if (mode === 'type') {
    updated.stage = STAGES.TYPE;
    if (updated.correctStreak >= TYPE_PROMOTE_STREAK) {
      updated.stage = STAGES.MASTERED;
      updated.correctStreak = 0;
      updated.intervalIndex = 0;
      updated.intervalDays = INTERVALS[0];
      updated.nextReview = scheduleDays(INTERVALS[0]);
      if (progress.stage !== STAGES.MASTERED) {
        updated.masteredAt = new Date().toISOString();
      }
    } else {
      updated.nextReview = scheduleMinutes(30);
    }
  }

  if (updated.stage === STAGES.MASTERED) {
    const idx = Math.min(updated.intervalIndex || 0, INTERVALS.length - 1);
    updated.intervalDays = INTERVALS[idx];
    const nextIdx = Math.min(idx + 1, INTERVALS.length - 1);
    updated.intervalIndex = nextIdx;
    updated.nextReview = scheduleDays(INTERVALS[idx]);
  }

  return updated;
}

export function isDue(progress, now = new Date()) {
  if (!progress.nextReview) return true;
  return new Date(progress.nextReview) <= now;
}

export function getEffectiveStage(progress) {
  if (!progress || progress.stage === STAGES.NEW) return 'new';
  if (progress.stage === STAGES.LEARNING) return 'learning';
  if (progress.stage === STAGES.MC) return 'mc';
  if (progress.stage === STAGES.TYPE) return 'type';
  if (progress.stage === STAGES.MASTERED) return 'mastered';
  return 'new';
}

export function buildStats(questions, progressList) {
  const progressMap = new Map(progressList.map((p) => [p.questionId, p]));
  const stats = {
    total: questions.length,
    new: 0,
    learning: 0,
    mc: 0,
    type: 0,
    mastered: 0,
    dueToday: 0,
    seenOnce: 0,
    allSeenOnce: false,
    masteredPercent: 0,
  };

  const now = new Date();
  for (const q of questions) {
    const p = progressMap.get(q.id);
    if ((p?.history?.length ?? 0) > 0) stats.seenOnce++;
    if (!p || p.stage === STAGES.NEW) {
      stats.new++;
      stats.dueToday++;
      continue;
    }
    const stage = getEffectiveStage(p);
    if (stage === 'learning') stats.learning++;
    else if (stage === 'mc') stats.mc++;
    else if (stage === 'type') stats.type++;
    else if (stage === 'mastered') stats.mastered++;
    if (isDue(p, now)) stats.dueToday++;
  }

  stats.allSeenOnce = stats.total > 0 && stats.seenOnce === stats.total;
  stats.masteredPercent =
    stats.total > 0 ? Math.round((stats.mastered / stats.total) * 1000) / 10 : 0;
  return stats;
}

function sortQueueItems(items, now) {
  items.sort((a, b) => {
    const aDue = isDue(a.progress, now) ? 0 : 1;
    const bDue = isDue(b.progress, now) ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    const stageOrder = { new: 0, learning: 1, mc: 2, type: 3, mastered: 4 };
    const aStage = stageOrder[getEffectiveStage(a.progress)] ?? 5;
    const bStage = stageOrder[getEffectiveStage(b.progress)] ?? 5;
    if (aStage !== bStage) return aStage - bStage;
    return 0;
  });
}

export function getDueQueue(questions, progressList, filter = 'due') {
  const progressMap = new Map(progressList.map((p) => [p.questionId, p]));
  const now = new Date();

  let items = questions.map((q) => ({
    question: q,
    progress: progressMap.get(q.id) || createDefaultProgress(q.id),
  }));

  if (filter === 'due') {
    items = items.filter(({ progress }) => isDue(progress, now));
  } else if (filter === 'weak') {
    items = items.filter(
      ({ progress }) =>
        progress.stage === STAGES.LEARNING ||
        (progress.correctStreak === 0 && progress.history?.length > 0) ||
        progress.stage === STAGES.NEW
    );
  } else if (filter === 'new') {
    items = items.filter(({ progress }) => !progress.stage || progress.stage === STAGES.NEW);
  }

  sortQueueItems(items, now);
  return items;
}

function resolveNewCardLimit(sessionSize, questionCount, configuredLimit) {
  if (typeof sessionSize === 'number') return sessionSize;
  if (sessionSize === 'all') return Math.min(50, questionCount);
  return configuredLimit;
}

export function buildSessionQueue(questions, progressList, options = {}) {
  const sessionSize = options.sessionSize ?? DEFAULT_SESSION_SIZE;
  const newCardLimit = resolveNewCardLimit(
    sessionSize,
    questions.length,
    options.newCardLimit ?? NEW_CARD_LIMIT
  );
  const now = new Date();

  let dueItems = getDueQueue(questions, progressList, 'due');
  const totalDue = dueItems.length;

  if (dueItems.length === 0) {
    dueItems = getDueQueue(questions, progressList, 'all');
  }

  if (questions.length > 10) {
    const isNew = (p) => !p.stage || p.stage === STAGES.NEW;
    const newItems = dueItems.filter(({ progress }) => isNew(progress));
    const reviewItems = dueItems.filter(({ progress }) => !isNew(progress));

    if (newItems.length > newCardLimit) {
      dueItems = [...reviewItems, ...newItems.slice(0, newCardLimit)];
      sortQueueItems(dueItems, now);
    }
  }

  const queue =
    sessionSize === 'all' || sessionSize <= 0
      ? dueItems
      : dueItems.slice(0, sessionSize);

  const requestedSize =
    sessionSize === 'all' ? totalDue : typeof sessionSize === 'number' ? sessionSize : DEFAULT_SESSION_SIZE;

  return {
    queue,
    totalDue,
    sessionCount: queue.length,
    requestedSize,
    remainingAfterSession: Math.max(0, totalDue - queue.length),
    newCardLimit,
  };
}

export function analyzeSessionQueue(queue, practiceMode) {
  let mc = 0;
  let type = 0;
  for (const item of queue) {
    if (resolveQuestionMode(item.progress, practiceMode) === 'type') type++;
    else mc++;
  }
  return { mc, type };
}

export function estimateMinutes(count) {
  return Math.max(1, Math.round(count * 0.75));
}

export function estimateSessionsRemaining(stillLearning, sessionSize = DEFAULT_SESSION_SIZE) {
  if (stillLearning <= 0) return 0;
  const size = sessionSize === 'all' ? DEFAULT_SESSION_SIZE : sessionSize;
  return Math.ceil(stillLearning / size);
}

export function isFullyMastered(questions, progressList) {
  if (questions.length === 0) return false;
  const progressMap = new Map(progressList.map((p) => [p.questionId, p]));
  const now = new Date();
  return questions.every((q) => {
    const p = progressMap.get(q.id);
    return p?.stage === STAGES.MASTERED && !isDue(p, now);
  });
}

export function getQuestionCategory(question) {
  const cat = question.category?.trim();
  return cat || 'Uncategorized';
}

export function needsCategoryBanner(questions) {
  if (questions.length < 50) return false;
  const uncategorized = questions.filter((q) => !q.category?.trim()).length;
  return uncategorized / questions.length >= 0.8;
}

export function buildCategoryStats(questions, progressList) {
  const byCategory = new Map();

  for (const q of questions) {
    const name = getQuestionCategory(q);
    if (!byCategory.has(name)) byCategory.set(name, []);
    byCategory.get(name).push(q);
  }

  const categories = [];
  for (const [name, qs] of byCategory.entries()) {
    const stats = buildStats(qs, progressList);
    const stillLearning = stats.new + stats.learning + stats.mc + stats.type;
    categories.push({
      name,
      ...stats,
      stillLearning,
      needsFocus: stillLearning > 0 && stats.allSeenOnce,
      isComplete: stillLearning === 0 && stats.total > 0,
      sessionsLeft: estimateSessionsRemaining(stillLearning),
    });
  }

  categories.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
    if (a.allSeenOnce !== b.allSeenOnce) return a.allSeenOnce ? -1 : 1;
    if (a.masteredPercent !== b.masteredPercent) return a.masteredPercent - b.masteredPercent;
    return b.dueToday - a.dueToday;
  });

  return categories;
}

/** Weakest category only among topics where every question has been answered at least once. */
export function getWeakestCategory(categoryStats) {
  const eligible = categoryStats.filter(
    (c) => c.allSeenOnce && !c.isComplete && c.name !== 'Uncategorized'
  );
  if (eligible.length === 0) return null;

  return [...eligible].sort((a, b) => {
    if (a.masteredPercent !== b.masteredPercent) return a.masteredPercent - b.masteredPercent;
    if (b.stillLearning !== a.stillLearning) return b.stillLearning - a.stillLearning;
    return b.dueToday - a.dueToday;
  })[0];
}

export function filterQuestionsByCategory(questions, category) {
  if (!category || category === 'all') return questions;
  return questions.filter((q) => getQuestionCategory(q) === category);
}

function mistakePriority(progress, weekAgo) {
  if (!progress?.history?.length) return 0;
  const history = progress.history;
  const last = history[history.length - 1];
  const wrongs = history.filter((h) => !h.correct);
  if (wrongs.length === 0) return 0;

  const lastWrong = wrongs[wrongs.length - 1];
  const recentWrong = new Date(lastWrong.date) >= weekAgo;
  const lastAttemptWrong = !last.correct;

  if (!lastAttemptWrong && !recentWrong) return 0;

  let score = wrongs.length * 5;
  if (recentWrong) score += 40;
  if (lastAttemptWrong) score += 25;
  if (progress.stage !== STAGES.MASTERED) score += 15;
  if (progress.stage === STAGES.LEARNING) score += 10;
  return score;
}

/** Questions where the last attempt was wrong or a miss occurred within the last week. */
export function buildMistakeQueue(questions, progressList, options = {}) {
  const progressMap = new Map(progressList.map((p) => [p.questionId, p]));
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - (options.days ?? 7));

  const scored = questions
    .map((question) => {
      const progress = progressMap.get(question.id);
      const priority = mistakePriority(progress, weekAgo);
      if (priority <= 0) return null;
      return { question, progress: progress || createDefaultProgress(question.id), priority };
    })
    .filter(Boolean);

  scored.sort((a, b) => b.priority - a.priority);

  const sessionSize = options.sessionSize ?? DEFAULT_SESSION_SIZE;
  const slice =
    sessionSize === 'all' || sessionSize <= 0
      ? scored
      : scored.slice(0, typeof sessionSize === 'number' ? sessionSize : DEFAULT_SESSION_SIZE);

  return {
    queue: slice.map(({ question, progress }) => ({ question, progress })),
    totalDue: scored.length,
    sessionCount: slice.length,
    remainingAfterSession: Math.max(0, scored.length - slice.length),
  };
}

/** Questions never answered at least once. */
export function buildUnseenQueue(questions, progressList, options = {}) {
  const progressMap = new Map(progressList.map((p) => [p.questionId, p]));
  const unseen = questions
    .filter((q) => (progressMap.get(q.id)?.history?.length ?? 0) === 0)
    .map((question) => ({
      question,
      progress: progressMap.get(question.id) || createDefaultProgress(question.id),
    }));

  const sessionSize = options.sessionSize ?? DEFAULT_SESSION_SIZE;
  const slice =
    sessionSize === 'all' || sessionSize <= 0
      ? unseen
      : unseen.slice(0, typeof sessionSize === 'number' ? sessionSize : DEFAULT_SESSION_SIZE);

  return {
    queue: slice,
    totalDue: unseen.length,
    sessionCount: slice.length,
    remainingAfterSession: Math.max(0, unseen.length - slice.length),
  };
}

export function getTestReadiness(questions, progressList) {
  const progressMap = new Map(progressList.map((p) => [p.questionId, p]));
  let seenOnce = 0;
  let mastered = 0;
  let recentWrong = 0;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  for (const q of questions) {
    const p = progressMap.get(q.id);
    if ((p?.history?.length ?? 0) > 0) seenOnce++;
    if (p?.stage === STAGES.MASTERED) mastered++;
    if (p?.history?.some((h) => !h.correct && new Date(h.date) >= weekAgo)) recentWrong++;
  }

  const total = questions.length;
  return {
    total,
    seenOnce,
    mastered,
    recentWrong,
    seenPercent: total > 0 ? Math.round((seenOnce / total) * 1000) / 10 : 0,
    masteredPercent: total > 0 ? Math.round((mastered / total) * 1000) / 10 : 0,
    allSeenOnce: total > 0 && seenOnce === total,
  };
}

export function getWeeklyStats(progressList, questionIds) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const qSet = new Set(questionIds);
  let correctAnswers = 0;
  let newlyMemorized = 0;

  for (const p of progressList) {
    if (!qSet.has(p.questionId)) continue;
    for (const h of p.history || []) {
      if (new Date(h.date) >= weekAgo && h.correct) correctAnswers++;
    }
    if (p.masteredAt && new Date(p.masteredAt) >= weekAgo) {
      newlyMemorized++;
    }
  }

  return { correctAnswers, newlyMemorized };
}

export function hasAnyPracticeHistory(progressList, questionIds) {
  const qSet = new Set(questionIds);
  return progressList.some(
    (p) => qSet.has(p.questionId) && (p.history?.length > 0 || p.stage !== STAGES.NEW)
  );
}

/** Full mock = all categories and every question in the bank was included. */
export function isFullMockExam(entry, bankTotal) {
  if (!entry || bankTotal <= 0) return false;
  if (entry.isFullExam === true) return true;
  if (entry.isFullExam === false) return false;
  const category = entry.category ?? 'all';
  return category === 'all' && entry.total === bankTotal;
}

export function filterFullMockExams(examHistory, bankTotal) {
  return examHistory.filter((entry) => isFullMockExam(entry, bankTotal));
}

export function getReadinessLabel(score) {
  if (score >= 90) return 'Exam ready';
  if (score >= 75) return 'Almost ready';
  if (score >= 50) return 'Making progress';
  if (score >= 25) return 'Getting started';
  return 'Just beginning';
}

/** Composite readiness score for home dashboard (0–100). */
export function computeExamReadiness(questions, progressList, examHistory = []) {
  const base = getTestReadiness(questions, progressList);
  const progressMap = new Map(progressList.map((p) => [p.questionId, p]));
  const mistakeQueue = buildMistakeQueue(questions, progressList, { sessionSize: 'all' });
  const fullyMastered = isFullyMastered(questions, progressList);

  let totalAttempts = 0;
  let correctAttempts = 0;
  for (const q of questions) {
    for (const h of progressMap.get(q.id)?.history || []) {
      totalAttempts++;
      if (h.correct) correctAttempts++;
    }
  }

  const accuracyPercent =
    totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 1000) / 10 : 0;
  const coveragePercent = base.seenPercent;
  const masteryPercent = base.masteredPercent;

  const bankTotal = base.total;
  const qualifyingMocks = filterFullMockExams(examHistory, bankTotal);
  let mockAvg = null;
  const hasMock = qualifyingMocks.length > 0;
  if (hasMock) {
    const recent = qualifyingMocks.slice(0, 3);
    mockAvg = Math.round(recent.reduce((sum, e) => sum + e.percent, 0) / recent.length);
  }

  const coveragePoints = Math.round(coveragePercent * 0.15);
  const masteryPoints = Math.round(masteryPercent * 0.25);
  const accuracyPoints = Math.round(accuracyPercent * 0.2);
  const mockPoints = hasMock ? Math.round(mockAvg * 0.4) : 0;

  let overall = 0;
  if (base.total > 0) {
    if (hasMock) {
      overall = Math.min(100, coveragePoints + masteryPoints + accuracyPoints + mockPoints);
    } else {
      const practiceOnly = Math.round(
        coveragePercent * 0.1 + masteryPercent * 0.15 + accuracyPercent * 0.05
      );
      overall = Math.min(30, practiceOnly);
    }
  }

  const components = [
    {
      key: 'coverage',
      label: 'Coverage',
      description: `${base.seenOnce} of ${base.total} questions answered at least once. Exiting without submitting an answer does not count.`,
      percent: coveragePercent,
      weight: hasMock ? 15 : 10,
      points: hasMock ? coveragePoints : Math.round(coveragePercent * 0.1),
    },
    {
      key: 'mastery',
      label: 'Memorized',
      description: `${base.mastered} questions fully memorized through spaced repetition.`,
      percent: masteryPercent,
      weight: hasMock ? 25 : 15,
      points: hasMock ? masteryPoints : Math.round(masteryPercent * 0.15),
    },
    {
      key: 'accuracy',
      label: 'Answer accuracy',
      description:
        totalAttempts > 0
          ? `${correctAttempts} correct out of ${totalAttempts} practice attempts.`
          : 'No submitted practice answers yet.',
      percent: accuracyPercent,
      weight: hasMock ? 20 : 5,
      points: hasMock ? accuracyPoints : Math.round(accuracyPercent * 0.05),
    },
    hasMock
      ? {
          key: 'mock',
          label: 'Mock exam',
          description: `Average of your last ${Math.min(3, qualifyingMocks.length)} full mock exam(s) (all ${bankTotal} questions). Category-only practice exams do not count. Passing is 70%.`,
          percent: mockAvg,
          weight: 40,
          points: mockPoints,
        }
      : {
          key: 'mock',
          label: 'Mock exam',
          description:
            qualifyingMocks.length === 0 && examHistory.length > 0
              ? `You have ${examHistory.length} partial mock exam(s). Complete a full exam (all categories, ${bankTotal} questions) to unlock your readiness score.`
              : 'Not taken yet. Your score is capped at 30 until you complete a full mock exam.',
          percent: null,
          weight: 40,
          points: 0,
          pending: true,
        },
  ];

  const recommendations = [];
  if (fullyMastered) {
    recommendations.push({
      label: 'All memorized — stay sharp with mock exams',
      href: '#exam',
      priority: 'normal',
    });
  }
  if (base.seenPercent < 100) {
    recommendations.push({
      label: 'Try questions you have not seen yet',
      href: '#practice?focus=unseen',
      priority: base.seenPercent < 50 ? 'high' : 'normal',
    });
  }
  if (mistakeQueue.totalDue > 0) {
    recommendations.push({
      label: `Review ${mistakeQueue.totalDue} mistake${mistakeQueue.totalDue === 1 ? '' : 's'}`,
      href: '#practice?focus=mistakes',
      priority: 'high',
    });
  }
  if (!hasMock) {
    recommendations.push({ label: 'Take your first mock exam', href: '#exam', priority: 'normal' });
  } else if (mockAvg < 70) {
    recommendations.push({ label: 'Retake mock exam to reach 70%', href: '#exam', priority: 'high' });
  }

  return {
    ...base,
    overall,
    mockAvg,
    mockCount: qualifyingMocks.length,
    partialMockCount: examHistory.length - qualifyingMocks.length,
    mistakeCount: mistakeQueue.totalDue,
    fullyMastered,
    accuracyPercent,
    totalAttempts,
    correctAttempts,
    components,
    cappedWithoutMock: !hasMock,
    label: getReadinessLabel(overall),
    recommendations: recommendations.slice(0, 3),
  };
}
