/** Mobile hamburger menu — UI only; does not touch storage or app data. */

let bound = false;

export function closeMobileNav() {
  document.body.classList.remove('nav-open');
  const toggle = document.querySelector('#nav-menu-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

export function initMobileNav() {
  if (bound) return;
  bound = true;

  const toggle = document.querySelector('#nav-menu-toggle');
  const panel = document.querySelector('#nav-links-panel');
  if (!toggle || !panel) return;

  toggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      panel.querySelector('.nav-link')?.focus();
    }
  });

  panel.addEventListener('click', (e) => {
    if (e.target.closest('.nav-link')) {
      closeMobileNav();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
      closeMobileNav();
      toggle.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('nav-open')) return;
    if (e.target.closest('.main-nav')) return;
    closeMobileNav();
  });
}
