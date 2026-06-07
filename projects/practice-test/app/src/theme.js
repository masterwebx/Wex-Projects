const THEME_KEY = 'theme';

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.dataset.theme = theme;
  updateThemeToggleLabel();
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  document.documentElement.dataset.theme = getTheme();
}

export function updateThemeToggleLabel() {
  const btn = document.querySelector('#theme-toggle');
  if (!btn) return;
  const isDark = getTheme() === 'dark';
  btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  btn.title = isDark ? 'Light mode' : 'Dark mode';
  btn.textContent = isDark ? '☀️' : '🌙';
}
