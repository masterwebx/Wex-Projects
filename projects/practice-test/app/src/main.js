import '../styles/main.css';
import { registerSW } from 'virtual:pwa-register';
import { initTheme, toggleTheme, updateThemeToggleLabel } from './theme.js';

registerSW({ immediate: true });
import { renderDashboard } from './ui/dashboard.js';
import { renderBrowse, renderAddEditForm } from './ui/browse.js';
import { renderImportQuestions } from './ui/import-questions.js';
import { renderStudy } from './ui/study.js';
import { renderStudyList } from './ui/study-list.js';
import { renderProgress } from './ui/progress.js';
import { renderExam } from './ui/exam.js';
import { renderHelp } from './ui/help.js';
import { renderSettings } from './ui/settings.js';
import { renderTests } from './ui/tests.js';
import { renderTestSelector } from './ui/test-selector.js';
import { renderAnswerKey } from './ui/answer-key.js';
import { getQuestion, seedBundledExams } from './db.js';
import { resetSessionChrome } from './ui/session-chrome.js';

initTheme();

const app = document.querySelector('#app');

function ensureHashRoute() {
  const hash = window.location.hash;
  if (!hash || hash === '#') {
    history.replaceState(null, '', '#home');
  }
}

function parseRoute() {
  ensureHashRoute();
  const raw = window.location.hash.slice(1) || 'home';
  const [path, queryString] = raw.split('?');
  const params = {};
  if (queryString) {
    new URLSearchParams(queryString).forEach((v, k) => {
      params[k] = v;
    });
  }
  return { path: path || 'home', params };
}

let renderGen = 0;

async function render() {
  const gen = ++renderGen;
  if (!app) {
    document.body.innerHTML =
      '<div class="empty-state" style="padding:2rem;text-align:center"><p>App failed to load. Try refreshing the page.</p></div>';
    return;
  }

  resetSessionChrome();

  const { path, params } = parseRoute();
  app.innerHTML = '<div class="loading">Loading...</div>';

  try {
    if (path === 'home' || path === 'dashboard') {
      await renderDashboard(app);
    } else if (path === 'practice') {
      await renderStudy(app, params);
    } else if (path === 'study') {
      await renderStudyList(app, params);
    } else if (path === 'progress') {
      await renderProgress(app, params);
    } else if (path === 'exam') {
      await renderExam(app, params);
    } else if (path === 'questions' || path === 'browse') {
      await renderBrowse(app);
    } else if (path === 'add') {
      await renderAddEditForm(app);
    } else if (path === 'import') {
      await renderImportQuestions(app);
    } else if (path.startsWith('edit/')) {
      const id = path.slice(5);
      const question = await getQuestion(id);
      if (gen !== renderGen) return;
      if (question) {
        await renderAddEditForm(app, question);
      } else {
        app.innerHTML =
          '<div class="empty-state"><p>That question could not be found.</p><a href="#questions" class="btn btn-primary">Back to My Questions</a></div>';
      }
    } else if (path === 'tests') {
      await renderTests(app);
    } else if (path === 'help') {
      await renderHelp(app);
    } else if (path === 'answer-key') {
      await renderAnswerKey(app, t);
    } else if (path === 'backup' || path === 'settings') {
      await renderSettings(app);
    } else {
      app.innerHTML =
        '<div class="empty-state"><p>Page not found.</p><a href="#home" class="btn btn-primary">Go Home</a></div>';
    }
  } catch (err) {
    if (gen !== renderGen) return;
    app.innerHTML = `<div class="empty-state"><p>Something went wrong: ${err.message}</p><a href="#home" class="btn btn-primary">Go Home</a></div>`;
    console.error(err);
  }

  if (gen !== renderGen) return;

  updateNavActive(path);
  await renderTestSelector(document.querySelector('#test-selector'));
}

function updateNavActive(path) {
  const routeMap = {
    home: 'home',
    dashboard: 'home',
    practice: 'practice',
    study: 'study',
    progress: 'progress',
    exam: 'exam',
    questions: 'questions',
    browse: 'questions',
    add: 'questions',
    import: 'questions',
    tests: 'tests',
  };
  const base = path.startsWith('edit/') ? 'questions' : routeMap[path.split('/')[0]] || path;
  document.querySelectorAll('.nav-link').forEach((link) => {
    const isActive = link.dataset.route === base;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function initShell() {
  const themeBtn = document.querySelector('#theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
    updateThemeToggleLabel();
  }
}

async function boot() {
  await seedBundledExams();
  await render();
}

initShell();
window.addEventListener('hashchange', render);
boot();
