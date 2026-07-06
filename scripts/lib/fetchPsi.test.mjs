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
