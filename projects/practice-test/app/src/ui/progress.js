import { getAllQuestions, getAllProgress, getTest, ensureDefaultTest } from '../db.js';
import { getActiveTestId, getExamHistory } from '../context.js';
import {
  computeExamReadiness,
  buildCategoryStats,
  buildStats,
  getTestReadiness,
  getWeakestCategory,
  needsCategoryBanner,
} from '../srs.js';
import { buildDailyActivity, hasActivity, activityTypes } from '../activity-log.js';
import { toLocalDateKey } from '../date-utils.js';
import { escapeHtml } from './helpers.js';
import { renderReadinessCard } from './readiness-ui.js';
import { renderCompactCategorySection } from './category-ui.js';
import { renderSimpleStats } from './stats-ui.js';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDayDetail(dateKey, day) {
  const items = [];
  if (day.practiceAnswers > 0) {
    const acc = Math.round((day.practiceCorrect / day.practiceAnswers) * 100);
    items.push(
      `<li class="activity-detail-item activity-detail-practice"><span class="activity-type-badge activity-badge-practice">Practice</span> ${day.practiceAnswers} answer${day.practiceAnswers === 1 ? '' : 's'} submitted (${acc}% correct)</li>`
    );
  }
  for (const exam of day.exams) {
    const scope =
      exam.category && exam.category !== 'all' ? escapeHtml(exam.category) : 'All categories';
    const fullLabel = exam.isFullExam ? ' · full exam' : '';
    const passLabel = exam.passed ? ' · passed' : '';
    items.push(
      `<li class="activity-detail-item activity-detail-exam"><span class="activity-type-badge activity-badge-exam">Mock exam</span> ${exam.correct}/${exam.total} (${exam.percent}%) — ${scope}${fullLabel}${passLabel}</li>`
    );
  }
  return items.join('');
}

function renderActivityDots(types) {
  if (!types.length) return '';
  const dots = types
    .map((type) => `<span class="cal-dot cal-dot-${type}" aria-hidden="true"></span>`)
    .join('');
  return `<span class="cal-dot-row">${dots}</span>`;
}

function renderCalendarMonth(year, month, activityMap, selectedDate) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toLocalDateKey();
  const cells = [];

  for (let i = 0; i < startPad; i++) {
    cells.push('<td class="cal-cell cal-empty" aria-hidden="true"></td>');
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const activity = activityMap.get(dateKey);
    const active = activity && hasActivity(activity);
    const types = active ? activityTypes(activity) : [];
    const isToday = dateKey === todayKey;
    const isSelected = dateKey === selectedDate;
    const label = active
      ? `${day}: ${types.join(' and ')}`
      : `${day}: no activity`;

    cells.push(`
      <td class="cal-cell">
        <button
          type="button"
          class="cal-day ${active ? 'cal-day-active' : ''} ${isToday ? 'cal-today' : ''} ${isSelected ? 'cal-selected' : ''}"
          data-date="${dateKey}"
          aria-label="${label}"
          aria-pressed="${isSelected ? 'true' : 'false'}"
          ${active ? '' : 'disabled'}
        >
          <span class="cal-day-num">${day}</span>
          ${active ? renderActivityDots(types) : ''}
        </button>
      </td>
    `);
  }

  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells.push('<td class="cal-cell cal-empty" aria-hidden="true"></td>');
    }
  }

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
  }

  const monthLabel = first.toLocaleString('default', { month: 'long', year: 'numeric' });

  return `
    <div class="activity-calendar" data-year="${year}" data-month="${month}">
      <div class="cal-header">
        <button type="button" class="btn btn-small btn-secondary cal-nav" data-cal-nav="prev" aria-label="Previous month">←</button>
        <h3 class="cal-month-label">${monthLabel}</h3>
        <button type="button" class="btn btn-small btn-secondary cal-nav" data-cal-nav="next" aria-label="Next month">→</button>
      </div>
      <table class="cal-table" role="grid" aria-label="Study activity calendar">
        <thead>
          <tr>${WEEKDAY_LABELS.map((d) => `<th scope="col" class="cal-weekday">${d}</th>`).join('')}</tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <div class="cal-legend">
        <span class="cal-legend-item"><span class="cal-dot cal-dot-practice"></span> Practice</span>
        <span class="cal-legend-item"><span class="cal-dot cal-dot-exam"></span> Mock exam</span>
      </div>
    </div>
  `;
}

function renderActivityDetail(selectedDate, activityMap) {
  const selectedDay = selectedDate ? activityMap.get(selectedDate) : null;
  const detailHtml =
    selectedDay && hasActivity(selectedDay)
      ? `<ul class="activity-detail-list">${formatDayDetail(selectedDate, selectedDay)}</ul>`
      : '<p class="activity-detail-empty">Select a highlighted day to see what you studied.</p>';

  const detailHeading = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Activity details';

  return `
    <div class="activity-detail-panel">
      <h3 class="activity-detail-heading">${escapeHtml(detailHeading)}</h3>
      ${detailHtml}
    </div>
  `;
}

function syncProgressHash(year, month, date) {
  const qs = new URLSearchParams();
  qs.set('year', String(year));
  qs.set('month', String(month));
  if (date) qs.set('date', date);
  const hash = `#progress?${qs.toString()}`;
  if (window.location.hash !== hash) {
    history.replaceState(null, '', hash);
  }
}

function resolveSelectedDate(params, activityMap, now) {
  let selectedDate = params.date || '';
  if (selectedDate) {
    const day = activityMap.get(selectedDate);
    if (!day || !hasActivity(day)) selectedDate = '';
  }
  if (!selectedDate) {
    const todayKey = toLocalDateKey(now);
    const todayActivity = activityMap.get(todayKey);
    if (todayActivity && hasActivity(todayActivity)) {
      selectedDate = todayKey;
    } else {
      const sorted = [...activityMap.entries()]
        .filter(([, d]) => hasActivity(d))
        .sort((a, b) => b[0].localeCompare(a[0]));
      selectedDate = sorted[0]?.[0] || '';
    }
  }
  return selectedDate;
}

export async function renderProgress(container, params = {}) {
  await ensureDefaultTest();
  const testId = getActiveTestId();
  const test = testId ? await getTest(testId) : null;
  const questions = await getAllQuestions(testId);
  const progress = await getAllProgress();
  const qIds = questions.map((q) => q.id);
  const scopedProgress = progress.filter((p) => qIds.includes(p.questionId));
  const examHistory = getExamHistory(testId);
  const stats = buildStats(questions, scopedProgress);
  const testReadiness = getTestReadiness(questions, scopedProgress);
  const readiness = computeExamReadiness(questions, scopedProgress, examHistory);
  const activityMap = buildDailyActivity(scopedProgress, examHistory, qIds);
  const categoryStats = buildCategoryStats(questions, scopedProgress);
  const weakest = getWeakestCategory(categoryStats);
  const showCategoryBanner = needsCategoryBanner(questions);

  const now = new Date();
  let viewYear = parseInt(params.year, 10);
  let viewMonth = parseInt(params.month, 10);
  if (!Number.isFinite(viewYear) || !Number.isFinite(viewMonth) || viewMonth < 0 || viewMonth > 11) {
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
  }

  let selectedDate = resolveSelectedDate(params, activityMap, now);

  container.innerHTML = `
    <section class="page progress-page">
      <header class="page-header">
        <p class="breadcrumb">${test ? escapeHtml(test.name) : 'Practice Test'} › Progress</p>
        <h1>Progress</h1>
        <p class="subtitle">Readiness, history, and category breakdown</p>
      </header>

      ${
        questions.length === 0
          ? `<div class="empty-state"><p>Add questions and start practicing to track progress.</p><a href="#add" class="btn btn-primary">Add questions</a></div>`
          : `
        ${showCategoryBanner ? `<div class="category-banner category-banner-compact"><strong>Tip:</strong> Many questions have no category — add topics when editing questions.</div>` : ''}
        <div class="progress-layout">
          ${renderSimpleStats(stats, testReadiness)}
          ${renderReadinessCard(readiness)}
          <section class="activity-section" aria-labelledby="activity-heading">
            <h2 id="activity-heading">Study calendar</h2>
            <p class="activity-section-desc">Colored dots show practice (blue) or mock exam (green).</p>
            <div id="activity-calendar-host">
              ${renderCalendarMonth(viewYear, viewMonth, activityMap, selectedDate)}
            </div>
            <div id="activity-detail-host">
              ${renderActivityDetail(selectedDate, activityMap)}
            </div>
          </section>
          ${renderCompactCategorySection(categoryStats, weakest)}
        </div>
      `
      }
    </section>
  `;

  const calendarHost = container.querySelector('#activity-calendar-host');
  const detailHost = container.querySelector('#activity-detail-host');
  if (!calendarHost || !detailHost) return;

  function refreshActivityUI() {
    calendarHost.innerHTML = renderCalendarMonth(viewYear, viewMonth, activityMap, selectedDate);
    detailHost.innerHTML = renderActivityDetail(selectedDate, activityMap);
    syncProgressHash(viewYear, viewMonth, selectedDate);
  }

  container.addEventListener('click', (event) => {
    const navBtn = event.target.closest('[data-cal-nav]');
    if (navBtn) {
      event.preventDefault();
      if (navBtn.dataset.calNav === 'prev') {
        viewMonth--;
        if (viewMonth < 0) {
          viewMonth = 11;
          viewYear--;
        }
      } else {
        viewMonth++;
        if (viewMonth > 11) {
          viewMonth = 0;
          viewYear++;
        }
      }
      refreshActivityUI();
      return;
    }

    const dayBtn = event.target.closest('.cal-day-active');
    if (dayBtn) {
      event.preventDefault();
      selectedDate = dayBtn.dataset.date;
      refreshActivityUI();
    }
  });
}
