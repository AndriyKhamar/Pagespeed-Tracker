# Dashboard redesign — design spec

## Purpose

Dashboard (`dashboard/`) currently renders raw unstyled HTML: bare links, no
color, no visual hierarchy between the global score and sub-metrics, no
threshold context, no plain-English explanation of metrics. Goal: professional
look, clearer hierarchy, and room for adding FCP/SI (currently collected by
the PSI API but dropped before storage).

Approved via visual brainstorming companion (mockups under
`.superpowers/brainstorm/`, gitignored).

## Config schema change

`config/urls.json` — add optional `label` per URL entry:

```json
{
  "urls": [
    { "url": "https://xq-booking-uat.newshore.es/", "label": "UAT Environment" }
  ],
  "thresholds": { "mobile": 50, "desktop": 66 }
}
```

`SummaryFile` model gains `label: string | null`. `emptySummary()` takes and
stores it. If absent, dashboard falls back to showing the hostname (parsed
from `url`) as the title instead of the label.

## Backend: capture FCP + SI

`scripts/lib/psi.mjs` `parsePsi()` already computes `fcp` and `si` in
`metrics`, but `scripts/lib/summary.mjs` `appendPoint()` drops them when
building each stored point. Fix: store all 5 raw metrics per point.

`SeriesPoint` (both `scripts` side, informal, and
`dashboard/src/app/models/psi.model.ts`) becomes:

```ts
interface SeriesPoint { t: string; score: number; fcp: number; lcp: number; tbt: number; cls: number; si: number; }
```

No migration needed for old stored points — missing fields render as `—` in
the UI (existing pattern already used for `updatedAt` etc).

## Visual system (shared)

- Page background: `#e8ebf3` (was default white) — gives cards a lifted,
  professional feel via a stronger tinted shadow (`0 2px 8px rgba(30,40,80,.06)`
  for cards, `0 4px 14px rgba(30,40,80,.12)` for the home pill).
- Pass/fail color: green `#2f9e44` (score ≥ threshold), red `#e03131` (score <
  threshold). Used for score numbers, score ring, and the target badge
  background/text — no "above/below" wording, color alone communicates status.
  Badge text is just `target {N}`.
- Chart line colors unchanged: mobile `#e8710a`, desktop `#1a73e8`.
- Accent/button color: `#3d5afe` (home page "Details →" pill button, links).
- Back-link on detail page: styled as a colored text link with arrow (`← Back
  to all URLs`, `#3d5afe`, bold, no underline), not a raw browser default link.

## Home page (`url-list.component.ts`)

One pill-shaped card per monitored URL, replacing the current `<ul><li><a>`
list:

- Title: `label` if present, else hostname (strip `https://` and trailing
  `/`). Bold, dark (`#1a1a2e`).
- Subtext directly below title: full URL, tiny/muted (`11px`, `#8a8f98`).
- Two score numbers side by side, each with a small caption (`📱 mobile`,
  `🖥️ desktop`), color-coded pass/fail vs that URL's threshold. **No combined
  average** — averaging mobile and desktop into one number was rejected as
  meaningless (different thresholds, different devices).
- "Details →" pill button (`#3d5afe` bg, white text) linking to `/url/:slug`.
- Empty state (`No data yet.`) unchanged.

## Detail page (`url-detail.component.ts`)

- Back link restyled per shared system above.
- Two score cards side by side (mobile / desktop), each:
  - Score ring: CSS `conic-gradient`, green/red arc by pass/fail, big number
    centered inside.
  - Strategy label (`📱 MOBILE` / `🖥️ DESKTOP`) + badge `target {N}` (colored
    bg/text by pass/fail) next to the ring.
  - 5-column mini-grid below: FCP, LCP, TBT, CLS, SI. Each cell: **bold label
    on top** (`800` weight, `#3a3f4a`), **normal-weight value below**
    (`#1a1a2e`) — label is the visual anchor, value is secondary, since the
    label set is fixed and the value is what changes.
  - Cards need enough width for 5 columns without wrapping awkwardly
    (`min-width: 340px`).

## Charts (`metric-chart.component.ts`)

One chart per metric: score, FCP, LCP, TBT, CLS, SI (6 total, up from 4 — adds
FCP and SI).

- Horizontal gridlines at even intervals (5 lines) on every chart — Chart.js
  `scales.y.grid` styled light gray (`#eef0f4`), not the current default.
- Score chart only: dashed red (`#e03131`) horizontal line at the threshold
  value (`scales.y` annotation or a synthetic flat dataset styled dashed).
  No inline text label on the line itself.
- Legend below each chart: existing mobile/desktop swatches, plus — score
  chart only — a dashed-line swatch labeled "target threshold".
- Small muted note top-right of each chart card: "data collected hourly". No
  interactive time-range filter (explicitly descoped — data volume doesn't
  warrant it yet).
- Below every chart, a 1-line plain-English caption (own request: understand
  metrics without technical background):
  - **Score** — overall health of the page, 0–100. Higher is better.
  - **FCP** — how long until the first bit of content appears on screen. Lower is better.
  - **LCP** — how long until the main content (hero image, headline) is visible. Lower is better.
  - **TBT** — how long the page is too busy to respond to clicks/taps while loading. Lower is better.
  - **CLS** — how much page elements jump around while loading. Lower is better.
  - **SI** — how quickly the page fills in visually as it loads. Lower is better.

## Explicitly out of scope

- Interactive chart time-range filtering (24h/7d/30d) — descoped in favor of
  a static "data collected hourly" note.
- Multi-URL comparison views, historical average score — not requested.

## Review process

Implement against mock summary data (a fixture JSON matching `SummaryFile`,
swapped in locally for `DataService`) so the real app can be run with `ng
serve` and reviewed in-browser before wiring back to real collected data and
opening a PR.
