import { describe, it, expect } from 'vitest';
import { toLocalDateKey, localDateKeyFromIso } from '../../app/src/date-utils.js';
import { buildDailyActivity } from '../../app/src/activity-log.js';

describe('toLocalDateKey', () => {
  it('formats local calendar date', () => {
    const d = new Date(2026, 5, 5, 22, 0, 0);
    expect(toLocalDateKey(d)).toBe('2026-06-05');
  });

  it('round-trips ISO timestamps to local calendar day', () => {
    const localTime = new Date(2026, 5, 5, 22, 30, 0);
    expect(localDateKeyFromIso(localTime.toISOString())).toBe('2026-06-05');
  });
});

describe('buildDailyActivity local bucketing', () => {
  it('assigns evening local activity to that calendar day not UTC day', () => {
    const localTime = new Date(2026, 5, 5, 22, 30, 0);
    const map = buildDailyActivity(
      [{ questionId: 'q1', history: [{ date: localTime.toISOString(), mode: 'mc', correct: true }] }],
      [],
      ['q1']
    );
    expect(map.has('2026-06-05')).toBe(true);
    expect(map.get('2026-06-05').practiceAnswers).toBe(1);
  });
});
