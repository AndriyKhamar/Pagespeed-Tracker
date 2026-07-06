# PageSpeed Tracker — Design

**Date:** 2026-07-06
**Status:** Approved design, pre-implementation

## Goal

Zero-cost web performance monitoring. Periodically run PageSpeed Insights (PSI)
analyses on configured URLs (mobile + desktop), store historical results as JSON
committed to the repo, and display dashboards with charts and trend indicators.
Everything runs on free tiers: GitHub Actions (compute + scheduler), JSON files
in the repo (persistence), GitHub Pages (hosting). No server, no database, no
paid services.

PSI API is used deliberately — its Lighthouse runs apply consistent throttling
server-side, so no local Lighthouse CLI is needed and results are comparable
across runs.

## Constraints

- No paid hosting, database, backend, scheduler, or email service.
- Frontend: Angular 18 (standalone components) + Chart.js.
- Persistence: JSON files committed to the repo.
- Scheduler: GitHub Actions cron, hourly.
- Analysis: PSI API, `mobile` + `desktop` strategies.
- **Public repository** — no credentials or sensitive data may be committed or
  leaked through workflow logs.

## Initial configuration

- Monitored URL: `https://xq-booking-uat.newshore.es/`
- Frequency: hourly (single global cron; per-URL frequency is out of scope — YAGNI).
- PSI: **unauthenticated** (no API key). Accepted risk: shared-runner IP rate
  limits; mitigated by retry/backoff and skip-on-failure.
- Alert recipient (deferred): andriy.khamar@flyr.com via Gmail SMTP.
- Slack: not configured; plumbing prepared, not wired.

## Architecture

```
Pagespeed-Tracker/
├── config/
│   └── urls.json                 # monitored URLs (public URLs only)
├── scripts/                       # Node ESM, no runtime deps beyond built-ins
│   ├── collect.mjs                # fetch PSI, write runs, update summary
│   ├── aggregate.mjs              # append/rebuild summary series
│   ├── prune.mjs                  # drop data older than previous month
│   ├── alert.mjs                  # threshold check (DEFERRED: send not wired)
│   ├── validate-config.mjs        # config linter
│   └── lib/                       # slugify, parsePSI, pruneWindow, etc.
├── docs/                          # GitHub Pages source (Pages: main /docs)
│   ├── index.html + Angular bundle (built from dashboard/)
│   └── data/
│       ├── index.json             # list of monitored slugs
│       ├── runs/{slug}/{strategy}/{ts}.json
│       ├── summary/{slug}.json    # aggregated series the dashboard reads
│       └── alert-state.json       # last-alert date per url+strategy (dates only)
├── dashboard/                     # Angular app (source)
│   └── src/app/...
├── .github/workflows/
│   ├── collect.yml                # hourly cron + manual dispatch
│   ├── build-dashboard.yml        # on push to dashboard/**, build into docs/
│   └── test.yml                   # node --test on push/PR
└── docs/superpowers/specs/        # this spec
```

### Hosting model (key decision)

GitHub Pages serves from **`main` branch `/docs`**. The Angular bundle lives in
`/docs`; data lives in `/docs/data`. The Angular app fetches data **at runtime**
via `HttpClient` (`./data/...`) — data is never baked into the build.

Consequences:
- Hourly data commits do **not** trigger an Angular rebuild — the bundle is
  static; only `docs/data/**` changes each hour. Pages auto-deploys on push.
- No `gh-pages` branch, no per-hour deploy job, no two-writer race on a deploy
  branch.
- The Angular bundle is rebuilt and committed to `docs/` only when
  `dashboard/**` changes (`build-dashboard.yml`).

## Data flow

`collect.yml` (hourly cron + manual dispatch):

```
validate-config
for each url in config/urls.json:
  for strategy in [mobile, desktop]:
    resp = fetchPSI(url, strategy)      # 3 retries, exp backoff 2/4/8s
    if failed: log warning; continue    # NO file written, NO fabricated data
    write docs/data/runs/{slug}/{strategy}/{ts}.json
    aggregate → append point to docs/data/summary/{slug}.json
prune()                                  # drop runs + summary points older than prev month
update docs/data/index.json
git pull --rebase && commit && push      # only if working tree changed
```

Dashboard reads only `index.json` + `summary/{slug}.json`. Raw run files are the
audit trail / source for rebuilding summaries.

## JSON schemas

### `config/urls.json`
```json
{
  "urls": [
    { "url": "https://xq-booking-uat.newshore.es/" }
  ],
  "thresholds": { "mobile": 50, "desktop": 66 }
}
```

### Run file — `docs/data/runs/{slug}/{strategy}/2026-07-06T14-00-00Z.json`
Timestamp uses `-` instead of `:` (filename-safe on all platforms).
```json
{
  "url": "https://xq-booking-uat.newshore.es/",
  "strategy": "mobile",
  "fetchedAt": "2026-07-06T14:00:00Z",
  "score": 47,
  "metrics": { "lcp": 4200, "cls": 0.12, "tbt": 890, "fcp": 2100, "si": 5300 },
  "lighthouseVersion": "11.0.0"
}
```
- `score`: normalized `Math.round(performance.score * 100)` → 0–100.
- `lcp`, `tbt`, `fcp`, `si`: milliseconds. `cls`: unitless.

### Summary — `docs/data/summary/{slug}.json` (dashboard reads this)
```json
{
  "url": "https://xq-booking-uat.newshore.es/",
  "slug": "xq-booking-uat-newshore-es",
  "updatedAt": "2026-07-06T14:00:00Z",
  "series": {
    "mobile":  [{ "t": "2026-07-06T14:00:00Z", "score": 47, "lcp": 4200, "cls": 0.12, "tbt": 890 }],
    "desktop": [{ "t": "2026-07-06T14:00:00Z", "score": 71, "lcp": 1800, "cls": 0.02, "tbt": 120 }]
  },
  "thresholds": { "mobile": 50, "desktop": 66 }
}
```

### Index — `docs/data/index.json`
```json
{ "slugs": ["xq-booking-uat-newshore-es"], "generatedAt": "2026-07-06T14:00:00Z" }
```

### Alert state — `docs/data/alert-state.json` (dates only, no secrets)
```json
{ "xq-booking-uat-newshore-es": { "mobile": "2026-07-06", "desktop": null } }
```

## Retention / prune

Keep **current month + previous month** only (rolling 2-month window). On each
run, `prune.mjs`:
- Computes keep-window start = first day of previous month (UTC).
- Deletes run files whose `fetchedAt` predates the window.
- Filters each summary `series` array to the window.
Idempotent — safe to run every hour.

## Alerting (DEFERRED)

Plumbing built now, sending wired later:
- `alert.mjs` computes `under = score < threshold` per url+strategy.
- One notification per url+strategy per UTC day: send only if
  `under && alert-state[slug][strategy] != todayUTC`; then set the date.
- A failed PSI run never touches alert state and never triggers an alert.
- When enabled: Gmail SMTP via `${{ secrets.SMTP_PASSWORD }}` mapped to env in a
  single send step; Slack via `${{ secrets.SLACK_WEBHOOK }}`. Neither is
  committed or logged. Timing of send is not important.

## Error handling

| Case | Behavior |
|------|----------|
| PSI 429 / timeout / 5xx | 3 retries exp backoff; all fail → log, skip, no file |
| Malformed PSI response (missing score) | Treat as failure, skip |
| Push rejected (race) | `concurrency` group serializes; `git pull --rebase`; retry push once |
| First run / no summary | Create summary; dashboard renders "no data yet" |
| Invalid config | `validate-config.mjs` fails workflow before any API call |
| Missing hour | Honest gap in chart (no interpolation) |

## Security (public repo)

- Deferring alerts means **no secrets are required now** — repo stays clean.
- Future secrets referenced only via `${{ secrets.* }}`, mapped to env in the one
  step that needs them, never `echo`'d, never committed.
- Workflow `permissions: contents: write` (least privilege) for the commit step.
- Fork PRs do not receive secrets (GitHub default) — no exfiltration path.
- `config/urls.json` contains public URLs only.
- `.gitignore`: `node_modules`, `.env`, `dashboard/dist` intermediate, any creds.

## Frontend (Angular 18 standalone + Chart.js)

```
dashboard/src/app/
├── models/psi.model.ts       # RunResult, SummaryFile, SeriesPoint, PsiApiResponse (TS interfaces)
├── services/data.service.ts  # HttpClient GET ./data/index.json + ./data/summary/{slug}.json
├── components/
│   ├── url-list/             # monitored URLs + trend badge (▲▼— vs previous point)
│   ├── url-detail/           # last-run cards (mobile/desktop) + charts
│   └── metric-chart/         # reusable Chart.js line: score | lcp | cls | tbt, mobile vs desktop
└── app.component + routes
```

- Score charts on 0–100 scale; displayed as "X / 100" (same logic as PSI UI).
- Trend indicator: last point vs previous → ▲ up / ▼ down / — flat, colored.
- `base-href` = `/Pagespeed-Tracker/` for the Pages subpath.
- Empty-state handling when a summary has no points.

## Testing

- Node built-in `node:test` + `assert` (no framework). Pure-function coverage:
  `slugify`, `normalizeScore`, `pruneWindow`, `parsePSI(mock)`, `shouldAlert`.
- PSI fetch injected/mocked — no live API in tests.
- `test.yml` runs `node --test` on push/PR.
- Angular: `ng test` for `data.service` (mocked HttpClient) + one chart smoke test.

## Deliverables

Architecture (this doc), repo structure, workflow YAML, PSI TypeScript
interfaces, Angular data service, chart components, JSON schemas, alerting logic
(deferred send), setup/usage docs (`README`), and `validate-config.mjs`.

## Out of scope (YAGNI)

- Per-URL frequency scheduling.
- Alert email/Slack sending (plumbing only).
- Multiple environments / auth on monitored URLs.
- Aggregation beyond the 2-month raw window.
