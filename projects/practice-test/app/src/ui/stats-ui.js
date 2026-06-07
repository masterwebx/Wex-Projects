export function renderSimpleStats(stats, readiness) {
  return `
    <div class="simple-stats">
      <div class="simple-stat">
        <span class="simple-stat-num">${readiness.seenOnce}</span>
        <span class="simple-stat-label" title="Submitted at least one answer. Exiting without answering does not count.">Answered once</span>
      </div>
      <div class="simple-stat">
        <span class="simple-stat-num">${stats.new + stats.learning + stats.mc + stats.type}</span>
        <span class="simple-stat-label">Still learning</span>
      </div>
      <div class="simple-stat">
        <span class="simple-stat-num">${stats.mastered}</span>
        <span class="simple-stat-label">Memorized</span>
      </div>
      <div class="simple-stat">
        <span class="simple-stat-num">${readiness.recentWrong}</span>
        <span class="simple-stat-label">Missed this week</span>
      </div>
    </div>
  `;
}
