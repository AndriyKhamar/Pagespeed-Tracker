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
