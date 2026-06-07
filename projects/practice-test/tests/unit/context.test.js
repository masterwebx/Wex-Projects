import { describe, it, expect, beforeEach } from 'vitest';
import {
  setSessionSize,
  getSessionSize,
  getSessionSizeIsCustom,
  markDoneForToday,
  isDoneForToday,
  clearDoneForToday,
  saveActivePracticeSession,
  getActivePracticeSession,
  clearActivePracticeSession,
} from '../../app/src/context.js';

describe('context preferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores preset and custom session sizes separately', () => {
    setSessionSize(25, true);
    expect(getSessionSize()).toBe(25);
    expect(getSessionSizeIsCustom()).toBe(true);

    setSessionSize(20, false);
    expect(getSessionSize()).toBe(20);
    expect(getSessionSizeIsCustom()).toBe(false);
  });

  it('tracks done-for-today per test', () => {
    markDoneForToday('test-a');
    expect(isDoneForToday('test-a')).toBe(true);
    expect(isDoneForToday('test-b')).toBe(false);
    clearDoneForToday('test-a');
    expect(isDoneForToday('test-a')).toBe(false);
  });

  it('persists and restores practice sessions with answer review', () => {
    saveActivePracticeSession('test-a', {
      lockedMode: 'auto',
      lockedCategory: 'all',
      lockedSize: 10,
      sessionFocus: 'due',
      queueQuestionIds: ['q1', 'q2'],
      currentIndex: 1,
      sessionStats: { correct: 1, total: 1 },
      sessionNewlyMemorized: 0,
      totalDue: 2,
      remainingAfter: 0,
      sessionAnswers: [
        {
          questionId: 'q1',
          correct: true,
          mode: 'mc',
          selectedAnswer: 'Boric acid',
          correctAnswer: 'Boric acid',
        },
      ],
    });

    const saved = getActivePracticeSession('test-a');
    expect(saved.currentIndex).toBe(1);
    expect(saved.sessionAnswers).toHaveLength(1);
    clearActivePracticeSession('test-a');
    expect(getActivePracticeSession('test-a')).toBeNull();
  });
});
