/** Run handler once; optionally disable a button for the duration. */
export function guardClick(element, handler, { disable = true } = {}) {
  element.addEventListener('click', async (event) => {
    if (element.dataset.busy === '1') return;
    element.dataset.busy = '1';
    if (disable) element.disabled = true;
    try {
      await handler(event);
    } finally {
      // Caller re-enables or replaces DOM when ready
    }
  });
}

/** Returns true if action should proceed (one-shot latch). */
export function latch(ref, key = 'locked') {
  if (ref[key]) return false;
  ref[key] = true;
  return true;
}
