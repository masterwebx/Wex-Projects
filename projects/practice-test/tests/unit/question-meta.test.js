import { describe, it, expect } from 'vitest';
import {
  normalizeQuestionText,
  getQuestionExplanation,
  hasCustomExplanation,
  isDuplicateQuestion,
  flagExistingDuplicates,
} from '../../app/src/question-meta.js';

describe('question-meta', () => {
  it('normalizes question text for comparison', () => {
    expect(normalizeQuestionText('  Hello   World  ')).toBe('hello world');
  });

  it('returns custom explanation only when present', () => {
    const q = {
      options: ['a', 'b'],
      correctIndex: 0,
      explanation: 'Because science.',
    };
    expect(hasCustomExplanation(q)).toBe(true);
    expect(getQuestionExplanation(q)).toBe('Because science.');
  });

  it('returns empty when no custom explanation', () => {
    const q = { options: ['a', 'b'], correctIndex: 0 };
    expect(hasCustomExplanation(q)).toBe(false);
    expect(getQuestionExplanation(q)).toBe('');
  });

  it('detects duplicate by text or number', () => {
    const existing = { number: 5, question: 'What is X?' };
    expect(isDuplicateQuestion(existing, { number: 5, question: 'Other' })).toBe(true);
    expect(isDuplicateQuestion(existing, { question: 'What is X?' })).toBe(true);
    expect(isDuplicateQuestion(existing, { number: 6, question: 'Different' })).toBe(false);
  });

  it('flags import drafts that already exist', () => {
    const drafts = [{ _importId: 'd1', number: 1, question: 'Same?', issues: [], included: true }];
    const existing = [{ id: 'q1', number: 1, question: 'Same?' }];
    flagExistingDuplicates(drafts, existing);
    expect(drafts[0].included).toBe(false);
    expect(drafts[0].issues.some((i) => i.includes('Already in your test'))).toBe(true);
  });
});
