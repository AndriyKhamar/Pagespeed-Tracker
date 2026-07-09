import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { dailyReport } from './lib/report.mjs';
import { postSlack } from './lib/slack.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'docs', 'data');

async function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) { console.error('SLACK_WEBHOOK_URL not set — skipping report'); return; }

  const index = await readJson(join(dataDir, 'index.json'), { slugs: [] });
  const summaries = [];
  for (const slug of index.slugs) {
    const s = await readJson(join(dataDir, 'summary', `${slug}.json`), null);
    if (s) summaries.push(s);
  }

  const date = new Date().toISOString().slice(0, 10);
  const text = dailyReport(summaries, { dashboardUrl: process.env.DASHBOARD_URL, date });
  await postSlack(webhook, text);
  console.log(`report sent for ${summaries.length} env(s)`);
}

main();
