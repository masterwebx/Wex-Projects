export function normalizeQuestionText(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function hasCustomExplanation(question) {
  return Boolean(question.explanation?.trim());
}

/** Returns the stored explanation only — no auto-generated fallback. */
export function getQuestionExplanation(question) {
  return question.explanation?.trim() || '';
}

export function isDuplicateQuestion(existing, candidate) {
  const existingNorm = normalizeQuestionText(existing.question);
  const candidateNorm = normalizeQuestionText(candidate.question);
  if (existingNorm && candidateNorm && existingNorm === candidateNorm) return true;

  const en = existing.number;
  const cn = candidate.number;
  if (en != null && cn != null && String(en) === String(cn)) return true;

  return false;
}

/** Flag import drafts that match questions already in the active test. */
export function flagExistingDuplicates(drafts, existingQuestions) {
  for (const draft of drafts) {
    const dup = existingQuestions.find((q) => isDuplicateQuestion(q, draft));
    if (dup) {
      const msg = `Already in your test${dup.number != null ? ` (#${dup.number})` : ''}`;
      if (!draft.issues.includes(msg)) draft.issues.push(msg);
      draft.duplicateOfId = dup.id;
      draft.included = false;
    }
  }
  return drafts;
}
