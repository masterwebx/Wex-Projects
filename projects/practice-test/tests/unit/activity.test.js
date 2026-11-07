import { describe, it, expect } from 'vitest';
import { buildDailyActivity, hasActivity, activityTypes } from '../../app/src/activity-log.js';

describe('buildDailyActivity', () => {
  it('aggregates practice and exam activity by date', () => {
    const map = buildDailyActivity(
      [
        {
          questionId: 'q1',
          history: [
            { date: '2026-06-01T10:00:00.000Z', mode: 'mc', correct: true },
            { date: '2026-06-01T11:00:00.000Z', mode: 'mc', correct: false },
          ],
        },
      ],
      [
        {
          completedAt: '2026-06-02T18:00:00.000Z',
          percent: 85,
          correct: 17,
          total: 20,
          category: 'all',
          passed: true,
        },
      ],
      ['q1']
    );

    const day1 = map.get('2026-06-01');
    expect(day1.practiceAnswers).toBe(2);
    expect(day1.practiceCorrect).toBe(1);
    expect(day1.exams).toHaveLength(0);
    expect(hasActivity(day1)).toBe(true);
    expect(activityTypes(day1)).toEqual(['practice']);

    const day2 = map.get('2026-06-02');
    expect(day2.exams).toHaveLength(1);
    expect(day2.exams[0].percent).toBe(85);
    expect(activityTypes(day2)).toEqual(['exam']);
  });

  it('ignores progress for questions outside the active test', () => {
    const map = buildDailyActivity(
      [{ questionId: 'other', history: [{ date: '2026-06-03T10:00:00.000Z', mode: 'mc', correct: true }] }],
      [],
      ['q1']
    );
    expect(map.size).toBe(0);
  });
});
