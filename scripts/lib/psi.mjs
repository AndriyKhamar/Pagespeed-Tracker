const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export function buildPsiUrl(url, strategy, apiKey = process.env.PSI_API_KEY) {
  const p = new URLSearchParams({ url, strategy, category: 'performance' });
  if (apiKey) p.set('key', apiKey);
  return `${ENDPOINT}?${p.toString()}`;
}

export function parsePsi(json, { url, strategy, fetchedAt }) {
  const lr = json?.lighthouseResult;
  const score = lr?.categories?.performance?.score;
  if (typeof score !== 'number') throw new Error('PSI response missing performance score');
  const a = lr.audits ?? {};
  const num = (k) => a[k]?.numericValue ?? null;
  return {
    url,
    strategy,
    fetchedAt,
    score: Math.round(score * 100),
    metrics: {
      lcp: num('largest-contentful-paint'),
      cls: num('cumulative-layout-shift'),
      tbt: num('total-blocking-time'),
      fcp: num('first-contentful-paint'),
      si: num('speed-index')
    },
    lighthouseVersion: lr.lighthouseVersion ?? null
  };
}
