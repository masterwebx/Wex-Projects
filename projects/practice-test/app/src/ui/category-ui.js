import { escapeHtml, practiceCategoryLink } from './helpers.js';

function studyCategoryLink(category) {
  if (!category || category === 'all') return '#study';
  return `#study?category=${encodeURIComponent(category)}`;
}

function renderCompactCategoryRow(cat) {
  const seenPercent = cat.total > 0 ? Math.round((cat.seenOnce / cat.total) * 100) : 0;
  const meta = cat.isComplete
    ? `All ${cat.total} memorized`
    : `${cat.seenOnce}/${cat.total} seen · ${cat.masteredPercent}% memorized`;

  return `
    <li class="category-compact-row ${cat.needsFocus ? 'category-compact-focus' : ''} ${cat.isComplete ? 'category-compact-done' : ''}">
      <div class="category-compact-main">
        <span class="category-compact-name">${escapeHtml(cat.name)}</span>
        <div
          class="category-progress-track category-progress-dual"
          role="progressbar"
          aria-valuenow="${seenPercent}"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="${seenPercent}% seen, ${cat.masteredPercent}% memorized"
        >
          <div class="category-progress-fill category-progress-fill-seen" style="width: ${seenPercent}%"></div>
          <div class="category-progress-fill category-progress-fill-memorized" style="width: ${cat.masteredPercent}%"></div>
        </div>
        <span class="category-compact-meta">${meta}</span>
      </div>
      <div class="category-compact-actions">
        <a href="${studyCategoryLink(cat.name)}" class="btn btn-small btn-secondary">Study</a>
        <a href="${practiceCategoryLink(cat.name)}" class="btn btn-small btn-secondary">Practice</a>
      </div>
    </li>
  `;
}

export function renderCompactCategorySection(categoryStats, weakest) {
  if (!categoryStats.length) return '';

  const weakestNote = weakest
    ? `<p class="category-compact-weakest"><strong>Weakest:</strong> ${escapeHtml(weakest.name)} (${weakest.masteredPercent}% memorized)</p>`
    : '';

  return `
    <section class="category-section category-section-compact" aria-labelledby="category-progress-heading">
      <h2 id="category-progress-heading">By category</h2>
      <p class="category-compact-legend">Bar: <span class="legend-seen">blue</span> = seen · <span class="legend-memorized">green</span> = memorized</p>
      ${weakestNote}
      <ul class="category-compact-list">
        ${categoryStats.map(renderCompactCategoryRow).join('')}
      </ul>
    </section>
  `;
}
