# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the PageSpeed dashboard (home page + URL detail page + charts) into a professional-looking UI with clear score hierarchy, threshold context, and plain-English metric explanations, and extend data collection to capture FCP + Speed Index alongside the existing metrics.

**Architecture:** No new dependencies. Everything stays within the existing 3-component Angular 18 standalone app (`url-list`, `url-detail`, `metric-chart`) plus one new pure-function helper file (`shared/status-style.ts`) and a small backend fix (`scripts/lib/summary.mjs`) to stop dropping FCP/SI before they're written to disk. Visual design (colors, layout, copy) was approved via the brainstorming visual companion; see `docs/superpowers/specs/2026-07-08-dashboard-redesign-design.md`.

**Tech Stack:** Angular 18 (standalone components), Chart.js 4, Jasmine/Karma for dashboard specs, Node's built-in `node:test` for `scripts/lib/*`.

## Global Constraints

- Page background: `#e8ebf3`. Card background: `#fff`, border `#e2e5ea` or `#d7dbe4`, shadow `0 2px 8px rgba(30,40,80,.06)` (or `0 4px 14px rgba(30,40,80,.12)` for the home pill).
- Pass color `#2f9e44` / pass tint bg `#e6f6ea`. Fail color `#e03131` / fail tint bg `#fdecec`. No "above/below target" wording — color is the only signal; badge text is just `target {N}`.
- Chart line colors: mobile `#e8710a`, desktop `#1a73e8`. Accent/button/link color `#3d5afe`.
- No combined mobile+desktop average score anywhere — rejected as meaningless (different devices, different thresholds).
- No interactive chart time-range filter — descoped in favor of a static "data collected hourly" note.
- Follow existing codebase convention: inline `style="..."` in component `template` strings, no external `.html`/component-scoped `.scss` files. Global page-level concerns (body background, `.page` wrapper) go in `dashboard/src/styles.scss`.
- Dashboard specs run via `npm test -- --watch=false --browsers=ChromeHeadless` from `dashboard/`. They are **not** part of CI (`.github/workflows/test.yml` only runs `node --test`), but must still pass locally.
- Backend/script tests run via `npm test` (= `node --test`) from repo root.

---

### Task 1: Backend — capture FCP + Speed Index in stored data points

`scripts/lib/psi.mjs` already computes `fcp` and `si` in `parsePsi()`'s returned `metrics`, but `scripts/lib/summary.mjs`'s `appendPoint()` drops them before writing to disk. Fix that, and thread an optional `label` through `emptySummary()`/`collect.mjs` for the new config field used later in this plan.

**Files:**
- Modify: `scripts/lib/summary.mjs`
- Modify: `scripts/lib/summary.test.mjs`
- Modify: `scripts/collect.mjs`
- Modify: `config/urls.json`

**Interfaces:**
- Produces: `emptySummary(url, slug, thresholds, label = null)` → `{ url, slug, label, updatedAt: null, series: { mobile: [], desktop: [] }, thresholds }`
- Produces: `appendPoint(summary, run)` now pushes `{ t, score, fcp, lcp, tbt, cls, si }` per point (was missing `fcp`/`si`).

- [ ] **Step 1: Write the failing test**

Edit `scripts/lib/summary.test.mjs` — replace its contents with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySummary, appendPoint, pruneSummary } from './summary.mjs';

const run = {
  url: 'https://a.com/', strategy: 'mobile', fetchedAt: '2026-07-06T14:00:00Z',
  score: 47, metrics: { lcp: 4200, cls: 0.12, tbt: 890, fcp: 2100, si: 5300 }
};

test('emptySummary shape defaults label to null', () => {
  const s = emptySummary('https://a.com/', 'a-com', { mobile: 50, desktop: 66 });
  assert.deepEqual(s.series, { mobile: [], desktop: [] });
  assert.equal(s.thresholds.desktop, 66);
  assert.equal(s.label, null);
});

test('emptySummary accepts a label', () => {
  const s = emptySummary('https://a.com/', 'a-com', { mobile: 50, desktop: 66 }, 'UAT Environment');
  assert.equal(s.label, 'UAT Environment');
});

test('appendPoint stores all 5 metrics per point', () => {
  const s = appendPoint(emptySummary('https://a.com/', 'a-com', { mobile: 50, desktop: 66 }), run);
  assert.equal(s.series.mobile.length, 1);
  assert.deepEqual(s.series.mobile[0], {
    t: '2026-07-06T14:00:00Z', score: 47, fcp: 2100, lcp: 4200, tbt: 890, cls: 0.12, si: 5300
  });
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

Run (from repo root): `node --test scripts/lib/summary.test.mjs`
Expected: FAIL — `emptySummary(...).label` is `undefined`, not `null`; `appendPoint` output is missing `fcp`/`si`.

- [ ] **Step 3: Write minimal implementation**

Replace `scripts/lib/summary.mjs` with:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/summary.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire label through collect.mjs and config**

In `config/urls.json`, add a `label` to the existing URL entry:

```json
{
  "urls": [
    { "url": "https://xq-booking-uat.newshore.es/", "label": "UAT Environment" }
  ],
  "thresholds": { "mobile": 50, "desktop": 66 }
}
```

In `scripts/collect.mjs`, change the loop (currently destructures only `{ url }`):

```js
  for (const { url, label } of cfg.urls) {
    const slug = slugify(url);
    slugs.push(slug);
    const summaryPath = join(dataDir, 'summary', `${slug}.json`);
    const summary = await readJson(summaryPath, emptySummary(url, slug, cfg.thresholds, label ?? null));
    summary.thresholds = cfg.thresholds;
    summary.label = label ?? null;
```

(Keep the rest of the function body — the `for (const strategy of STRATEGIES)` loop and everything after — unchanged.)

- [ ] **Step 6: Run full backend test suite**

Run: `node --test`
Expected: PASS, no regressions in `psi.test.mjs`, `fetchPsi.test.mjs`, `validateConfig.test.mjs`, etc.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/summary.mjs scripts/lib/summary.test.mjs scripts/collect.mjs config/urls.json
git commit -m "feat: capture FCP/SI in stored summaries, add optional URL label"
```

---

### Task 2: Dashboard models — label + fcp/si fields

**Files:**
- Modify: `dashboard/src/app/models/psi.model.ts`

**Interfaces:**
- Consumes: nothing (leaf types)
- Produces: `SeriesPoint` with optional `fcp?: number; si?: number` (old stored points won't have these — render as `—` downstream, no migration). `SummaryFile.label: string | null` (required-but-nullable, matching the existing `updatedAt: string | null` convention).

- [ ] **Step 1: Update the model file**

Replace `dashboard/src/app/models/psi.model.ts` with:

```ts
export interface SeriesPoint { t: string; score: number; lcp: number; cls: number; tbt: number; fcp?: number; si?: number; }
export interface Thresholds { mobile: number; desktop: number; }
export interface SummaryFile {
  url: string; slug: string; label: string | null; updatedAt: string | null;
  series: { mobile: SeriesPoint[]; desktop: SeriesPoint[] };
  thresholds: Thresholds;
}
export interface IndexFile { slugs: string[]; generatedAt: string; }
```

There is no dedicated test for this file (a pure type declaration) — its correctness is verified by every downstream component compiling and by their specs, in later tasks.

- [ ] **Step 2: Verify the project still compiles**

Run (from `dashboard/`): `npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS. (If it fails because `url-list.component.spec.ts`'s literal `SeriesPoint` objects are missing `fcp`/`si` — that's fine, they're optional now; a failure here would mean something else broke.)

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/models/psi.model.ts
git commit -m "feat: add label and optional fcp/si fields to dashboard models"
```

---

### Task 3: Shared pass/fail status-style helper

Both the home page and the detail page need the same "is this score above or below its threshold" → color decision. Extracting it once avoids duplicating the pass/fail logic in two components.

**Files:**
- Create: `dashboard/src/app/shared/status-style.ts`
- Create: `dashboard/src/app/shared/status-style.spec.ts`

**Interfaces:**
- Produces: `interface StatusStyle { color: string; bg: string }` and `function statusStyle(score: number, threshold: number): StatusStyle` — used by Task 4 (`url-list`) and Task 6 (`url-detail`).

- [ ] **Step 1: Write the failing test**

Create `dashboard/src/app/shared/status-style.spec.ts`:

```ts
import { statusStyle } from './status-style';

describe('statusStyle', () => {
  it('returns green when score meets the threshold exactly', () => {
    expect(statusStyle(50, 50)).toEqual({ color: '#2f9e44', bg: '#e6f6ea' });
  });
  it('returns green when score exceeds the threshold', () => {
    expect(statusStyle(70, 50).color).toBe('#2f9e44');
  });
  it('returns red when score is below the threshold', () => {
    expect(statusStyle(40, 50)).toEqual({ color: '#e03131', bg: '#fdecec' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `dashboard/`): `npm test -- --watch=false --browsers=ChromeHeadless --include='**/status-style.spec.ts'`
Expected: FAIL — `status-style.ts` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `dashboard/src/app/shared/status-style.ts`:

```ts
export interface StatusStyle { color: string; bg: string; }

export function statusStyle(score: number, threshold: number): StatusStyle {
  return score >= threshold
    ? { color: '#2f9e44', bg: '#e6f6ea' }
    : { color: '#e03131', bg: '#fdecec' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watch=false --browsers=ChromeHeadless --include='**/status-style.spec.ts'`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/shared/status-style.ts dashboard/src/app/shared/status-style.spec.ts
git commit -m "feat: add shared pass/fail status-style helper"
```

---

### Task 4: Home page redesign

Replace the bare `<ul><li><a>` list with the approved pill-card design: label (or hostname fallback) as title, tiny URL subtext, mobile/desktop scores shown separately and color-coded (no combined average), trend arrow kept from the existing implementation, styled "Details →" button.

**Files:**
- Modify: `dashboard/src/app/components/url-list/url-list.component.ts`
- Modify: `dashboard/src/app/components/url-list/url-list.component.spec.ts`
- Modify: `dashboard/src/styles.scss`

**Interfaces:**
- Consumes: `statusStyle(score, threshold): StatusStyle` from Task 3.
- Produces: `UrlListComponent.titleFor(s: { url: string; label: string | null }): string` (static, testable like the existing `trendOf`).

- [ ] **Step 1: Write the failing test**

Replace `dashboard/src/app/components/url-list/url-list.component.spec.ts` with:

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

describe('titleFor', () => {
  it('uses the label when present', () => {
    expect(UrlListComponent.titleFor({ url: 'https://a.com/', label: 'UAT Environment' })).toBe('UAT Environment');
  });
  it('falls back to the hostname when label is null', () => {
    expect(UrlListComponent.titleFor({ url: 'https://xq-booking-uat.newshore.es/', label: null })).toBe('xq-booking-uat.newshore.es');
  });
  it('strips protocol and trailing slash for the hostname fallback', () => {
    expect(UrlListComponent.titleFor({ url: 'http://example.com/path/', label: null })).toBe('example.com/path');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `dashboard/`): `npm test -- --watch=false --browsers=ChromeHeadless --include='**/url-list.component.spec.ts'`
Expected: FAIL — `UrlListComponent.titleFor` is not a function.

- [ ] **Step 3: Write minimal implementation**

Replace `dashboard/src/app/components/url-list/url-list.component.ts` with:

```ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '../../services/data.service';
import { SeriesPoint, SummaryFile } from '../../models/psi.model';
import { statusStyle } from '../../shared/status-style';

@Component({
  selector: 'app-url-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <h1 style="font-size:20px;margin-bottom:16px;color:#1a1a2e;">Monitored URLs</h1>
      <div *ngFor="let s of summaries" style="margin-bottom:16px;">
        <div style="background:#fff;border:1px solid #d7dbe4;border-radius:999px;padding:10px 12px 10px 22px;display:flex;align-items:center;gap:20px;max-width:520px;box-shadow:0 4px 14px rgba(30,40,80,.12);">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:15px;color:#1a1a2e;">{{ titleFor(s) }}</div>
            <div style="font-size:11px;color:#8a8f98;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ s.url }}</div>
          </div>
          <div style="text-align:center;">
            <div style="display:flex;align-items:baseline;gap:2px;justify-content:center;">
              <span [style.color]="scoreColor(s, 'mobile')" style="font-size:20px;font-weight:700;">{{ last(s, 'mobile')?.score ?? '—' }}</span>
              <span style="font-size:11px;color:#b0b5bd;">{{ badge(s, 'mobile') }}</span>
            </div>
            <div style="font-size:10px;color:#8a8f98;">📱 mobile</div>
          </div>
          <div style="text-align:center;">
            <div style="display:flex;align-items:baseline;gap:2px;justify-content:center;">
              <span [style.color]="scoreColor(s, 'desktop')" style="font-size:20px;font-weight:700;">{{ last(s, 'desktop')?.score ?? '—' }}</span>
              <span style="font-size:11px;color:#b0b5bd;">{{ badge(s, 'desktop') }}</span>
            </div>
            <div style="font-size:10px;color:#8a8f98;">🖥️ desktop</div>
          </div>
          <a [routerLink]="['/url', s.slug]" style="background:#3d5afe;color:#fff;padding:8px 18px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;">Details →</a>
        </div>
      </div>
      <p *ngIf="summaries.length === 0">No data yet.</p>
    </div>
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
  last(s: SummaryFile, strat: 'mobile' | 'desktop'): SeriesPoint | undefined { const a = s.series[strat]; return a[a.length - 1]; }
  scoreColor(s: SummaryFile, strat: 'mobile' | 'desktop'): string {
    const point = this.last(s, strat);
    return point ? statusStyle(point.score, s.thresholds[strat]).color : '#8a8f98';
  }
  badge(s: SummaryFile, strat: 'mobile' | 'desktop') {
    return { up: '▲', down: '▼', flat: '—' }[UrlListComponent.trendOf(s.series[strat])];
  }
  titleFor(s: SummaryFile): string { return UrlListComponent.titleFor(s); }

  static trendOf(points: SeriesPoint[]): 'up' | 'down' | 'flat' {
    if (points.length < 2) return 'flat';
    const d = points[points.length - 1].score - points[points.length - 2].score;
    return d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
  }
  static titleFor(s: { url: string; label: string | null }): string {
    if (s.label) return s.label;
    return s.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watch=false --browsers=ChromeHeadless --include='**/url-list.component.spec.ts'`
Expected: PASS (6 tests)

- [ ] **Step 5: Add the shared page background/wrapper**

Replace `dashboard/src/styles.scss` with:

```scss
body {
  margin: 0;
  background: #e8ebf3;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1a1a2e;
}

.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
}
```

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/app/components/url-list/url-list.component.ts dashboard/src/app/components/url-list/url-list.component.spec.ts dashboard/src/styles.scss
git commit -m "feat: redesign home page as pill cards with per-device scores"
```

---

### Task 5: Metric chart overhaul — titles, captions, gridlines, threshold lines

`MetricChartComponent` grows from "just a canvas with a Chart.js title" into a self-contained chart card: title + "data collected hourly" note derived from the `metric` input (the old free-text `title` input is removed — one source of truth avoids the caller passing a title that doesn't match the metric), light horizontal gridlines, a custom HTML legend (so a dashed "target" swatch can be shown), and a plain-English caption. The score chart additionally draws two dashed threshold lines (mobile/desktop, since their targets differ).

**Files:**
- Modify: `dashboard/src/app/components/metric-chart/metric-chart.component.ts`
- Modify: `dashboard/src/app/components/metric-chart/metric-chart.component.spec.ts`

**Interfaces:**
- Consumes: `SeriesPoint`, `Thresholds` from `../../models/psi.model`.
- Produces: `export type MetricKey = 'score' | 'fcp' | 'lcp' | 'cls' | 'tbt' | 'si'`, `export function chartTitle(metric: MetricKey): string`, `export function metricCaption(metric: MetricKey): string`, and component inputs `metric: MetricKey`, `mobile: SeriesPoint[]`, `desktop: SeriesPoint[]`, `thresholds?: Thresholds` (the `title` input is removed — Task 6 must not pass it). Consumed by Task 6.

- [ ] **Step 1: Write the failing test**

Replace `dashboard/src/app/components/metric-chart/metric-chart.component.spec.ts` with:

```ts
import { TestBed } from '@angular/core/testing';
import { MetricChartComponent, chartTitle, metricCaption } from './metric-chart.component';

describe('chartTitle', () => {
  it('drops the /100 suffix for score', () => {
    expect(chartTitle('score')).toBe('Performance score');
  });
  it('includes the unit for timing metrics', () => {
    expect(chartTitle('lcp')).toBe('LCP (ms)');
    expect(chartTitle('fcp')).toBe('FCP (ms)');
    expect(chartTitle('tbt')).toBe('TBT (ms)');
    expect(chartTitle('si')).toBe('SI (ms)');
  });
  it('has no unit for the unitless CLS metric', () => {
    expect(chartTitle('cls')).toBe('CLS');
  });
});

describe('metricCaption', () => {
  it('explains every metric in plain English, lower/higher guidance included', () => {
    expect(metricCaption('score')).toContain('Higher is better');
    expect(metricCaption('fcp')).toContain('Lower is better');
    expect(metricCaption('lcp')).toContain('Lower is better');
    expect(metricCaption('tbt')).toContain('Lower is better');
    expect(metricCaption('cls')).toContain('Lower is better');
    expect(metricCaption('si')).toContain('Lower is better');
  });
});

describe('MetricChartComponent', () => {
  it('creates and renders a canvas', () => {
    TestBed.configureTestingModule({ imports: [MetricChartComponent] });
    const fixture = TestBed.createComponent(MetricChartComponent);
    fixture.componentRef.setInput('metric', 'score');
    fixture.componentRef.setInput('mobile', [{ t: '2026-07-06T14:00:00Z', score: 47, lcp: 1, cls: 0, tbt: 1 }]);
    fixture.componentRef.setInput('desktop', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('canvas')).toBeTruthy();
  });

  it('shows a target legend entry only for the score metric with thresholds set', () => {
    TestBed.configureTestingModule({ imports: [MetricChartComponent] });
    const fixture = TestBed.createComponent(MetricChartComponent);
    fixture.componentRef.setInput('metric', 'lcp');
    fixture.componentRef.setInput('mobile', [{ t: '2026-07-06T14:00:00Z', score: 47, lcp: 1, cls: 0, tbt: 1 }]);
    fixture.componentRef.setInput('desktop', []);
    fixture.componentRef.setInput('thresholds', { mobile: 50, desktop: 66 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('target');

    fixture.componentRef.setInput('metric', 'score');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('mobile target (50)');
    expect(fixture.nativeElement.textContent).toContain('desktop target (66)');
  });

  it('destroys the chart instance on component teardown', () => {
    TestBed.configureTestingModule({ imports: [MetricChartComponent] });
    const fixture = TestBed.createComponent(MetricChartComponent);
    fixture.componentRef.setInput('metric', 'score');
    fixture.componentRef.setInput('mobile', [{ t: '2026-07-06T14:00:00Z', score: 47, lcp: 1, cls: 0, tbt: 1 }]);
    fixture.componentRef.setInput('desktop', []);
    fixture.detectChanges();

    const chart = (fixture.componentInstance as any).chart;
    expect(chart).toBeTruthy();
    const destroySpy = spyOn(chart, 'destroy').and.callThrough();

    fixture.destroy();

    expect(destroySpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `dashboard/`): `npm test -- --watch=false --browsers=ChromeHeadless --include='**/metric-chart.component.spec.ts'`
Expected: FAIL — `chartTitle`/`metricCaption` don't exist; component still requires a `title` input.

- [ ] **Step 3: Write minimal implementation**

Replace `dashboard/src/app/components/metric-chart/metric-chart.component.ts` with:

```ts
import { Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SeriesPoint, Thresholds } from '../../models/psi.model';

Chart.register(...registerables);

export type MetricKey = 'score' | 'fcp' | 'lcp' | 'cls' | 'tbt' | 'si';

const TITLES: Record<MetricKey, string> = {
  score: 'Performance score', fcp: 'FCP (ms)', lcp: 'LCP (ms)', tbt: 'TBT (ms)', cls: 'CLS', si: 'SI (ms)'
};

const CAPTIONS: Record<MetricKey, string> = {
  score: 'Overall health of the page, 0–100. Higher is better.',
  fcp: 'How long until the first bit of content appears on screen. Lower is better.',
  lcp: 'How long until the main content (hero image, headline) is visible. Lower is better.',
  tbt: 'How long the page is too busy to respond to clicks/taps while loading. Lower is better.',
  cls: 'How much page elements jump around while loading. Lower is better.',
  si: 'How quickly the page fills in visually as it loads. Lower is better.'
};

export function chartTitle(metric: MetricKey): string { return TITLES[metric]; }
export function metricCaption(metric: MetricKey): string { return CAPTIONS[metric]; }

@Component({
  selector: 'app-metric-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="background:#fff;border:1px solid #e2e5ea;border-radius:14px;padding:20px 24px;box-shadow:0 2px 8px rgba(30,40,80,.06);">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div style="font-weight:700;font-size:15px;color:#1a1a2e;">{{ chartTitle(metric) }}</div>
        <div style="font-size:11px;color:#8a8f98;">data collected hourly</div>
      </div>
      <div style="position:relative;height:220px;margin-top:10px;"><canvas #canvas></canvas></div>
      <div style="display:flex;gap:16px;font-size:12px;color:#5a5f6a;margin-top:8px;flex-wrap:wrap;">
        <span><span style="display:inline-block;width:10px;height:10px;background:#e8710a;border-radius:2px;margin-right:4px;"></span>mobile</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#1a73e8;border-radius:2px;margin-right:4px;"></span>desktop</span>
        <span *ngIf="metric === 'score' && thresholds">
          <svg width="16" height="10" style="vertical-align:middle;margin-right:4px;"><line x1="0" y1="5" x2="16" y2="5" stroke="#e8710a" stroke-dasharray="4,3" stroke-width="1.5"></line></svg>mobile target ({{ thresholds.mobile }})
        </span>
        <span *ngIf="metric === 'score' && thresholds">
          <svg width="16" height="10" style="vertical-align:middle;margin-right:4px;"><line x1="0" y1="5" x2="16" y2="5" stroke="#1a73e8" stroke-dasharray="4,3" stroke-width="1.5"></line></svg>desktop target ({{ thresholds.desktop }})
        </span>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #eef0f4;font-size:12px;color:#5a5f6a;line-height:1.5;">{{ metricCaption(metric) }}</div>
    </div>
  `
})
export class MetricChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() metric: MetricKey = 'score';
  @Input() mobile: SeriesPoint[] = [];
  @Input() desktop: SeriesPoint[] = [];
  @Input() thresholds?: Thresholds;
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;
  chart?: Chart;

  chartTitle = chartTitle;
  metricCaption = metricCaption;

  ngAfterViewInit() { this.render(); }
  ngOnChanges() { if (this.canvas) this.render(); }
  ngOnDestroy() { this.chart?.destroy(); }

  private line(points: SeriesPoint[]) {
    return points.map((p) => ({ x: p.t, y: (p as any)[this.metric] as number }));
  }

  private thresholdLine(points: SeriesPoint[], value: number) {
    return points.map((p) => ({ x: p.t, y: value }));
  }

  private render() {
    const datasets: any[] = [
      { label: 'mobile', data: this.line(this.mobile), borderColor: '#e8710a', tension: 0.2 },
      { label: 'desktop', data: this.line(this.desktop), borderColor: '#1a73e8', tension: 0.2 }
    ];
    if (this.metric === 'score' && this.thresholds) {
      if (this.mobile.length) datasets.push({ data: this.thresholdLine(this.mobile, this.thresholds.mobile), borderColor: '#e8710a', borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 });
      if (this.desktop.length) datasets.push({ data: this.thresholdLine(this.desktop, this.thresholds.desktop), borderColor: '#1a73e8', borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 });
    }
    const cfg: ChartConfiguration = {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: false }, legend: { display: false } },
        scales: {
          x: { type: 'category', grid: { display: false } },
          y: { grid: { color: '#eef0f4' }, ...(this.metric === 'score' ? { min: 0, max: 100 } : {}) }
        }
      }
    };
    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, cfg);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watch=false --browsers=ChromeHeadless --include='**/metric-chart.component.spec.ts'`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/components/metric-chart/metric-chart.component.ts dashboard/src/app/components/metric-chart/metric-chart.component.spec.ts
git commit -m "feat: turn metric-chart into a self-contained card with gridlines, threshold lines and plain-English captions"
```

---

### Task 6: Detail page redesign

Score-ring cards (mobile/desktop) with a 5-metric grid (FCP/LCP/TBT/CLS/SI, bold label + normal-weight value), a styled back link, and 6 chart cards (score + the 5 raw metrics) using the new `MetricChartComponent` API from Task 5.

**Files:**
- Modify: `dashboard/src/app/components/url-detail/url-detail.component.ts`
- Create: `dashboard/src/app/components/url-detail/url-detail.component.spec.ts`

**Interfaces:**
- Consumes: `statusStyle` (Task 3), `MetricChartComponent`, `MetricKey`, `chartTitle`/`metricCaption` (Task 5, via the component — not called directly), `SeriesPoint`/`SummaryFile`/`Thresholds` (Task 2).
- Produces: exported pure functions `metricValueFor(point: SeriesPoint | undefined, key: MetricKey): string` and `ringGradient(score: number | undefined, color: string): string`, used only inside this file but exported for direct unit testing (same pattern as `UrlListComponent.trendOf`).

- [ ] **Step 1: Write the failing test**

Create `dashboard/src/app/components/url-detail/url-detail.component.spec.ts`:

```ts
import { metricValueFor, ringGradient } from './url-detail.component';

describe('metricValueFor', () => {
  it('returns em-dash when there is no point', () => {
    expect(metricValueFor(undefined, 'lcp')).toBe('—');
  });
  it('returns em-dash when the metric is missing on the point (old data)', () => {
    expect(metricValueFor({ t: '', score: 50, lcp: 1200, cls: 0, tbt: 0 }, 'fcp')).toBe('—');
  });
  it('appends ms for timing metrics', () => {
    expect(metricValueFor({ t: '', score: 50, lcp: 1200, cls: 0.05, tbt: 0 }, 'lcp')).toBe('1200ms');
  });
  it('does not append a unit for CLS', () => {
    expect(metricValueFor({ t: '', score: 50, lcp: 1200, cls: 0.05, tbt: 0 }, 'cls')).toBe('0.05');
  });
});

describe('ringGradient', () => {
  it('builds a conic-gradient stopping at the score percentage', () => {
    expect(ringGradient(62, '#2f9e44')).toBe('conic-gradient(#2f9e44 0% 62%, #eef0f4 62% 100%)');
  });
  it('treats a missing score as 0%', () => {
    expect(ringGradient(undefined, '#e03131')).toBe('conic-gradient(#e03131 0% 0%, #eef0f4 0% 100%)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `dashboard/`): `npm test -- --watch=false --browsers=ChromeHeadless --include='**/url-detail.component.spec.ts'`
Expected: FAIL — `metricValueFor`/`ringGradient` are not exported from `url-detail.component.ts` yet.

- [ ] **Step 3: Write minimal implementation**

Replace `dashboard/src/app/components/url-detail/url-detail.component.ts` with:

```ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataService } from '../../services/data.service';
import { SeriesPoint, SummaryFile } from '../../models/psi.model';
import { MetricChartComponent, MetricKey } from '../metric-chart/metric-chart.component';
import { statusStyle } from '../../shared/status-style';

const RAW_METRICS: { key: MetricKey; label: string }[] = [
  { key: 'fcp', label: 'FCP' }, { key: 'lcp', label: 'LCP' }, { key: 'tbt', label: 'TBT' },
  { key: 'cls', label: 'CLS' }, { key: 'si', label: 'SI' }
];

export function metricValueFor(point: SeriesPoint | undefined, key: MetricKey): string {
  if (!point) return '—';
  const v = (point as any)[key];
  if (v == null) return '—';
  return key === 'cls' ? String(v) : `${v}ms`;
}

export function ringGradient(score: number | undefined, color: string): string {
  const pct = score ?? 0;
  return `conic-gradient(${color} 0% ${pct}%, #eef0f4 ${pct}% 100%)`;
}

@Component({
  selector: 'app-url-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MetricChartComponent],
  template: `
    <div class="page">
      <a routerLink="/" style="color:#3d5afe;font-weight:600;font-size:13px;text-decoration:none;">← Back to all URLs</a>
      <ng-container *ngIf="summary as s">
        <h1 style="font-size:20px;margin:12px 0 4px;color:#1a1a2e;">{{ s.label || s.url }}</h1>
        <p style="font-size:12px;color:#8a8f98;margin:0 0 16px;">{{ s.url }} · updated {{ s.updatedAt || '—' }}</p>

        <div style="display:flex;gap:18px;flex-wrap:wrap;">
          <div *ngFor="let strat of strategies" style="background:#fff;border:1px solid #e2e5ea;border-radius:14px;padding:22px 26px;min-width:340px;box-shadow:0 2px 8px rgba(30,40,80,.06);">
            <ng-container *ngIf="cardData(s, strat) as c">
              <div style="display:flex;align-items:center;gap:16px;">
                <div [style.background]="c.gradient" style="width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;">
                  <div [style.color]="c.color" style="width:48px;height:48px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;">{{ c.score ?? '—' }}</div>
                </div>
                <div>
                  <div style="font-size:12px;font-weight:600;color:#8a8f98;">{{ strat === 'mobile' ? '📱 MOBILE' : '🖥️ DESKTOP' }}</div>
                  <span [style.background]="c.bg" [style.color]="c.color" style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;">target {{ c.threshold }}</span>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:16px;text-align:center;">
                <div *ngFor="let m of c.metrics" style="background:#f4f6fb;border-radius:8px;padding:8px 2px;">
                  <div style="font-size:11px;font-weight:800;color:#3a3f4a;">{{ m.label }}</div>
                  <div style="font-size:13px;font-weight:400;color:#1a1a2e;">{{ m.value }}</div>
                </div>
              </div>
            </ng-container>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:20px;margin-top:24px;">
          <app-metric-chart metric="score" [mobile]="s.series.mobile" [desktop]="s.series.desktop" [thresholds]="s.thresholds"></app-metric-chart>
          <app-metric-chart *ngFor="let m of rawMetrics" [metric]="m.key" [mobile]="s.series.mobile" [desktop]="s.series.desktop"></app-metric-chart>
        </div>
      </ng-container>
    </div>
  `
})
export class UrlDetailComponent implements OnInit {
  private data = inject(DataService);
  private route = inject(ActivatedRoute);
  summary?: SummaryFile;
  rawMetrics = RAW_METRICS;
  strategies = ['mobile', 'desktop'] as const;

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.data.getSummary(slug).subscribe((s) => (this.summary = s));
  }

  private latest(s: SummaryFile, strategy: 'mobile' | 'desktop'): SeriesPoint | undefined {
    const a = s.series[strategy];
    return a[a.length - 1];
  }

  cardData(s: SummaryFile, strategy: 'mobile' | 'desktop') {
    const point = this.latest(s, strategy);
    const threshold = s.thresholds[strategy];
    const style = statusStyle(point?.score ?? 0, threshold);
    return {
      score: point?.score ?? null,
      color: style.color,
      bg: style.bg,
      gradient: ringGradient(point?.score, style.color),
      threshold,
      metrics: RAW_METRICS.map((m) => ({ label: m.label, value: metricValueFor(point, m.key) }))
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --watch=false --browsers=ChromeHeadless --include='**/url-detail.component.spec.ts'`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full dashboard test suite**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Expected: PASS, no regressions across `app.component.spec.ts`, `data.service.spec.ts`, and every spec touched in Tasks 3–6.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/app/components/url-detail/url-detail.component.ts dashboard/src/app/components/url-detail/url-detail.component.spec.ts
git commit -m "feat: redesign detail page with score-ring cards and 6 metric charts"
```

---

### Task 7: Local mock-data review before merge

Per the approved spec, review the finished redesign against a mock fixture with `ng serve` before opening a PR — do not wire this fixture into the real collection pipeline.

**Files:**
- Create: `dashboard/public/data/index.json` (gitignored, local-only)
- Create: `dashboard/public/data/summary/xq-booking-uat-newshore-es.json` (gitignored, local-only)
- Modify: `.gitignore`

**Interfaces:** none — this task produces no code, only a manual verification checkpoint.

- [ ] **Step 1: Gitignore the local mock fixture**

Add to `.gitignore` (after the existing `docs/browser/` line):

```
dashboard/public/data/
```

- [ ] **Step 2: Create the mock index**

Create `dashboard/public/data/index.json`:

```json
{ "slugs": ["xq-booking-uat-newshore-es"], "generatedAt": "2026-07-08T11:00:00Z" }
```

- [ ] **Step 3: Create the mock summary**

Create `dashboard/public/data/summary/xq-booking-uat-newshore-es.json`:

```json
{
  "url": "https://xq-booking-uat.newshore.es/",
  "slug": "xq-booking-uat-newshore-es",
  "label": "UAT Environment",
  "updatedAt": "2026-07-08T11:00:00Z",
  "thresholds": { "mobile": 50, "desktop": 66 },
  "series": {
    "mobile": [
      { "t": "2026-07-08T08:00:00Z", "score": 55, "fcp": 1400, "lcp": 2600, "tbt": 220, "cls": 0.12, "si": 3200 },
      { "t": "2026-07-08T09:00:00Z", "score": 58, "fcp": 1300, "lcp": 2400, "tbt": 200, "cls": 0.10, "si": 3000 },
      { "t": "2026-07-08T10:00:00Z", "score": 60, "fcp": 1250, "lcp": 2200, "tbt": 170, "cls": 0.09, "si": 2900 },
      { "t": "2026-07-08T11:00:00Z", "score": 62, "fcp": 1200, "lcp": 2100, "tbt": 150, "cls": 0.08, "si": 2800 }
    ],
    "desktop": [
      { "t": "2026-07-08T08:00:00Z", "score": 70, "fcp": 800, "lcp": 1600, "tbt": 90, "cls": 0.03, "si": 1100 },
      { "t": "2026-07-08T09:00:00Z", "score": 73, "fcp": 760, "lcp": 1500, "tbt": 75, "cls": 0.025, "si": 1000 },
      { "t": "2026-07-08T10:00:00Z", "score": 76, "fcp": 720, "lcp": 1450, "tbt": 65, "cls": 0.02, "si": 950 },
      { "t": "2026-07-08T11:00:00Z", "score": 78, "fcp": 700, "lcp": 1400, "tbt": 60, "cls": 0.02, "si": 900 }
    ]
  }
}
```

- [ ] **Step 4: Run the app and review in browser**

Run (from `dashboard/`): `npm start`
Open `http://localhost:4200` — confirm:
- Home page: single "UAT Environment" pill card, mobile 62 (green), desktop 78 (green), trend arrows, "Details →" button.
- Click through to the detail page: styled back link, two score-ring cards (both green, targets 50/66), 5-metric grids showing FCP/LCP/TBT/CLS/SI with real values, 6 charts (score with two dashed target lines + mobile/desktop legend + target legend entries + caption; FCP/LCP/TBT/CLS/SI each with gridlines + legend + caption, no target line).
- Stop the server (`Ctrl+C`) once confirmed.

- [ ] **Step 5: Commit the gitignore change only**

The mock fixture files are gitignored and won't be staged. Commit just the ignore-rule addition:

```bash
git add .gitignore
git commit -m "chore: gitignore local mock PSI data used for dashboard review"
```

- [ ] **Step 6: Open the PR**

```bash
git push -u origin <branch-name>
gh pr create --title "Redesign dashboard: pill cards, score-ring detail cards, FCP/SI metrics, chart captions" --body "$(cat <<'EOF'
## Summary
- Home page: pill cards with per-device scores (no combined average), env label, styled button
- Detail page: score-ring cards with 5-metric grid (FCP/LCP/TBT/CLS/SI), color-only pass/fail, styled back link
- Charts: horizontal gridlines, dashed per-device threshold lines on the score chart, plain-English caption per metric
- Backend: FCP/SI were computed but dropped before storage — now captured; added optional per-URL `label` config field

## Test plan
- [x] `node --test` (backend) passes
- [x] `npm test -- --watch=false --browsers=ChromeHeadless` (dashboard) passes
- [x] Reviewed locally against mock data via `ng serve`
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** config `label` field (Task 1), FCP/SI backend capture (Task 1), home page redesign incl. per-device scores/no-average (Task 4), page background (Task 4 styles.scss), detail page score-ring + 5-metric grid + back link (Task 6), chart gridlines/threshold-line/legend/caption (Task 5), local mock-data review before PR (Task 7). All spec sections covered.
- **Type consistency:** `MetricKey` defined once in Task 5, imported (not redefined) in Task 6. `StatusStyle`/`statusStyle` defined once in Task 3, imported in Tasks 4 and 6. `SeriesPoint`/`SummaryFile`/`Thresholds` defined once in Task 2, imported everywhere else.
- **No placeholders:** every step has literal code and exact run commands.
