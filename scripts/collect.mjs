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
import { shouldAlert } from './lib/alert.mjs';
import { alertText, postSlack } from './lib/slack.mjs';

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

  // Slack alerting is opt-in: no webhook configured → collection runs exactly as before.
  const webhook = process.env.SLACK_WEBHOOK_URL;
  const dashboardUrl = process.env.DASHBOARD_URL;
  const today = fetchedAt.slice(0, 10); // YYYY-MM-DD; debounce is once-per-day per url+strategy

  for (const { url, label } of cfg.urls) {
    const slug = slugify(url);
    slugs.push(slug);
    const summaryPath = join(dataDir, 'summary', `${slug}.json`);
    const summary = await readJson(summaryPath, emptySummary(url, slug, cfg.thresholds, label ?? null));
    summary.thresholds = cfg.thresholds;
    summary.label = label ?? null;
    summary.lastAlert ??= {}; // summaries created before alerting existed have no lastAlert

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

        const threshold = cfg.thresholds[strategy];
        if (webhook && shouldAlert({ score: run.score, threshold, lastDate: summary.lastAlert[strategy], today })) {
          try {
            await postSlack(webhook, alertText({ label: summary.label, url, strategy, score: run.score, threshold, dashboardUrl }));
            summary.lastAlert[strategy] = today;
            console.log(`ALERT ${slug} ${strategy} ${run.score}<${threshold}`);
          } catch (err) {
            console.warn(`ALERT FAIL ${slug} ${strategy}: ${err.message}`);
          }
        }
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
