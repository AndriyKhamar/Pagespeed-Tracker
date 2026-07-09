export function alertText({ label, url, strategy, score, threshold, dashboardUrl }) {
  const head = `:rotating_light: *${label ?? url}* — ${strategy} PageSpeed score *${score}* is below target ${threshold}`;
  const links = dashboardUrl ? `<${dashboardUrl}|View dashboard> · ${url}` : url;
  return `${head}\n${links}`;
}

// ponytail: no retry/backoff — a dropped hourly alert simply re-fires next run if still breached.
export async function postSlack(webhookUrl, text) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
}
