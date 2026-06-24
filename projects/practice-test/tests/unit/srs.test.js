import { describe, it, expect } from 'vitest';
import {
  createDefaultProgress,
  recordAnswer,
  buildSessionQueue,
  buildMistakeQueue,
  buildUnseenQueue,
  getWeakestCategory,
  buildCategoryStats,
  getTestReadiness,
  STAGES,
} from '../../app/src/srs.js';

const questions = [
  { id: 'q1', question: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndex: 0, category: 'Alpha' },
  { id: 'q2', question: 'Q2', options: ['a', 'b', 'c', 'd'], correctIndex: 1, category: 'Alpha' },
  { id: 'q3', question: 'Q3', options: ['a', 'b', 'c', 'd'], correctIndex: 2, category: 'Beta' },
];

function progressWithHistory(questionId, history, stage = STAGES.LEARNING) {
  return {
    ...createDefaultProgress(questionId),
    stage,
    history,
  };
}

describe('recordAnswer', () => {
  it('promotes to TYPE after 3 correct MC answers', () => {
    let p = createDefaultProgress('q1');
    p = recordAnswer(p, true, 'mc');
    p = recordAnswer(p, true, 'mc');
    p = recordAnswer(p, true, 'mc');
    expect(p.stage).toBe(STAGES.TYPE);
  });

  it('resets streak on wrong answer', () => {
    let p = { ...createDefaultProgress('q1'), stage: STAGES.MC, correctStreak: 2 };
    p = recordAnswer(p, false, 'mc');
    expect(p.correctStreak).toBe(0);
    expect(p.stage).toBe(STAGES.LEARNING);
  });
});

describe('buildSessionQueue', () => {
  it('respects numeric session size', () => {
    const progress = questions.map((q) => createDefaultProgress(q.id));
    const result = buildSessionQueue(questions, progress, { sessionSize: 2 });
    expect(result.sessionCount).toBe(2);
  });
});

describe('buildMistakeQueue', () => {
  it('includes questions with a recent wrong answer', () => {
    const progress = [
      progressWithHistory('q1', [{ date: new Date().toISOString(), mode: 'mc', correct: false }]),
      createDefaultProgress('q2'),
      createDefaultProgress('q3'),
    ];
    const result = buildMistakeQueue(questions, progress, { sessionSize: 10 });
    expect(result.queue).toHaveLength(1);
    expect(result.queue[0].question.id).toBe('q1');
  });

  it('excludes questions wrong long ago if last attempt was correct', () => {
    const old = new Date();
    old.setDate(old.getDate() - 30);
    const progress = [
      progressWithHistory('q1', [
        { date: old.toISOString(), mode: 'mc', correct: false },
        { date: new Date().toISOString(), mode: 'mc', correct: true },
      ]),
      createDefaultProgress('q2'),
      createDefaultProgress('q3'),
    ];
    const result = buildMistakeQueue(questions, progress, { sessionSize: 10 });
    expect(result.queue).toHaveLength(0);
  });

  it('includes questions wrong long ago if last attempt was wrong', () => {
    const old = new Date();
    old.setDate(old.getDate() - 30);
    const progress = [
      progressWithHistory('q1', [
        { date: old.toISOString(), mode: 'mc', correct: true },
        { date: old.toISOString(), mode: 'mc', correct: false },
      ]),
      createDefaultProgress('q2'),
      createDefaultProgress('q3'),
    ];
    const result = buildMistakeQueue(questions, progress, { sessionSize: 10 });
    expect(result.queue).toHaveLength(1);
    expect(result.queue[0].question.id).toBe('q1');
  });
});

describe('buildUnseenQueue', () => {
  it('includes only questions without history', () => {
    const progress = [
      progressWithHistory('q1', [{ date: new Date().toISOString(), mode: 'mc', correct: true }]),
      createDefaultProgress('q2'),
      createDefaultProgress('q3'),
    ];
    const result = buildUnseenQueue(questions, progress, { sessionSize: 10 });
    expect(result.queue.map((q) => q.question.id).sort()).toEqual(['q2', 'q3']);
  });
});

describe('getWeakestCategory', () => {
  it('ignores categories not fully seen once', () => {
    const stats = buildCategoryStats(questions, [
      createDefaultProgress('q1'),
      createDefaultProgress('q2'),
      createDefaultProgress('q3'),
    ]);
    expect(getWeakestCategory(stats)).toBeNull();
  });

  it('picks lowest mastered percent among eligible categories', () => {
    const progress = [
      { ...createDefaultProgress('q1'), stage: STAGES.MASTERED, history: [{ date: new Date().toISOString(), mode: 'mc', correct: true }], masteredAt: new Date().toISOString() },
      { ...createDefaultProgress('q2'), stage: STAGES.MC, history: [{ date: new Date().toISOString(), mode: 'mc', correct: false }] },
      { ...createDefaultProgress('q3'), stage: STAGES.MC, history: [{ date: new Date().toISOString(), mode: 'mc', correct: false }] },
    ];
    const stats = buildCategoryStats(questions, progress);
    expect(getWeakestCategory(stats)?.name).toBe('Beta');
  });
});

describe('getTestReadiness', () => {
  it('summarizes seen and mastered counts', () => {
    const progress = [
      progressWithHistory('q1', [{ date: new Date().toISOString(), mode: 'mc', correct: true }], STAGES.MASTERED),
      createDefaultProgress('q2'),
      createDefaultProgress('q3'),
    ];
    const readiness = getTestReadiness(questions, progress);
    expect(readiness.seenOnce).toBe(1);
    expect(readiness.mastered).toBe(1);
    expect(readiness.total).toBe(3);
  });
});
