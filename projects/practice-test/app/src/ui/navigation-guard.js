/** Block stray clicks that land on a new page after navigation or DOM swaps. */
let suppressUntil = 0;

function blockIfArmed(event) {
  if (performance.now() < suppressUntil) {
    if (event.target.closest('.main-nav, .app-footer')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

for (const type of ['click', 'mouseup', 'pointerup']) {
  document.addEventListener(type, blockIfArmed, true);
}

export function armGhostClickGuard(ms = 450) {
  suppressUntil = Math.max(suppressUntil, performance.now() + ms);
}

function navigateToHash(dest) {
  const hash = dest.startsWith('#') ? dest : `#${dest}`;
  armGhostClickGuard();
  requestAnimationFrame(() => {
    if (window.location.hash !== hash) {
      window.location.hash = hash.slice(1);
    } else {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  });
}

/** Defer in-app hash navigation so the initiating click cannot hit the next screen. */
export function initNavigationGuard() {
  document.addEventListener(
    'click',
    (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest('a[href^="#"]');
      if (!link || link.target === '_blank') return;

      const href = link.getAttribute('href');
      if (!href || href === '#' || href === '#app') return;

      event.preventDefault();
      event.stopPropagation();
      navigateToHash(href);
    },
    true
  );
}
