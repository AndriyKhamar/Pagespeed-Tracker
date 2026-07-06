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
