/**
 * Parse question import JSON into reviewable drafts.
 *
 * Accepted shapes:
 *   [ { question, options, correctIndex }, ... ]
 *   { "questions": [ ... ] }
 *
 * Per-question fields:
 *   question (or q)
 *   options | choices | answers  — array of 4 strings
 *   correctIndex | correct        — 0–3
 *   correctAnswer                  — "A"–"D" or full answer text
 *   number | questionNumber     — exam question # (for scan verification)
 *   category (optional)
 */

import { normalizeQuestionNumber } from '../ui/helpers.js';

export function extractQuestionArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.questions)) return data.questions;
  throw new Error('JSON must be an array of questions, or an object with a "questions" array.');
}

function padOptions(options) {
  const opts = [...options];
  while (opts.length < 4) opts.push('');
  return opts.slice(0, 4).map((o) => String(o ?? '').trim());
}

function resolveCorrectIndex(raw, options) {
  if (typeof raw.correctIndex === 'number' && raw.correctIndex >= 0 && raw.correctIndex <= 3) {
    return raw.correctIndex;
  }
  if (typeof raw.correct === 'number' && raw.correct >= 0 && raw.correct <= 3) {
    return raw.correct;
  }

  const ans = raw.correctAnswer ?? raw.correct_answer ?? raw.answer;
  if (typeof ans === 'string') {
    const letter = ans.trim().toUpperCase();
    if (letter.length === 1 && letter >= 'A' && letter <= 'D') {
      return letter.charCodeAt(0) - 65;
    }
    const normalized = normalize(ans);
    const idx = options.findIndex((o) => normalize(o) === normalized);
    if (idx >= 0) return idx;
    const partial = options.findIndex((o) => o && normalized.includes(normalize(o)));
    if (partial >= 0) return partial;
  }

  return null;
}

function normalize(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function validateDraft(draft) {
  const issues = [];
  if (!draft.question) issues.push('Missing question text');
  const filled = draft.options.filter((o) => o.length > 0);
  if (filled.length < 2) issues.push('Need at least 2 answer choices');
  if (draft.options.some((o, i) => i < 4 && !o)) issues.push('Some answer choices are empty');
  if (draft.correctIndex === null || draft.correctIndex < 0 || draft.correctIndex > 3) {
    issues.push('Missing or invalid correct answer');
  } else if (!draft.options[draft.correctIndex]?.trim()) {
    issues.push('Correct answer points to an empty choice');
  }
  if (rawNeedsReview(draft._raw)) issues.push('Flagged for review');
  return issues;
}

function rawNeedsReview(raw) {
  return raw.needs_review === true || raw.needsReview === true;
}

export function normalizeImportItem(raw, index) {
  const question = String(raw.question ?? raw.q ?? '').trim();

  let options = raw.options ?? raw.choices ?? raw.answers;
  if (!Array.isArray(options)) {
    options = [raw.optionA, raw.optionB, raw.optionC, raw.optionD].filter((x) => x !== undefined);
  }
  if (!Array.isArray(options)) options = [];

  options = padOptions(options);
  let correctIndex = resolveCorrectIndex(raw, options);
  const number = normalizeQuestionNumber(raw.number ?? raw.questionNumber ?? raw.qNumber);

  const draft = {
    _importId: `draft_${index}_${Date.now()}`,
    _raw: raw,
    number,
    question,
    options,
    correctIndex,
    category: String(raw.category ?? '').trim(),
    explanation: String(raw.explanation ?? raw.rationale ?? '').trim(),
    included: true,
  };

  draft.issues = validateDraft(draft);
  if (draft.issues.length > 0 && !rawNeedsReview(raw)) {
    // Still includable if user fixes in review
  }

  return draft;
}

function flagDuplicateNumbers(drafts) {
  const seen = new Map();
  for (const draft of drafts) {
    const n = normalizeQuestionNumber(draft.number);
    if (n === null) continue;
    const key = String(n);
    if (seen.has(key)) {
      if (!draft.issues.includes(`Duplicate question number #${key}`)) {
        draft.issues.push(`Duplicate question number #${key}`);
      }
    } else {
      seen.set(key, true);
    }
  }
}

export function parseImportJson(data) {
  const items = extractQuestionArray(data);
  if (items.length === 0) throw new Error('No questions found in the file.');
  const drafts = items.map((raw, i) => normalizeImportItem(raw, i));
  flagDuplicateNumbers(drafts);
  return drafts;
}

export function revalidateDraft(draft) {
  draft.issues = validateDraft(draft);
  return draft;
}

export function parseImportFileText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  return parseImportJson(data);
}
