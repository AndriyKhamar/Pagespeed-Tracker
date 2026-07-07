import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from './validateConfig.mjs';

test('valid config yields no errors', () => {
  const errs = validateConfig({ urls: [{ url: 'https://a.com/' }], thresholds: { mobile: 50, desktop: 66 } });
  assert.deepEqual(errs, []);
});
test('flags empty urls and bad url and missing thresholds', () => {
  const errs = validateConfig({ urls: [{ url: 'not-a-url' }], thresholds: { mobile: 50 } });
  assert.ok(errs.some((e) => /url/i.test(e)));
  assert.ok(errs.some((e) => /desktop/i.test(e)));
});
test('flags missing urls array', () => {
  const errs = validateConfig({ thresholds: { mobile: 50, desktop: 66 } });
  assert.ok(errs.length >= 1);
});
