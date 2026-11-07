import { questionHeadingHtml, escapeHtml } from '../ui/helpers.js';

export function normalizeAnswer(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function similarity(a, b) {
  const na = normalizeAnswer(a);
  const nb = normalizeAnswer(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  return 1 - dist / maxLen;
}

export function checkTypedAnswer(input, question, threshold = 0.9) {
  const correctText = question.options[question.correctIndex];
  const letters = ['a', 'b', 'c', 'd'];
  const normalized = normalizeAnswer(input);

  if (letters.includes(normalized)) {
    const letterIndex = letters.indexOf(normalized);
    if (letterIndex === question.correctIndex) {
      return { correct: true, matchType: 'letter', similarity: 1 };
    }
  }

  const sim = similarity(input, correctText);
  if (sim >= threshold) {
    return { correct: true, matchType: 'text', similarity: sim };
  }

  return { correct: false, matchType: 'none', similarity: sim, expected: correctText };
}

function typeRevealHtml(userInput, correctText) {
  return `
    <div class="type-reveal type-reveal-compare type-reveal-compact">
      <div class="type-reveal-col">
        <p class="type-reveal-label">Your answer</p>
        <p class="type-reveal-value">${escapeHtml(userInput || '(blank)')}</p>
      </div>
      <div class="type-reveal-col">
        <p class="type-reveal-label">Correct answer</p>
        <p class="type-reveal-value correct-answer">${escapeHtml(correctText)}</p>
      </div>
    </div>
  `;
}

export function renderTypeQuestion(container, question, { onAnswer, showResult = null } = {}) {
  const correctText = question.options[question.correctIndex];

  if (showResult !== null) {
    container.innerHTML = `
      <div class="study-question type-mode type-graded">
        ${questionHeadingHtml(question)}
        ${typeRevealHtml(showResult.input, correctText)}
      </div>
    `;
    return;
  }

  let graded = false;

  function submitGrade(correct, userInput, extra = {}) {
    if (graded) return;
    graded = true;
    onAnswer({ correct, input: userInput, mode: 'type', ...extra });
  }

  function bindSelfGradeButtons(bindings) {
    const buttons = container.querySelectorAll('.self-grade-actions button');
    let localGraded = false;
    for (const { id, handler } of bindings) {
      container.querySelector(id)?.addEventListener('click', () => {
        if (localGraded) return;
        localGraded = true;
        buttons.forEach((b) => {
          b.disabled = true;
        });
        handler();
      });
    }
  }

  function renderReveal(userInput) {
    container.innerHTML = `
      <div class="study-question type-mode type-self-grade">
        ${questionHeadingHtml(question)}
        ${typeRevealHtml(userInput, correctText)}
        <div class="self-grade-actions">
          <button type="button" class="btn btn-primary btn-small" id="grade-correct">I got it right</button>
          <button type="button" class="btn btn-secondary btn-small" id="grade-wrong">I got it wrong</button>
        </div>
      </div>
    `;

    bindSelfGradeButtons([
      { id: '#grade-correct', handler: () => submitGrade(true, userInput, { selfGraded: true }) },
      { id: '#grade-wrong', handler: () => submitGrade(false, userInput, { selfGraded: true }) },
    ]);
  }

  function renderCloseMatch(userInput, check) {
    const pct = Math.round(check.similarity * 100);
    container.innerHTML = `
      <div class="study-question type-mode type-close-match">
        ${questionHeadingHtml(question)}
        ${typeRevealHtml(userInput, correctText)}
        <p class="close-match-hint">Close match (${pct}% similar) — count as correct?</p>
        <div class="self-grade-actions">
          <button type="button" class="btn btn-primary btn-small" id="grade-correct">Count as correct</button>
          <button type="button" class="btn btn-secondary btn-small" id="grade-wrong">Count as wrong</button>
          <button type="button" class="btn btn-muted btn-small" id="grade-manual">Compare myself</button>
        </div>
      </div>
    `;

    bindSelfGradeButtons([
      {
        id: '#grade-correct',
        handler: () =>
          submitGrade(true, userInput, { selfGraded: true, closeMatch: true, similarity: check.similarity }),
      },
      {
        id: '#grade-wrong',
        handler: () =>
          submitGrade(false, userInput, { selfGraded: true, closeMatch: true, similarity: check.similarity }),
      },
      { id: '#grade-manual', handler: () => renderReveal(userInput) },
    ]);
  }

  container.innerHTML = `
    <div class="study-question type-mode">
      ${questionHeadingHtml(question)}
      <form class="type-form" id="type-form">
        <input
          type="text"
          class="type-input"
          id="type-input"
          placeholder="Type your answer..."
          autocomplete="off"
        />
        <button type="submit" class="btn btn-primary">Check</button>
      </form>
    </div>
  `;

  const form = container.querySelector('#type-form');
  const input = container.querySelector('#type-input');
  input.focus();

  let submitted = false;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (submitted) return;
    const userInput = input.value.trim();
    const check = checkTypedAnswer(userInput, question);
    if (check.correct) {
      submitted = true;
      form.querySelector('button[type="submit"]')?.setAttribute('disabled', '');
      input.disabled = true;
      submitGrade(true, userInput, { autoGraded: true, matchType: check.matchType });
      return;
    }
    submitted = true;
    form.querySelector('button[type="submit"]')?.setAttribute('disabled', '');
    input.disabled = true;
    if (check.similarity >= 0.75) {
      renderCloseMatch(userInput, check);
      return;
    }
    renderReveal(userInput);
  });
}
