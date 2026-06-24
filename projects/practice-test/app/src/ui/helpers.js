import { MC_PROMOTE_STREAK, TYPE_PROMOTE_STREAK } from '../srs.js';
import { getQuestionExplanation, hasCustomExplanation } from '../question-meta.js';

export { hasCustomExplanation };

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Normalize exam question number from import/form (optional field). */
export function normalizeQuestionNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0 && Number.isInteger(n)) return n;
  const s = String(value).trim();
  return s || null;
}

export function compareQuestionNumbers(a, b) {
  const na = normalizeQuestionNumber(a?.number);
  const nb = normalizeQuestionNumber(b?.number);
  const aNum = typeof na === 'number';
  const bNum = typeof nb === 'number';
  if (aNum && bNum) return na - nb;
  if (aNum) return -1;
  if (bNum) return 1;
  if (na && nb) return String(na).localeCompare(String(nb));
  return 0;
}

export function sortQuestionsByNumber(questions) {
  return [...questions].sort((a, b) => {
    const cmp = compareQuestionNumbers(a, b);
    if (cmp !== 0) return cmp;
    return a.id.localeCompare(b.id);
  });
}

export function questionNumberHtml(number) {
  const n = normalizeQuestionNumber(number);
  if (n === null) return '';
  return `<span class="q-number-badge">#${escapeHtml(String(n))}</span>`;
}

export function questionHeadingHtml(question) {
  const badge = questionNumberHtml(question.number);
  return `<p class="question-text">${badge}<span class="question-text-body">${escapeHtml(question.question)}</span></p>`;
}

export function autoResizeTextarea(textarea) {
  const resize = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };
  textarea.addEventListener('input', resize);
  resize();
}

export function practiceCategoryLink(category) {
  if (!category || category === 'all') return '#practice?quick=1';
  return `#practice?quick=1&category=${encodeURIComponent(category)}`;
}

export function todayPracticeLink() {
  return '#practice?quick=1';
}

export function explanationBlockHtml(question) {
  if (!hasCustomExplanation(question)) return '';
  const text = getQuestionExplanation(question);
  return `<div class="question-explanation" role="note"><span class="explanation-label">Why this is correct</span><p class="explanation-text">${escapeHtml(text)}</p></div>`;
}

export function friendlyStage(stage) {
  const labels = {
    new: 'Not started',
    learning: 'Needs practice',
    mc: 'Learning',
    type: 'Almost there',
    mastered: 'Memorized',
  };
  return labels[stage] || 'Not started';
}

export function stageFilterLabel(stage) {
  const labels = {
    '': 'All stages',
    new: 'Not started',
    learning: 'Needs practice',
    mc: 'Learning',
    type: 'Almost there',
    mastered: 'Memorized',
    due: 'Ready to review',
  };
  return labels[stage] || stage;
}

export function renderHelpContent() {
  return `
    <ol class="help-steps">
      <li><strong>Manage Tests</strong> — Create a test for each exam or subject.</li>
      <li><strong>Add Questions</strong> — Type each question and four choices. Add a <strong>category</strong> to group by topic.</li>
      <li><strong>Study</strong> — Pick a category and read questions with correct answers shown (no shuffling, no scoring).</li>
      <li><strong>Practice</strong> — Spaced repetition sessions (default 20 questions, auto answer mode). Home shortcuts and category Practice buttons start a session immediately.</li>
      <li><strong>Mock exam</strong> — Timed simulation with no hints (60, 90, or 120 minutes). Only a <strong>full</strong> mock exam (all categories, every question) unlocks your readiness score above 30. Previous results appear on Practice and Mock Exam setup — click a row to review answers.</li>
      <li><strong>Progress</strong> — Exam readiness score, study stats, activity calendar, and per-category breakdown.</li>
      <li><strong>Home</strong> — Quick links to start today&rsquo;s practice, review mistakes, or try new questions.</li>
      <li><strong>Review mistakes</strong> — Questions you missed on the last attempt or within the past week (up to 50 per session).</li>
      <li><strong>Explanations</strong> — Shown after each practice answer when a custom explanation exists on the question.</li>
    </ol>

    <h3>What does &ldquo;memorized&rdquo; mean?</h3>
    <ul class="help-list">
      <li><strong>Multiple choice</strong> — Pick the right answer (${MC_PROMOTE_STREAK} correct in a row to advance).</li>
      <li><strong>Type answer</strong> — Type from memory, compare, and self-grade.</li>
      <li><strong>Memorized</strong> — ${TYPE_PROMOTE_STREAK} typed self-grades marked correct in a row. Then reviewed on days 1, 3, 7, 14, and 30.</li>
    </ul>

    <h3>What does &ldquo;ready to review&rdquo; mean?</h3>
    <p>Not a category — it&rsquo;s how many questions are due <strong>right now</strong>. New questions and recent misses are always ready. Memorized ones return on their review schedule.</p>

    <h3>How sessions work</h3>
    <p>Default session size is <strong>20 questions</strong> (~15 min). Pick 10, 20, 30, all due, or a custom count on the Practice setup screen. Typed answers auto-match when close; you can override. Remaining due questions stay for your next session.</p>
  `;
}
