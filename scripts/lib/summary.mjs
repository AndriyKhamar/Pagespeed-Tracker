export function emptySummary(url, slug, thresholds) {
  return { url, slug, updatedAt: null, series: { mobile: [], desktop: [] }, thresholds };
}

export function appendPoint(summary, run) {
  const point = { t: run.fetchedAt, score: run.score, lcp: run.metrics.lcp, cls: run.metrics.cls, tbt: run.metrics.tbt };
  if (!summary.series[run.strategy]) summary.series[run.strategy] = [];
  summary.series[run.strategy].push(point);
  summary.updatedAt = run.fetchedAt;
  return summary;
}

export function pruneSummary(summary, startDate) {
  for (const key of Object.keys(summary.series)) {
    summary.series[key] = summary.series[key].filter((p) => new Date(p.t) >= startDate);
  }
  return summary;
}
