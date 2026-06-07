import { escapeHtml } from './helpers.js';

export function renderReadinessCard(readiness) {
  const recs = readiness.recommendations
    .map(
      (r) =>
        `<li class="readiness-rec ${r.priority === 'high' ? 'readiness-rec-high' : ''}"><a href="${r.href}">${escapeHtml(r.label)}</a></li>`
    )
    .join('');

  const componentRows = (readiness.components || [])
    .map((c) => {
      const pctLabel = c.pending ? '—' : `${c.percent}%`;
      return `
        <tr>
          <th scope="row">${escapeHtml(c.label)} <span class="readiness-weight">(${c.weight}%)</span></th>
          <td class="readiness-pct">${pctLabel}</td>
          <td class="readiness-pts">+${c.points}</td>
        </tr>
        <tr class="readiness-component-desc">
          <td colspan="3">${escapeHtml(c.description)}</td>
        </tr>
      `;
    })
    .join('');

  const capNote = readiness.cappedWithoutMock
    ? '<p class="readiness-cap-note">Practice-only score — capped at 30 until you take a mock exam.</p>'
    : '';

  return `
    <section class="readiness-card" aria-labelledby="readiness-heading">
      <div class="readiness-score-ring" style="--readiness-pct: ${readiness.overall}" aria-hidden="true">
        <span class="readiness-score-num">${readiness.overall}</span>
      </div>
      <div class="readiness-body">
        <h2 id="readiness-heading">Exam readiness</h2>
        <p class="readiness-label">${escapeHtml(readiness.label)} — <strong>${readiness.overall}/100</strong></p>
        ${capNote}
        <table class="readiness-table">
          <caption class="sr-only">How your readiness score is calculated</caption>
          <thead>
            <tr>
              <th scope="col">Component</th>
              <th scope="col">Your %</th>
              <th scope="col">Points</th>
            </tr>
          </thead>
          <tbody>${componentRows}</tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td></td>
              <td class="readiness-pts-total"><strong>${readiness.overall}</strong></td>
            </tr>
          </tfoot>
        </table>
        ${recs ? `<ul class="readiness-recs">${recs}</ul>` : ''}
      </div>
    </section>
  `;
}
