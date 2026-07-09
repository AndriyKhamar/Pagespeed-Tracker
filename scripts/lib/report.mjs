const STRATEGIES = ['mobile', 'desktop'];
const ICON = { mobile: ':iphone:', desktop: ':desktop_computer:' };

function line(summary, strategy) {
  const point = summary.series?.[strategy]?.at(-1);
  const target = summary.thresholds?.[strategy];
  if (!point) return `  ${ICON[strategy]} ${strategy}: no data`;
  const mark = point.score >= target ? ':white_check_mark:' : ':red_circle:';
  return `  ${ICON[strategy]} ${strategy}: *${point.score}* / ${target} ${mark}`;
}

// Pure formatter so it's testable without hitting Slack or the filesystem.
export function dailyReport(summaries, { dashboardUrl, date } = {}) {
  const head = `:bar_chart: *Daily PageSpeed report* — ${date ?? ''}`.trimEnd();
  const blocks = summaries.map((s) => {
    const title = s.label ?? s.url;
    return [`*${title}*`, ...STRATEGIES.map((st) => line(s, st))].join('\n');
  });
  const body = blocks.length ? blocks.join('\n') : '_No environments configured._';
  const footer = dashboardUrl ? `\n<${dashboardUrl}|Open dashboard>` : '';
  return `${head}\n\n${body}${footer}`;
}
