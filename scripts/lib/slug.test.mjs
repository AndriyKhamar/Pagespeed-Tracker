import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from './slug.mjs';

test('slugify strips protocol and punctuation', () => {
  assert.equal(slugify('https://xq-booking-uat.newshore.es/'), 'xq-booking-uat-newshore-es');
});

test('slugify is deterministic and collapses repeats', () => {
  assert.equal(slugify('https://a.com//path?x=1'), 'a-com-path-x-1');
});
