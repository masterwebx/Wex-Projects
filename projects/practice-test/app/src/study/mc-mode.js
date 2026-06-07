import { questionHeadingHtml } from '../ui/helpers.js';

export function shuffleOptions(options, correctIndex) {
  const items = options.map((text, index) => ({ text, originalIndex: index }));
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  const newCorrectIndex = items.findIndex((item) => item.originalIndex === correctIndex);
  return { shuffled: items, correctIndex: newCorrectIndex };
}

export function renderMcQuestion(
  container,
  question,
  { onAnswer, showResult = null, shuffle = null, compact = false, selectOnly = false } = {}
) {
  let shuffled;
  let correctIndex;

  if (shuffle) {
    shuffled = shuffle.shuffled;
    correctIndex = shuffle.correctIndex;
  } else {
    const result = shuffleOptions(question.options, question.correctIndex);
    shuffled = result.shuffled;
    correctIndex = result.correctIndex;
    container._mcShuffle = { shuffled, correctIndex };
  }

  const letters = ['A', 'B', 'C', 'D'];

  container.innerHTML = `
    <div class="study-question">
      ${questionHeadingHtml(question)}
      <div class="options-list" role="radiogroup" aria-label="Answer options">
        ${shuffled
          .map(
            (item, i) => `
          <button
            type="button"
            class="option-btn ${getOptionClass(i, showResult, correctIndex)}"
            data-index="${i}"
            role="radio"
            aria-checked="false"
            ${showResult !== null ? 'disabled' : ''}
          >
            <span class="option-letter">${letters[i]}</span>
            <span class="option-text">${escapeHtml(item.text)}</span>
          </button>
        `
          )
          .join('')}
      </div>
      ${
        showResult !== null && !compact
          ? `<div class="feedback ${showResult.correct ? 'correct' : 'incorrect'}">
              ${showResult.correct ? 'Correct!' : `Incorrect. The answer is ${letters[correctIndex]}.`}
            </div>`
          : ''
      }
    </div>
  `;

  if (showResult === null) {
    let answered = false;
    container.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const selected = parseInt(btn.dataset.index, 10);
        if (selectOnly) {
          container.querySelectorAll('.option-btn').forEach((b) => {
            const isSelected = b === btn;
            b.classList.toggle('option-selected', isSelected);
            b.setAttribute('aria-checked', isSelected ? 'true' : 'false');
          });
        } else {
          if (answered) return;
          answered = true;
          container.querySelectorAll('.option-btn').forEach((b) => {
            b.disabled = true;
          });
        }
        const correct = selected === correctIndex;
        onAnswer?.({ correct, selectedIndex: selected, correctIndex, mode: 'mc' });
      });
      btn.addEventListener('contextmenu', (event) => event.preventDefault());
    });

    container._mcKeyHandler = (e) => {
      const key = e.key;
      if (key >= '1' && key <= '4') {
        const idx = parseInt(key, 10) - 1;
        const btn = container.querySelector(`[data-index="${idx}"]`);
        if (btn && !btn.disabled) btn.click();
      }
    };
    document.addEventListener('keydown', container._mcKeyHandler);
  }

  return { shuffled, correctIndex, letters };
}

export function cleanupMcQuestion(container) {
  if (container._mcKeyHandler) {
    document.removeEventListener('keydown', container._mcKeyHandler);
    container._mcKeyHandler = null;
  }
  container._mcShuffle = null;
}

function getOptionClass(index, showResult, correctIndex) {
  if (showResult === null) return '';
  if (index === correctIndex) return 'option-correct';
  if (index === showResult.selectedIndex && !showResult.correct) return 'option-wrong';
  return 'option-dimmed';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
