# PageSpeed Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zero-cost hourly PageSpeed Insights monitoring — GitHub Actions collects PSI results into repo JSON, an Angular dashboard on GitHub Pages charts the history.

**Architecture:** Node ESM scripts (built-ins only) fetch PSI for each configured URL × {mobile,desktop}, write raw run JSON + an aggregated summary under `docs/data/`, prune to a 2-month window, and commit to `main`. GitHub Pages serves `main` `/docs`; the Angular bundle in `/docs` fetches `./data/**` at runtime, so hourly data commits never trigger a rebuild.

**Tech Stack:** Node 20+ (runner + local; system v22 is fine — this is Angular 18, NOT the Angular 7 project, so no nvm switch), Angular 18 standalone, Chart.js 4, GitHub Actions, GitHub Pages.

## Global Constraints

- Public repository — no credentials or sensitive data in commits or workflow logs. Secrets only via `${{ secrets.* }}`, never `echo`'d.
- No paid services: Actions (compute+cron), repo JSON (storage), Pages (hosting) only.
- PSI unauthenticated (no API key). Handle rate limits with retry/backoff; on failure skip — never write fabricated data.
- Performance score stored and displayed as 0–100 = `Math.round(psiScore * 100)`. `lcp/tbt/fcp/si` in ms; `cls` unitless.
- Timestamps in filenames use `-` not `:` (e.g. `2026-07-06T14-00-00Z.json`).
- Retention: keep current + previous month only (UTC).
- Node scripts: ESM (`.mjs`), zero runtime deps, tests via built-in `node:test`.
- Config thresholds: mobile 50, desktop 66.
- Initial monitored URL: `https://xq-booking-uat.newshore.es/`.
- Alerting: build `shouldAlert` logic + state file only; do NOT wire email/Slack sending.

---

### Task 1: Repo scaffold & config

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `config/urls.json`
- Create: `docs/data/.gitkeep`

**Interfaces:**
- Produces: npm scripts `test`, `collect`, `validate`; config schema `{ urls: [{url}], thresholds: {mobile,desktop} }`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "pagespeed-tracker",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "node --test",
    "collect": "node scripts/collect.mjs",
    "validate": "node scripts/validate-config.mjs"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.env
*.log
dashboard/.angular/
dashboard/node_modules/
```

- [ ] **Step 3: Create `.nvmrc`**

```
20
```

- [ ] **Step 4: Create `config/urls.json`**

```json
{
  "urls": [
    { "url": "https://xq-booking-uat.newshore.es/" }
  ],
  "thresholds": { "mobile": 50, "desktop": 66 }
}
```

- [ ] **Step 5: Create `docs/data/.gitkeep`** (empty file, keeps the data dir in git)

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore .nvmrc config/urls.json docs/data/.gitkeep
git commit -m "chore: scaffold repo, config, npm scripts"
```

---

### Task 2: `lib/slug.mjs` — URL → filesystem slug

**Files:**
- Create: `scripts/lib/slug.mjs`
- Test: `scripts/lib/slug.test.mjs`

**Interfaces:**
- Produces: `slugify(url: string): string` — deterministic, lowercase, `[a-z0-9]`→`-`, trims leading/trailing `-`.

- [ ] **Step 1: Write the failing test** — `scripts/lib/slug.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from './slug.mjs';

test('slugify strips protocol and punctuation', () => {
  assert.equal(slugify('https://xq-booking-uat.newshore.es/'), 'xq-booking-uat-newshore-es');
});

test('slugify is deterministic and collapses repeats', () => {
  assert.equal(slugify('https://a.com//path?x=1'), 'a-com-path-x-1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/slug.test.mjs`
Expected: FAIL — `Cannot find module './slug.mjs'`

- [ ] **Step 3: Write minimal implementation** — `scripts/lib/slug.mjs`

```js
export function slugify(url) {
  return url
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/slug.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/slug.mjs scripts/lib/slug.test.mjs
git commit -m "feat: add slugify util"
```

---

### Task 3: `lib/time.mjs` — filename timestamp & month window

**Files:**
- Create: `scripts/lib/time.mjs`
- Test: `scripts/lib/time.test.mjs`

**Interfaces:**
- Produces:
  - `fileStamp(date: Date): string` → `YYYY-MM-DDTHH-mm-ssZ` (UTC, filename-safe).
  - `isoStamp(date: Date): string` → `YYYY-MM-DDTHH:mm:ssZ` (UTC, for JSON `fetchedAt`/`t`).
  - `windowStart(now: Date): Date` → first day of previous month, 00:00:00 UTC.

- [ ] **Step 1: Write the failing test** — `scripts/lib/time.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileStamp, isoStamp, windowStart } from './time.mjs';

const d = new Date('2026-07-06T14:00:00Z');

test('fileStamp is filename-safe UTC', () => {
  assert.equal(fileStamp(d), '2026-07-06T14-00-00Z');
});

test('isoStamp is second-precision UTC', () => {
  assert.equal(isoStamp(d), '2026-07-06T14:00:00Z');
});

test('windowStart is first day of previous month UTC', () => {
  assert.equal(windowStart(d).toISOString(), '2026-06-01T00:00:00.000Z');
});

test('windowStart wraps year in January', () => {
  assert.equal(windowStart(new Date('2026-01-15T00:00:00Z')).toISOString(), '2025-12-01T00:00:00.000Z');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/time.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation** — `scripts/lib/time.mjs`

```js
export function isoStamp(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function fileStamp(date) {
  return isoStamp(date).replace(/:/g, '-');
}

export function windowStart(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/time.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/time.mjs scripts/lib/time.test.mjs
git commit -m "feat: add time/window utils"
```

---

### Task 4: `lib/psi.mjs` — build request URL & parse response

**Files:**
- Create: `scripts/lib/psi.mjs`
- Test: `scripts/lib/psi.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildPsiUrl(url: string, strategy: 'mobile'|'desktop'): string`.
  - `parsePsi(json: object, {url, strategy, fetchedAt}): RunResult` where
    `RunResult = { url, strategy, fetchedAt, score:0-100, metrics:{lcp,cls,tbt,fcp,si}, lighthouseVersion }`.
    Throws `Error` if `categories.performance.score` is missing (caller treats as failure).

- [ ] **Step 1: Write the failing test** — `scripts/lib/psi.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPsiUrl, parsePsi } from './psi.mjs';

test('buildPsiUrl encodes url, sets strategy + category, no key', () => {
  const u = buildPsiUrl('https://a.com/', 'mobile');
  assert.match(u, /runPagespeed\?/);
  assert.match(u, /url=https%3A%2F%2Fa\.com%2F/);
  assert.match(u, /strategy=mobile/);
  assert.match(u, /category=performance/);
  assert.doesNotMatch(u, /key=/);
});

const sample = {
  lighthouseResult: {
    lighthouseVersion: '11.0.0',
    categories: { performance: { score: 0.47 } },
    audits: {
      'largest-contentful-paint': { numericValue: 4200 },
      'cumulative-layout-shift': { numericValue: 0.12 },
      'total-blocking-time': { numericValue: 890 },
      'first-contentful-paint': { numericValue: 2100 },
      'speed-index': { numericValue: 5300 }
    }
  }
};

test('parsePsi normalizes score to 0-100 and extracts metrics', () => {
  const r = parsePsi(sample, { url: 'https://a.com/', strategy: 'mobile', fetchedAt: '2026-07-06T14:00:00Z' });
  assert.equal(r.score, 47);
  assert.deepEqual(r.metrics, { lcp: 4200, cls: 0.12, tbt: 890, fcp: 2100, si: 5300 });
  assert.equal(r.lighthouseVersion, '11.0.0');
  assert.equal(r.strategy, 'mobile');
});

test('parsePsi throws on missing score', () => {
  assert.throws(() => parsePsi({ lighthouseResult: { categories: {} } }, { url: 'x', strategy: 'mobile', fetchedAt: 't' }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/psi.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation** — `scripts/lib/psi.mjs`

```js
const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export function buildPsiUrl(url, strategy) {
  const p = new URLSearchParams({ url, strategy, category: 'performance' });
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/psi.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/psi.mjs scripts/lib/psi.test.mjs
git commit -m "feat: add PSI url builder and parser"
```

---

### Task 5: `lib/fetchPsi.mjs` — fetch with retry/backoff

**Files:**
- Create: `scripts/lib/fetchPsi.mjs`
- Test: `scripts/lib/fetchPsi.test.mjs`

**Interfaces:**
- Consumes: `buildPsiUrl`, `parsePsi` from `./psi.mjs`.
- Produces: `fetchPsiRun(url, strategy, { fetchedAt, fetchFn, sleepFn, retries=3 }): Promise<RunResult>`.
  Retries on thrown error or non-ok response; backoff via injected `sleepFn(ms)` (default no-op sleep is real). Throws after final failure.

- [ ] **Step 1: Write the failing test** — `scripts/lib/fetchPsi.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPsiRun } from './fetchPsi.mjs';

const ok = {
  ok: true,
  json: async () => ({
    lighthouseResult: {
      lighthouseVersion: '11.0.0',
      categories: { performance: { score: 0.9 } },
      audits: {}
    }
  })
};

test('returns parsed run on first success', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return ok; };
  const r = await fetchPsiRun('https://a.com/', 'desktop', { fetchedAt: 't', fetchFn, sleepFn: async () => {} });
  assert.equal(calls, 1);
  assert.equal(r.score, 90);
});

test('retries then succeeds', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; if (calls < 3) throw new Error('429'); return ok; };
  const r = await fetchPsiRun('https://a.com/', 'mobile', { fetchedAt: 't', fetchFn, sleepFn: async () => {}, retries: 3 });
  assert.equal(calls, 3);
  assert.equal(r.score, 90);
});

test('throws after exhausting retries', async () => {
  const fetchFn = async () => { throw new Error('down'); };
  await assert.rejects(fetchPsiRun('https://a.com/', 'mobile', { fetchedAt: 't', fetchFn, sleepFn: async () => {}, retries: 2 }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/fetchPsi.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation** — `scripts/lib/fetchPsi.mjs`

```js
import { buildPsiUrl, parsePsi } from './psi.mjs';

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchPsiRun(url, strategy, { fetchedAt, fetchFn = fetch, sleepFn = realSleep, retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchFn(buildPsiUrl(url, strategy));
      if (!res.ok) throw new Error(`PSI HTTP ${res.status}`);
      const json = await res.json();
      return parsePsi(json, { url, strategy, fetchedAt });
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleepFn(2 ** attempt * 1000);
    }
  }
  throw lastErr;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/fetchPsi.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/fetchPsi.mjs scripts/lib/fetchPsi.test.mjs
git commit -m "feat: add PSI fetch with retry/backoff"
```

---

### Task 6: `lib/summary.mjs` — append point & prune to window

**Files:**
- Create: `scripts/lib/summary.mjs`
- Test: `scripts/lib/summary.test.mjs`

**Interfaces:**
- Consumes: `RunResult` shape from Task 4.
- Produces:
  - `emptySummary(url, slug, thresholds): SummaryFile` where `SummaryFile = { url, slug, updatedAt, series:{mobile:[],desktop:[]}, thresholds }` and a point is `{ t, score, lcp, cls, tbt }`.
  - `appendPoint(summary, run): SummaryFile` — pushes `{t:run.fetchedAt, score, lcp, cls, tbt}` to `series[run.strategy]`, sets `updatedAt`.
  - `pruneSummary(summary, startDate): SummaryFile` — drops points with `new Date(t) < startDate` from both series.

- [ ] **Step 1: Write the failing test** — `scripts/lib/summary.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySummary, appendPoint, pruneSummary } from './summary.mjs';

const run = {
  url: 'https://a.com/', strategy: 'mobile', fetchedAt: '2026-07-06T14:00:00Z',
  score: 47, metrics: { lcp: 4200, cls: 0.12, tbt: 890, fcp: 2100, si: 5300 }
};

test('emptySummary shape', () => {
  const s = emptySummary('https://a.com/', 'a-com', { mobile: 50, desktop: 66 });
  assert.deepEqual(s.series, { mobile: [], desktop: [] });
  assert.equal(s.thresholds.desktop, 66);
});

test('appendPoint adds compact point to correct strategy', () => {
  const s = appendPoint(emptySummary('https://a.com/', 'a-com', { mobile: 50, desktop: 66 }), run);
  assert.equal(s.series.mobile.length, 1);
  assert.deepEqual(s.series.mobile[0], { t: '2026-07-06T14:00:00Z', score: 47, lcp: 4200, cls: 0.12, tbt: 890 });
  assert.equal(s.updatedAt, '2026-07-06T14:00:00Z');
});

test('pruneSummary drops points before window start', () => {
  let s = emptySummary('https://a.com/', 'a-com', { mobile: 50, desktop: 66 });
  s = appendPoint(s, { ...run, fetchedAt: '2026-05-01T00:00:00Z' });
  s = appendPoint(s, { ...run, fetchedAt: '2026-07-06T14:00:00Z' });
  s = pruneSummary(s, new Date('2026-06-01T00:00:00Z'));
  assert.equal(s.series.mobile.length, 1);
  assert.equal(s.series.mobile[0].t, '2026-07-06T14:00:00Z');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/summary.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation** — `scripts/lib/summary.mjs`

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/summary.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/summary.mjs scripts/lib/summary.test.mjs
git commit -m "feat: add summary append/prune"
```

---

### Task 7: `lib/alert.mjs` — threshold decision (send deferred)

**Files:**
- Create: `scripts/lib/alert.mjs`
- Test: `scripts/lib/alert.test.mjs`

**Interfaces:**
- Produces: `shouldAlert({ score, threshold, lastDate, today }): boolean` — true only when `score < threshold` AND `lastDate !== today`. `today`/`lastDate` are `YYYY-MM-DD` UTC strings; `lastDate` may be `null`.

- [ ] **Step 1: Write the failing test** — `scripts/lib/alert.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAlert } from './alert.mjs';

test('alerts when under and not yet alerted today', () => {
  assert.equal(shouldAlert({ score: 40, threshold: 50, lastDate: null, today: '2026-07-06' }), true);
});
test('no alert when at/above threshold', () => {
  assert.equal(shouldAlert({ score: 50, threshold: 50, lastDate: null, today: '2026-07-06' }), false);
});
test('no second alert same day', () => {
  assert.equal(shouldAlert({ score: 40, threshold: 50, lastDate: '2026-07-06', today: '2026-07-06' }), false);
});
test('alerts again on a new day', () => {
  assert.equal(shouldAlert({ score: 40, threshold: 50, lastDate: '2026-07-05', today: '2026-07-06' }), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/alert.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation** — `scripts/lib/alert.mjs`

```js
export function shouldAlert({ score, threshold, lastDate, today }) {
  return score < threshold && lastDate !== today;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/alert.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/alert.mjs scripts/lib/alert.test.mjs
git commit -m "feat: add shouldAlert decision (send deferred)"
```

---

### Task 8: `scripts/validate-config.mjs` — config linter

**Files:**
- Create: `scripts/lib/validateConfig.mjs`
- Create: `scripts/validate-config.mjs`
- Test: `scripts/lib/validateConfig.test.mjs`

**Interfaces:**
- Produces: `validateConfig(cfg): string[]` — array of error messages (empty = valid). CLI wrapper reads `config/urls.json`, prints errors, exits 1 if any.

- [ ] **Step 1: Write the failing test** — `scripts/lib/validateConfig.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from './validateConfig.mjs';

test('valid config yields no errors', () => {
  const errs = validateConfig({ urls: [{ url: 'https://a.com/' }], thresholds: { mobile: 50, desktop: 66 } });
  assert.deepEqual(errs, []);
});
test('flags empty urls and bad url and missing thresholds', () => {
  const errs = validateConfig({ urls: [{ url: 'not-a-url' }], thresholds: { mobile: 50 } });
  assert.ok(errs.some((e) => /url/i.test(e)));
  assert.ok(errs.some((e) => /desktop/i.test(e)));
});
test('flags missing urls array', () => {
  const errs = validateConfig({ thresholds: { mobile: 50, desktop: 66 } });
  assert.ok(errs.length >= 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/validateConfig.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation** — `scripts/lib/validateConfig.mjs`

```js
export function validateConfig(cfg) {
  const errs = [];
  if (!cfg || !Array.isArray(cfg.urls) || cfg.urls.length === 0) {
    errs.push('config.urls must be a non-empty array');
  } else {
    for (const [i, entry] of cfg.urls.entries()) {
      try { new URL(entry.url); } catch { errs.push(`urls[${i}].url is not a valid URL: ${entry?.url}`); }
    }
  }
  for (const k of ['mobile', 'desktop']) {
    if (typeof cfg?.thresholds?.[k] !== 'number') errs.push(`thresholds.${k} must be a number`);
  }
  return errs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/validateConfig.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the CLI wrapper** — `scripts/validate-config.mjs`

```js
import { readFile } from 'node:fs/promises';
import { validateConfig } from './lib/validateConfig.mjs';

const cfg = JSON.parse(await readFile(new URL('../config/urls.json', import.meta.url), 'utf8'));
const errs = validateConfig(cfg);
if (errs.length) {
  console.error('Invalid config/urls.json:');
  for (const e of errs) console.error(' -', e);
  process.exit(1);
}
console.log('config/urls.json OK');
```

- [ ] **Step 6: Run the CLI to verify it passes on real config**

Run: `node scripts/validate-config.mjs`
Expected: prints `config/urls.json OK`, exit 0

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/validateConfig.mjs scripts/lib/validateConfig.test.mjs scripts/validate-config.mjs
git commit -m "feat: add config validation + CLI"
```

---

### Task 9: `scripts/collect.mjs` — orchestrator + prune of raw run files

**Files:**
- Create: `scripts/lib/prune.mjs`
- Create: `scripts/collect.mjs`
- Test: `scripts/lib/prune.test.mjs`

**Interfaces:**
- Consumes: `slugify`, `fileStamp`, `isoStamp`, `windowStart`, `fetchPsiRun`, `emptySummary`, `appendPoint`, `pruneSummary`, `validateConfig`.
- Produces:
  - `pruneRunFiles(files: string[], startDate: Date): string[]` — returns filenames (basename `YYYY-MM-DDTHH-mm-ssZ.json`) whose parsed date `< startDate` (the ones to delete).
  - `collect.mjs`: reads config, loops URL×strategy, writes runs, updates summaries, prunes runs+summary, writes `docs/data/index.json`. No commit here (workflow commits). PSI failure per url+strategy → `console.warn`, continue.

- [ ] **Step 1: Write the failing test** — `scripts/lib/prune.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { pruneRunFiles } from './prune.mjs';

test('pruneRunFiles returns only files before window start', () => {
  const files = ['2026-05-01T00-00-00Z.json', '2026-06-15T10-00-00Z.json', '2026-07-06T14-00-00Z.json'];
  const del = pruneRunFiles(files, new Date('2026-06-01T00:00:00Z'));
  assert.deepEqual(del, ['2026-05-01T00-00-00Z.json']);
});

test('ignores non-timestamp files', () => {
  assert.deepEqual(pruneRunFiles(['.gitkeep', 'x.json'], new Date('2026-06-01T00:00:00Z')), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/prune.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation** — `scripts/lib/prune.mjs`

```js
// filename form: 2026-07-06T14-00-00Z.json  ->  ISO 2026-07-06T14:00:00Z
export function fileNameToDate(name) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.json$/);
  if (!m) return null;
  return new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
}

export function pruneRunFiles(files, startDate) {
  return files.filter((f) => {
    const d = fileNameToDate(f);
    return d && d < startDate;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/prune.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the orchestrator** — `scripts/collect.mjs`

```js
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { slugify } from './lib/slug.mjs';
import { fileStamp, isoStamp, windowStart } from './lib/time.mjs';
import { fetchPsiRun } from './lib/fetchPsi.mjs';
import { emptySummary, appendPoint, pruneSummary } from './lib/summary.mjs';
import { pruneRunFiles } from './lib/prune.mjs';
import { validateConfig } from './lib/validateConfig.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'docs', 'data');
const STRATEGIES = ['mobile', 'desktop'];

async function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  const cfg = await readJson(join(root, 'config', 'urls.json'));
  const errs = validateConfig(cfg);
  if (errs.length) { console.error('Invalid config:', errs); process.exit(1); }

  const now = new Date();
  const fetchedAt = isoStamp(now);
  const start = windowStart(now);
  const slugs = [];

  for (const { url } of cfg.urls) {
    const slug = slugify(url);
    slugs.push(slug);
    const summaryPath = join(dataDir, 'summary', `${slug}.json`);
    const summary = await readJson(summaryPath, emptySummary(url, slug, cfg.thresholds));
    summary.thresholds = cfg.thresholds;

    for (const strategy of STRATEGIES) {
      try {
        const run = await fetchPsiRun(url, strategy, { fetchedAt });
        const runDir = join(dataDir, 'runs', slug, strategy);
        await mkdir(runDir, { recursive: true });
        await writeFile(join(runDir, `${fileStamp(now)}.json`), JSON.stringify(run, null, 2));
        appendPoint(summary, run);
        // prune old raw run files
        const files = await readdir(runDir);
        for (const f of pruneRunFiles(files, start)) await rm(join(runDir, f));
        console.log(`OK ${slug} ${strategy} score=${run.score}`);
      } catch (err) {
        console.warn(`SKIP ${slug} ${strategy}: ${err.message}`);
      }
    }

    pruneSummary(summary, start);
    await mkdir(dirname(summaryPath), { recursive: true });
    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
  }

  await writeFile(join(dataDir, 'index.json'), JSON.stringify({ slugs, generatedAt: fetchedAt }, null, 2));
  console.log('done');
}

main();
```

- [ ] **Step 6: Smoke-test the orchestrator live** (hits real PSI once)

Run: `node scripts/collect.mjs`
Expected: prints `OK ... score=NN` lines (or `SKIP` on rate limit), then `done`. Check `docs/data/summary/xq-booking-uat-newshore-es.json` and `docs/data/index.json` exist.

- [ ] **Step 7: Commit** (include the generated data so the dashboard has something to render)

```bash
git add scripts/lib/prune.mjs scripts/lib/prune.test.mjs scripts/collect.mjs docs/data/
git commit -m "feat: add collect orchestrator + run-file prune"
```

---

### Task 10: `collect.yml` workflow — hourly cron + commit

**Files:**
- Create: `.github/workflows/collect.yml`

**Interfaces:**
- Consumes: `scripts/collect.mjs`, `config/urls.json`.
- Produces: hourly commits to `main` under `docs/data/**`.

- [ ] **Step 1: Create the workflow** — `.github/workflows/collect.yml`

```yaml
name: collect
on:
  schedule:
    - cron: '0 * * * *'   # hourly
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: collect
  cancel-in-progress: false

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Validate config
        run: node scripts/validate-config.mjs
      - name: Collect PageSpeed data
        run: node scripts/collect.mjs
      - name: Commit results
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          if [ -n "$(git status --porcelain docs/data)" ]; then
            git add docs/data
            git commit -m "data: pagespeed run $(date -u +%Y-%m-%dT%H:%MZ)"
            git pull --rebase --autostash origin main
            git push
          else
            echo "No changes"
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/collect.yml
git commit -m "ci: add hourly collect workflow"
```

- [ ] **Step 3: Manual verification** (after push + Pages/Actions enabled — see Task 17)

Run in GitHub UI: Actions → collect → "Run workflow".
Expected: green run, a new `data:` commit on `main`.

---

### Task 11: `test.yml` workflow — CI for node scripts

**Files:**
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: Create the workflow** — `.github/workflows/test.yml`

```yaml
name: test
on:
  push:
  pull_request:

jobs:
  node-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node --test
```

- [ ] **Step 2: Run tests locally to confirm green before committing**

Run: `node --test`
Expected: all suites PASS

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: run node --test on push/PR"
```

---

### Task 12: Angular scaffold + models + data service

**Files:**
- Create: `dashboard/` (Angular 18 project via CLI)
- Create: `dashboard/src/app/models/psi.model.ts`
- Create: `dashboard/src/app/services/data.service.ts`
- Test: `dashboard/src/app/services/data.service.spec.ts`

**Interfaces:**
- Produces:
  - Interfaces `SeriesPoint {t:string; score:number; lcp:number; cls:number; tbt:number}`, `SummaryFile {url; slug; updatedAt; series:{mobile:SeriesPoint[]; desktop:SeriesPoint[]}; thresholds:{mobile:number; desktop:number}}`, `IndexFile {slugs:string[]; generatedAt:string}`.
  - `DataService.getIndex(): Observable<IndexFile>`, `DataService.getSummary(slug:string): Observable<SummaryFile>` — both GET `./data/...` relative to `base-href`.

- [ ] **Step 1: Scaffold the Angular app** (run from repo root)

Run:
```bash
npx -y @angular/cli@18 new dashboard --routing --style=scss --skip-git --defaults
```
Expected: `dashboard/` created. (Uses system Node 22 — fine for Angular 18.)

- [ ] **Step 2: Set Pages base-href + docs output** — edit `dashboard/angular.json`

Under `projects.dashboard.architect.build.options`, set `"outputPath": "../docs"` and `"baseHref": "/Pagespeed-Tracker/"`. (Angular 18 outputs to `outputPath/browser`; Task 17 handles the `browser` subfolder.)

- [ ] **Step 3: Write the models** — `dashboard/src/app/models/psi.model.ts`

```ts
export interface SeriesPoint { t: string; score: number; lcp: number; cls: number; tbt: number; }
export interface Thresholds { mobile: number; desktop: number; }
export interface SummaryFile {
  url: string; slug: string; updatedAt: string | null;
  series: { mobile: SeriesPoint[]; desktop: SeriesPoint[] };
  thresholds: Thresholds;
}
export interface IndexFile { slugs: string[]; generatedAt: string; }
```

- [ ] **Step 4: Write the failing service spec** — `dashboard/src/app/services/data.service.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DataService } from './data.service';

describe('DataService', () => {
  let service: DataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DataService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DataService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('getIndex GETs ./data/index.json', () => {
    service.getIndex().subscribe();
    const req = http.expectOne('data/index.json');
    expect(req.request.method).toBe('GET');
    req.flush({ slugs: [], generatedAt: 't' });
  });

  it('getSummary GETs the slug summary', () => {
    service.getSummary('a-com').subscribe();
    http.expectOne('data/summary/a-com.json').flush({});
  });
});
```

- [ ] **Step 5: Run the spec to verify it fails**

Run: `cd dashboard && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — `DataService` has no `getIndex`/`getSummary`

- [ ] **Step 6: Write the service** — `dashboard/src/app/services/data.service.ts`

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IndexFile, SummaryFile } from '../models/psi.model';

@Injectable({ providedIn: 'root' })
export class DataService {
  private http = inject(HttpClient);
  getIndex(): Observable<IndexFile> { return this.http.get<IndexFile>('data/index.json'); }
  getSummary(slug: string): Observable<SummaryFile> { return this.http.get<SummaryFile>(`data/summary/${slug}.json`); }
}
```

- [ ] **Step 7: Provide HttpClient app-wide** — edit `dashboard/src/app/app.config.ts`, add `provideHttpClient()` to `providers` (import from `@angular/common/http`).

- [ ] **Step 8: Run the spec to verify it passes**

Run: `cd dashboard && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add dashboard/
git commit -m "feat: scaffold Angular dashboard + data service"
```

---

### Task 13: `metric-chart` component (Chart.js line)

**Files:**
- Create: `dashboard/src/app/components/metric-chart/metric-chart.component.ts`
- Test: `dashboard/src/app/components/metric-chart/metric-chart.component.spec.ts`
- Modify: `dashboard/package.json` (add `chart.js`)

**Interfaces:**
- Consumes: `SeriesPoint[]` from `psi.model`.
- Produces: standalone `MetricChartComponent` with inputs `title:string`, `metric:'score'|'lcp'|'cls'|'tbt'`, `mobile:SeriesPoint[]`, `desktop:SeriesPoint[]`. Renders a `<canvas>` with two lines (mobile/desktop) of the chosen metric over `t`.

- [ ] **Step 1: Install Chart.js**

Run: `cd dashboard && npm install chart.js@4`
Expected: `chart.js` in `dashboard/package.json` dependencies

- [ ] **Step 2: Write the failing spec** — `metric-chart.component.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { MetricChartComponent } from './metric-chart.component';

describe('MetricChartComponent', () => {
  it('creates and renders a canvas', () => {
    TestBed.configureTestingModule({ imports: [MetricChartComponent] });
    const fixture = TestBed.createComponent(MetricChartComponent);
    fixture.componentRef.setInput('title', 'Score');
    fixture.componentRef.setInput('metric', 'score');
    fixture.componentRef.setInput('mobile', [{ t: '2026-07-06T14:00:00Z', score: 47, lcp: 1, cls: 0, tbt: 1 }]);
    fixture.componentRef.setInput('desktop', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('canvas')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the spec to verify it fails**

Run: `cd dashboard && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — component does not exist

- [ ] **Step 4: Write the component** — `metric-chart.component.ts`

```ts
import { Component, ElementRef, Input, OnChanges, ViewChild, AfterViewInit } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SeriesPoint } from '../../models/psi.model';

Chart.register(...registerables);

@Component({
  selector: 'app-metric-chart',
  standalone: true,
  template: `<div style="position:relative;height:260px"><canvas #canvas></canvas></div>`
})
export class MetricChartComponent implements AfterViewInit, OnChanges {
  @Input() title = '';
  @Input() metric: 'score' | 'lcp' | 'cls' | 'tbt' = 'score';
  @Input() mobile: SeriesPoint[] = [];
  @Input() desktop: SeriesPoint[] = [];
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  ngAfterViewInit() { this.render(); }
  ngOnChanges() { if (this.canvas) this.render(); }

  private line(points: SeriesPoint[]) {
    return points.map((p) => ({ x: p.t, y: (p as any)[this.metric] as number }));
  }

  private render() {
    const cfg: ChartConfiguration = {
      type: 'line',
      data: {
        datasets: [
          { label: 'mobile', data: this.line(this.mobile) as any, borderColor: '#e8710a', tension: 0.2 },
          { label: 'desktop', data: this.line(this.desktop) as any, borderColor: '#1a73e8', tension: 0.2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: !!this.title, text: this.title } },
        scales: { x: { type: 'category' } }
      }
    };
    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, cfg);
  }
}
```

- [ ] **Step 5: Run the spec to verify it passes**

Run: `cd dashboard && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add dashboard/
git commit -m "feat: add reusable metric-chart component"
```

---

### Task 14: `url-detail` + `url-list` components and app wiring

**Files:**
- Create: `dashboard/src/app/components/url-detail/url-detail.component.ts`
- Create: `dashboard/src/app/components/url-list/url-list.component.ts`
- Modify: `dashboard/src/app/app.component.ts`
- Modify: `dashboard/src/app/app.routes.ts`
- Test: `dashboard/src/app/components/url-list/url-list.component.spec.ts`

**Interfaces:**
- Consumes: `DataService`, `SummaryFile`, `SeriesPoint`, `MetricChartComponent`.
- Produces:
  - `UrlListComponent` — loads index, lists slugs, shows a trend badge from `trendOf(points)`.
  - `UrlDetailComponent` — loads a summary, shows last-run cards (mobile/desktop) + four `MetricChartComponent`s.
  - Exposed helper `trendOf(points: SeriesPoint[]): 'up'|'down'|'flat'` (last vs previous `score`).

- [ ] **Step 1: Write the failing spec** — `url-list.component.spec.ts`

```ts
import { UrlListComponent } from './url-list.component';

describe('trendOf', () => {
  it('up when last score higher than previous', () => {
    expect(UrlListComponent.trendOf([{ t: '', score: 40, lcp: 0, cls: 0, tbt: 0 }, { t: '', score: 50, lcp: 0, cls: 0, tbt: 0 }])).toBe('up');
  });
  it('down when last lower', () => {
    expect(UrlListComponent.trendOf([{ t: '', score: 50, lcp: 0, cls: 0, tbt: 0 }, { t: '', score: 40, lcp: 0, cls: 0, tbt: 0 }])).toBe('down');
  });
  it('flat with fewer than 2 points', () => {
    expect(UrlListComponent.trendOf([])).toBe('flat');
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd dashboard && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — component does not exist

- [ ] **Step 3: Write `UrlListComponent`** — `url-list.component.ts`

```ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '../../services/data.service';
import { SeriesPoint, SummaryFile } from '../../models/psi.model';

@Component({
  selector: 'app-url-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <h1>Monitored URLs</h1>
    <ul>
      <li *ngFor="let s of summaries">
        <a [routerLink]="['/url', s.slug]">{{ s.url }}</a>
        <span> mobile {{ last(s, 'mobile')?.score ?? '—' }}/100 {{ badge(s, 'mobile') }}</span>
        <span> · desktop {{ last(s, 'desktop')?.score ?? '—' }}/100 {{ badge(s, 'desktop') }}</span>
      </li>
    </ul>
    <p *ngIf="summaries.length === 0">No data yet.</p>
  `
})
export class UrlListComponent implements OnInit {
  private data = inject(DataService);
  summaries: SummaryFile[] = [];

  ngOnInit() {
    this.data.getIndex().subscribe((idx) => {
      for (const slug of idx.slugs) this.data.getSummary(slug).subscribe((s) => this.summaries.push(s));
    });
  }
  last(s: SummaryFile, strat: 'mobile' | 'desktop') { const a = s.series[strat]; return a[a.length - 1]; }
  badge(s: SummaryFile, strat: 'mobile' | 'desktop') {
    return { up: '▲', down: '▼', flat: '—' }[UrlListComponent.trendOf(s.series[strat])];
  }
  static trendOf(points: SeriesPoint[]): 'up' | 'down' | 'flat' {
    if (points.length < 2) return 'flat';
    const d = points[points.length - 1].score - points[points.length - 2].score;
    return d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
  }
}
```

- [ ] **Step 4: Write `UrlDetailComponent`** — `url-detail.component.ts`

```ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../../services/data.service';
import { SummaryFile } from '../../models/psi.model';
import { MetricChartComponent } from '../metric-chart/metric-chart.component';

@Component({
  selector: 'app-url-detail',
  standalone: true,
  imports: [CommonModule, MetricChartComponent],
  template: `
    <a href="#" (click)="$event.preventDefault(); back()">← back</a>
    <ng-container *ngIf="summary as s">
      <h1>{{ s.url }}</h1>
      <p>Updated {{ s.updatedAt || '—' }}</p>
      <app-metric-chart title="Performance score (/100)" metric="score" [mobile]="s.series.mobile" [desktop]="s.series.desktop"></app-metric-chart>
      <app-metric-chart title="LCP (ms)" metric="lcp" [mobile]="s.series.mobile" [desktop]="s.series.desktop"></app-metric-chart>
      <app-metric-chart title="CLS" metric="cls" [mobile]="s.series.mobile" [desktop]="s.series.desktop"></app-metric-chart>
      <app-metric-chart title="TBT (ms)" metric="tbt" [mobile]="s.series.mobile" [desktop]="s.series.desktop"></app-metric-chart>
    </ng-container>
  `
})
export class UrlDetailComponent implements OnInit {
  private data = inject(DataService);
  private route = inject(ActivatedRoute);
  summary?: SummaryFile;
  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.data.getSummary(slug).subscribe((s) => (this.summary = s));
  }
  back() { history.back(); }
}
```

- [ ] **Step 5: Wire routes** — replace `dashboard/src/app/app.routes.ts`

```ts
import { Routes } from '@angular/router';
import { UrlListComponent } from './components/url-list/url-list.component';
import { UrlDetailComponent } from './components/url-detail/url-detail.component';

export const routes: Routes = [
  { path: '', component: UrlListComponent },
  { path: 'url/:slug', component: UrlDetailComponent },
  { path: '**', redirectTo: '' }
];
```

- [ ] **Step 6: Reduce app.component to a router outlet** — replace `dashboard/src/app/app.component.ts`

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<main style="max-width:900px;margin:2rem auto;font-family:system-ui"><router-outlet></router-outlet></main>`
})
export class AppComponent {}
```

- [ ] **Step 7: Run specs to verify pass**

Run: `cd dashboard && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: PASS (all specs)

- [ ] **Step 8: Commit**

```bash
git add dashboard/
git commit -m "feat: add url-list, url-detail, routing"
```

---

### Task 15: `build-dashboard.yml` — build Angular into docs/ on dashboard changes

**Files:**
- Create: `.github/workflows/build-dashboard.yml`
- Create: `docs/.nojekyll`

**Interfaces:**
- Consumes: `dashboard/` source.
- Produces: built bundle committed to `docs/` on `main`.

Note: Angular 18 builds to `outputPath/browser`. Since `outputPath=../docs`, output lands in `docs/browser/`. We move its contents up into `docs/` so Pages serves `index.html` at the root alongside `docs/data/`.

- [ ] **Step 1: Create `docs/.nojekyll`** (empty file — stops GitHub Pages Jekyll from ignoring files, and lets Angular assets serve as-is)

- [ ] **Step 2: Create the workflow** — `.github/workflows/build-dashboard.yml`

```yaml
name: build-dashboard
on:
  push:
    branches: [main]
    paths: ['dashboard/**', '.github/workflows/build-dashboard.yml']
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: collect          # share group with collect.yml to avoid push races
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Build Angular
        working-directory: dashboard
        run: |
          npm ci
          npx ng build --configuration production
      - name: Flatten browser/ into docs root
        run: |
          # Angular outputs to docs/browser; move to docs root, keep docs/data + .nojekyll
          rsync -a --remove-source-files docs/browser/ docs/
          rm -rf docs/browser
          touch docs/.nojekyll
      - name: Commit built bundle
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          if [ -n "$(git status --porcelain docs)" ]; then
            git add docs
            git commit -m "build: dashboard bundle"
            git pull --rebase --autostash origin main
            git push
          else
            echo "No changes"
          fi
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-dashboard.yml docs/.nojekyll
git commit -m "ci: build dashboard into docs on change"
```

---

### Task 16: README — setup & usage docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# PageSpeed Tracker

Zero-cost web performance monitoring. GitHub Actions runs PageSpeed Insights
(mobile + desktop) hourly, stores results as JSON in `docs/data/`, and an Angular
dashboard on GitHub Pages charts the history.

## How it works

- `.github/workflows/collect.yml` (hourly cron) runs `scripts/collect.mjs`:
  fetches PSI per URL × strategy, writes raw runs + an aggregated summary under
  `docs/data/`, prunes to the current + previous month, commits to `main`.
- GitHub Pages serves `main` `/docs`. The Angular bundle fetches `./data/**` at
  runtime — hourly data commits do not rebuild the app.
- `.github/workflows/build-dashboard.yml` rebuilds the bundle into `docs/` only
  when `dashboard/**` changes.

## Setup

1. **Enable GitHub Pages:** repo Settings → Pages → Source = "Deploy from a
   branch", Branch = `main`, folder = `/docs`.
2. **Enable Actions:** first run `collect` manually (Actions → collect → Run
   workflow) to populate `docs/data/`.
3. **Build the dashboard:** push any `dashboard/**` change, or run
   `build-dashboard` manually, to publish the bundle.
4. Visit `https://<user>.github.io/Pagespeed-Tracker/`.

## Configure monitored URLs

Edit `config/urls.json`:

```json
{
  "urls": [{ "url": "https://example.com/" }],
  "thresholds": { "mobile": 50, "desktop": 66 }
}
```

Validate: `node scripts/validate-config.mjs`.

## Local development

- Node 20+. Run script tests: `node --test`.
- Run a collection locally: `node scripts/collect.mjs`.
- Dashboard: `cd dashboard && npx ng serve` (data loads from `docs/data/` — run a
  collection first or copy sample data into `dashboard/public/data`).

## Alerting (not yet wired)

`scripts/lib/alert.mjs` decides when a score is below threshold (one alert per
URL+strategy per UTC day) and `docs/data/alert-state.json` tracks it. Sending
(Gmail SMTP / Slack webhook) is intentionally not connected. When enabling, add
`SMTP_PASSWORD` / `SLACK_WEBHOOK` as repo secrets — never commit them.

## Retention

Only the current and previous calendar month of data is kept; older raw runs and
summary points are pruned automatically each run.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: setup and usage"
```

---

### Task 17: End-to-end verification & enablement (manual, GitHub UI)

**Files:** none (operational).

- [ ] **Step 1: Push everything**

```bash
git push origin main
```

- [ ] **Step 2: Enable Pages** — Settings → Pages → Deploy from branch → `main` `/docs`.

- [ ] **Step 3: Seed data** — Actions → `collect` → Run workflow. Confirm a `data:` commit appears and `docs/data/index.json` + `docs/data/summary/*.json` are populated.

- [ ] **Step 4: Publish dashboard** — Actions → `build-dashboard` → Run workflow. Confirm `docs/index.html` exists on `main`.

- [ ] **Step 5: Verify the site** — open `https://<user>.github.io/Pagespeed-Tracker/`. Expected: URL list renders with a trend badge; clicking the URL shows four charts with at least one data point.

- [ ] **Step 6: Verify the schedule** — confirm the `collect` workflow is listed under Actions with the hourly schedule enabled (GitHub disables cron on inactive repos after 60 days; a manual run re-arms it).

---

## Self-Review

**Spec coverage:**
- Zero-cost architecture → Actions + repo JSON + Pages, no secrets now (Tasks 10,11,15,17). ✓
- Config file of URLs + frequency → `config/urls.json`, hourly cron (Tasks 1,10). ✓
- Workflow reads config, calls PSI, saves runs, updates summary, prunes → Tasks 8,9,10. ✓
- Alerts below threshold, one/day, deferred send → `shouldAlert` + state design (Task 7), documented deferral (Task 16). ✓
- Dashboard: list URLs, historical charts (score/LCP/CLS/TBT), last run, trend, load JSON from Pages → Tasks 12,13,14. ✓
- TS interfaces for PSI responses → `psi.model.ts` (Task 12) + `parsePsi` (Task 4). ✓
- Angular service loading JSON from Pages → `DataService` (Task 12). ✓
- Chart components → `MetricChartComponent` (Task 13). ✓
- JSON schema for runs → run + summary + index schemas (spec + Tasks 4,6,9). ✓
- Alerting logic (Slack + email) → decision logic built, sending deferred by user (Task 7,16). ✓
- Docs → README (Task 16). ✓
- Config validator → Task 8. ✓
- Score 0–100 display → normalize in `parsePsi`, `/100` in UI (Tasks 4,14). ✓
- Retention current+previous month → `windowStart` + prune (Tasks 3,6,9). ✓
- Public-repo safety → no secrets committed; least-privilege perms (Tasks 10,15,16). ✓
- Push-race fix → shared `concurrency` group + `git pull --rebase` (Tasks 10,15). ✓

**Placeholder scan:** no TBD/TODO; every code step has full code. ✓

**Type consistency:** `RunResult` (Task 4) → consumed by `appendPoint` (Task 6) and `collect.mjs` (Task 9); `SeriesPoint`/`SummaryFile`/`IndexFile` (Task 12) match summary/index JSON written by `summary.mjs`/`collect.mjs` (Tasks 6,9); `trendOf` name consistent (Task 14); `getIndex`/`getSummary` consistent (Tasks 12,14). ✓
