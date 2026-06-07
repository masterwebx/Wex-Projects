/**
 * Build per-day study activity from practice history and mock exam completions.
 * @param {object[]} progressList
 * @param {object[]} examHistory
 * @param {string[]} questionIds
 * @returns {Map<string, { practiceAnswers: number, practiceCorrect: number, exams: object[] }>}
 */
export function buildDailyActivity(progressList, examHistory, questionIds) {
  const qSet = new Set(questionIds);
  const byDate = new Map();

  const ensureDay = (dateKey) => {
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, { practiceAnswers: 0, practiceCorrect: 0, exams: [] });
    }
    return byDate.get(dateKey);
  };

  for (const p of progressList) {
    if (!qSet.has(p.questionId)) continue;
    for (const h of p.history || []) {
      const dateKey = (h.date || '').slice(0, 10);
      if (!dateKey) continue;
      const day = ensureDay(dateKey);
      day.practiceAnswers++;
      if (h.correct) day.practiceCorrect++;
    }
  }

  for (const exam of examHistory) {
    const dateKey = (exam.completedAt || '').slice(0, 10);
    if (!dateKey) continue;
    ensureDay(dateKey).exams.push({
      percent: exam.percent,
      correct: exam.correct,
      total: exam.total,
      category: exam.category ?? 'all',
      passed: exam.passed,
      isFullExam: exam.isFullExam,
    });
  }

  return byDate;
}

export function getActivityDates(activityMap) {
  return [...activityMap.keys()].sort();
}

export function hasActivity(day) {
  return day.practiceAnswers > 0 || day.exams.length > 0;
}

export function activityTypes(day) {
  const types = [];
  if (day.practiceAnswers > 0) types.push('practice');
  if (day.exams.length > 0) types.push('exam');
  return types;
}
