import { describe, it, expect, vi } from 'vitest';
import {
  normalizeAnswer,
  similarity,
  checkTypedAnswer,
  renderTypeQuestion,
} from '../../app/src/study/type-mode.js';

const question = {
  options: ['Boric acid', 'Toluene', 'Formaldehyde', 'Acetic acid'],
  correctIndex: 0,
  question: 'Which preservative is correct?',
};

describe('normalizeAnswer', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeAnswer('  Boric Acid! ')).toBe('boric acid');
  });
});

describe('checkTypedAnswer', () => {
  it('accepts close text matches', () => {
    const result = checkTypedAnswer('boric acid', question);
    expect(result.correct).toBe(true);
    expect(result.matchType).toBe('text');
  });

  it('accepts correct letter answers', () => {
    const result = checkTypedAnswer('a', question);
    expect(result.correct).toBe(true);
    expect(result.matchType).toBe('letter');
  });

  it('rejects clearly wrong answers', () => {
    const result = checkTypedAnswer('water', question);
    expect(result.correct).toBe(false);
  });
});

describe('similarity', () => {
  it('returns 1 for identical normalized strings', () => {
    expect(similarity('Boric Acid', 'boric acid')).toBe(1);
  });
});

describe('renderTypeQuestion', () => {
  it('does not call onAnswer twice when grade button is double-clicked', () => {
    const container = document.createElement('div');
    const onAnswer = vi.fn();
    renderTypeQuestion(container, question, { onAnswer });

    const form = container.querySelector('#type-form');
    container.querySelector('#type-input').value = 'water';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const gradeBtn = container.querySelector('#grade-correct');
    gradeBtn.click();
    gradeBtn.click();

    expect(onAnswer).toHaveBeenCalledOnce();
  });

  it('does not call onAnswer twice on double form submit', () => {
    const container = document.createElement('div');
    const onAnswer = vi.fn();
    renderTypeQuestion(container, question, { onAnswer });

    const form = container.querySelector('#type-form');
    container.querySelector('#type-input').value = 'boric acid';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(onAnswer).toHaveBeenCalledOnce();
  });
});
