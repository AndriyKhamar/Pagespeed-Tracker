import test from 'node:test';
import assert from 'node:assert/strict';
import { fileStamp, isoStamp, windowStart } from './time.mjs';

const d = new Date('2026-07-06T14:00:00Z');

test('fileStamp is filename-safe UTC', () => {
  assert.equal(fileStamp(d), '2026-07-06T14-00-00Z');
});

test('isoStamp is second-precision UTC', () => {
  assert.equal(isoStamp(d), '2026-07-06T14:00:00Z');
});

test('windowStart is first day of previous month UTC', () => {
  assert.equal(windowStart(d).toISOString(), '2026-06-01T00:00:00.000Z');
});

test('windowStart wraps year in January', () => {
  assert.equal(windowStart(new Date('2026-01-15T00:00:00Z')).toISOString(), '2025-12-01T00:00:00.000Z');
});
