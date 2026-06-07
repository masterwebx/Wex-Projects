/** Hide nav/footer and lock layout while practice or mock exam is in progress. */
export function setSessionChrome(active) {
  document.body.classList.toggle('session-active', active);
  document.getElementById('app')?.classList.toggle('practice-session-active', active);
}

export function resetSessionChrome() {
  setSessionChrome(false);
}
