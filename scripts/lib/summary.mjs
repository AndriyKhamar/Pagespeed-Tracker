export function emptySummary(url, slug, thresholds, label = null) {
  return { url, slug, label, updatedAt: null, series: { mobile: [], desktop: [] }, thresholds };
}

export function appendPoint(summary, run) {
  const point = {
    t: run.fetchedAt, score: run.score,
    fcp: run.metrics.fcp, lcp: run.metrics.lcp, tbt: run.metrics.tbt, cls: run.metrics.cls, si: run.metrics.si
  };
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
