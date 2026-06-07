import { describe, it, expect } from 'vitest';
import {
  computeExamReadiness,
  getReadinessLabel,
  isFullMockExam,
  createDefaultProgress,
  STAGES,
} from '../../app/src/srs.js';

const questions = [
  { id: 'q1', question: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  { id: 'q2', question: 'Q2', options: ['a', 'b', 'c', 'd'], correctIndex: 1 },
];

describe('computeExamReadiness', () => {
  it('returns zero overall when no questions', () => {
    const r = computeExamReadiness([], [], []);
    expect(r.overall).toBe(0);
    expect(r.label).toBe('Just beginning');
  });

  it('caps score at 30 without a mock exam', () => {
    const progress = [
      {
        ...createDefaultProgress('q1'),
        stage: STAGES.MASTERED,
        history: [{ date: new Date().toISOString(), mode: 'mc', correct: true }],
      },
      {
        ...createDefaultProgress('q2'),
        stage: STAGES.MASTERED,
        history: [{ date: new Date().toISOString(), mode: 'mc', correct: true }],
      },
    ];
    const r = computeExamReadiness(questions, progress, []);
    expect(r.overall).toBeLessThanOrEqual(30);
    expect(r.cappedWithoutMock).toBe(true);
    expect(r.components.some((c) => c.pending)).toBe(true);
  });

  it('includes only full mock exams in readiness score', () => {
    const progress = [
      {
        ...createDefaultProgress('q1'),
        stage: STAGES.MASTERED,
        history: [{ date: new Date().toISOString(), mode: 'mc', correct: true }],
      },
      createDefaultProgress('q2'),
    ];
    const partialOnly = computeExamReadiness(questions, progress, [
      { percent: 100, category: 'Alpha', total: 1, correct: 1 },
    ]);
    expect(partialOnly.cappedWithoutMock).toBe(true);

    const withFull = computeExamReadiness(questions, progress, [
      { percent: 80, category: 'all', total: 2, correct: 2, isFullExam: true },
      { percent: 90, category: 'Procedure', total: 5, correct: 4 },
    ]);
    expect(withFull.mockAvg).toBe(80);
    expect(withFull.mockCount).toBe(1);
    expect(withFull.partialMockCount).toBe(1);
    expect(withFull.cappedWithoutMock).toBe(false);
  });

  it('detects full mock exams by category and total', () => {
    expect(isFullMockExam({ category: 'all', total: 210, isFullExam: true }, 210)).toBe(true);
    expect(isFullMockExam({ category: 'Procedure', total: 43 }, 210)).toBe(false);
    expect(isFullMockExam({ category: 'all', total: 50 }, 210)).toBe(false);
  });

  it('suggests mock exam when none taken', () => {
    const r = computeExamReadiness(questions, [createDefaultProgress('q1')], []);
    expect(r.recommendations.some((rec) => rec.href === '#exam')).toBe(true);
  });
});

describe('getReadinessLabel', () => {
  it('maps score ranges to labels', () => {
    expect(getReadinessLabel(95)).toBe('Exam ready');
    expect(getReadinessLabel(80)).toBe('Almost ready');
    expect(getReadinessLabel(10)).toBe('Just beginning');
  });
});
