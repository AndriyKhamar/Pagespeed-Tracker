import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyReport } from './report.mjs';

const summaries = [
  {
    label: 'PROD Environment', url: 'https://p.com/', thresholds: { mobile: 50, desktop: 66 },
    series: { mobile: [{ score: 40 }, { score: 49 }], desktop: [{ score: 72 }] }
  },
  {
    label: null, url: 'https://u.com/', thresholds: { mobile: 50, desktop: 66 },
    series: { mobile: [], desktop: [{ score: 80 }] }
  }
];

test('reports every env with latest score vs target', () => {
  const t = dailyReport(summaries, { date: '2026-07-09' });
  assert.match(t, /Daily PageSpeed report\* — 2026-07-09/);
  assert.match(t, /PROD Environment/);
  assert.match(t, /mobile: \*49\* \/ 50/); // latest point, not the earlier 40
  assert.match(t, /desktop: \*72\* \/ 66/);
});

test('marks below-target red and at/above-target green', () => {
  const t = dailyReport(summaries, { date: '2026-07-09' });
  assert.match(t, /mobile: \*49\* \/ 50 :red_circle:/);   // 49 < 50
  assert.match(t, /desktop: \*72\* \/ 66 :white_check_mark:/); // 72 >= 66
});

test('falls back to url when label missing and shows no-data for empty series', () => {
  const t = dailyReport(summaries, { date: '2026-07-09' });
  assert.match(t, /\*https:\/\/u\.com\/\*/);
  assert.match(t, /mobile: no data/);
});

test('includes dashboard link when provided', () => {
  const t = dailyReport(summaries, { date: '2026-07-09', dashboardUrl: 'https://dash/' });
  assert.match(t, /<https:\/\/dash\/\|Open dashboard>/);
});

test('handles zero environments', () => {
  const t = dailyReport([], { date: '2026-07-09' });
  assert.match(t, /No environments configured/);
});
