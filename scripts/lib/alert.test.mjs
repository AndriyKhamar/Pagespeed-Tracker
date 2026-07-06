import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAlert } from './alert.mjs';

test('alerts when under and not yet alerted today', () => {
  assert.equal(shouldAlert({ score: 40, threshold: 50, lastDate: null, today: '2026-07-06' }), true);
});
test('no alert when at/above threshold', () => {
  assert.equal(shouldAlert({ score: 50, threshold: 50, lastDate: null, today: '2026-07-06' }), false);
});
test('no second alert same day', () => {
  assert.equal(shouldAlert({ score: 40, threshold: 50, lastDate: '2026-07-06', today: '2026-07-06' }), false);
});
test('alerts again on a new day', () => {
  assert.equal(shouldAlert({ score: 40, threshold: 50, lastDate: '2026-07-05', today: '2026-07-06' }), true);
});
