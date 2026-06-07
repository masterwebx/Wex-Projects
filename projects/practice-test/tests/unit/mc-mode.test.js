import { describe, it, expect, vi } from 'vitest';
import { renderMcQuestion, cleanupMcQuestion, shuffleOptions } from '../../app/src/study/mc-mode.js';

const sampleQuestion = {
  id: 'q1',
  number: 1,
  question: 'Which preservative is correct?',
  options: ['Toluene', 'Boric acid', 'Formaldehyde', 'Acetic acid'],
  correctIndex: 1,
};

describe('shuffleOptions', () => {
  it('keeps correct answer index aligned with shuffled items', () => {
    const { shuffled, correctIndex } = shuffleOptions(sampleQuestion.options, 1);
    expect(shuffled[correctIndex].text).toBe('Boric acid');
    expect(shuffled).toHaveLength(4);
  });
});

describe('renderMcQuestion', () => {
  it('calls onAnswer when an option is clicked', () => {
    const container = document.createElement('div');
    const onAnswer = vi.fn();
    const { correctIndex } = renderMcQuestion(container, sampleQuestion, { onAnswer });

    container.querySelector(`[data-index="${correctIndex}"]`).click();

    expect(onAnswer).toHaveBeenCalledOnce();
    expect(onAnswer.mock.calls[0][0].correct).toBe(true);
    expect(onAnswer.mock.calls[0][0].mode).toBe('mc');
  });

  it('selectOnly highlights the chosen option without grading UI', () => {
    const container = document.createElement('div');
    const onAnswer = vi.fn();
    renderMcQuestion(container, sampleQuestion, { selectOnly: true, onAnswer });

    const option = container.querySelector('[data-index="0"]');
    option.click();

    expect(onAnswer).toHaveBeenCalledOnce();
    expect(option.classList.contains('option-selected')).toBe(true);
    expect(container.querySelector('.feedback')).toBeNull();
  });

  it('cleans up keyboard handler from the render container', () => {
    const container = document.createElement('div');
    renderMcQuestion(container, sampleQuestion, { onAnswer: vi.fn() });
    expect(container._mcKeyHandler).toBeTruthy();
    cleanupMcQuestion(container);
    expect(container._mcKeyHandler).toBeNull();
  });

  it('does not call onAnswer twice when the same option is double-clicked', () => {
    const container = document.createElement('div');
    const onAnswer = vi.fn();
    const { correctIndex } = renderMcQuestion(container, sampleQuestion, { onAnswer });

    const btn = container.querySelector(`[data-index="${correctIndex}"]`);
    btn.click();
    btn.click();

    expect(onAnswer).toHaveBeenCalledOnce();
  });
});
