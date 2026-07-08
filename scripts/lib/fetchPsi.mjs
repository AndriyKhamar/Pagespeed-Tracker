import { buildPsiUrl, parsePsi } from './psi.mjs';

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchPsiRun(url, strategy, { fetchedAt, fetchFn = fetch, sleepFn = realSleep, retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchFn(buildPsiUrl(url, strategy));
      if (!res.ok) throw new Error(`PSI HTTP ${res.status}: ${await res.text()}`);
      const json = await res.json();
      return parsePsi(json, { url, strategy, fetchedAt });
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleepFn(2 ** attempt * 1000);
    }
  }
  throw lastErr;
}
