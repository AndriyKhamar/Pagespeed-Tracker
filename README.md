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
