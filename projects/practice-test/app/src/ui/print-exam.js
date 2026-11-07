import { ensureDefaultTest, getQuestionsByTestId, getTest } from '../db.js';
import { getActiveTestId } from '../context.js';
import { sortQuestionsByNumber } from './helpers.js';
import { showPrintOptionsDialog } from './print-dialog.js';
import { renderExamPrintDocument } from './print-sheet.js';

const PRINT_OPTIONS = {
  title: 'How should answers appear?',
  options: [
    {
      id: 'none',
      label: 'Exam only',
      description: 'Full questions with no answers marked',
    },
    {
      id: 'key-only',
      label: 'Answer key only',
      description: 'A–D answer grid only, no question text',
    },
    {
      id: 'underlined',
      label: 'Underline correct answers',
      description: 'Mark the correct choice in each question',
    },
    {
      id: 'key-at-end',
      label: 'Answer key at the end',
      description: 'Clean exam, then the A–D answer key grid at the end',
    },
  ],
};

export async function renderPrintExam(container) {
  await ensureDefaultTest();

  const testId = getActiveTestId();
  const test = testId ? await getTest(testId) : null;

  if (!test) {
    container.innerHTML = `
      <section class="page print-exam-page-wrap">
        <div class="empty-state">
          <h2>No test selected</h2>
          <p>Choose a test from the header, then try Print Exam again.</p>
          <a href="#home" class="btn btn-primary">Go Home</a>
        </div>
      </section>
    `;
    return;
  }

  const questions = sortQuestionsByNumber(await getQuestionsByTestId(testId));
  if (questions.length === 0) {
    container.innerHTML = `
      <section class="page print-exam-page-wrap">
        <div class="empty-state">
          <h2>No questions in this test</h2>
          <a href="#questions" class="btn btn-primary">Add questions</a>
        </div>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="page print-exam-page-wrap no-print">
      <div class="print-exam-launching" aria-live="polite">Preparing print…</div>
    </section>
    <div class="print-only print-exam-print-root" aria-hidden="true"></div>
  `;

  const mode = await showPrintOptionsDialog(PRINT_OPTIONS);

  if (!mode) {
    if (window.location.hash.startsWith('#print-exam')) {
      window.location.hash = '#home';
    }
    return;
  }

  const printRoot = container.querySelector('.print-exam-print-root');
  if (printRoot) {
    printRoot.innerHTML = renderExamPrintDocument(questions, mode, { title: test.name });
  }

  const returnHome = () => {
    if (window.location.hash.startsWith('#print-exam')) {
      window.location.hash = '#home';
    }
  };

  window.addEventListener('afterprint', returnHome, { once: true });
  requestAnimationFrame(() => window.print());
}
