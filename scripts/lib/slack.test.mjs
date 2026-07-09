import test from 'node:test';
import assert from 'node:assert/strict';
import { alertText } from './slack.mjs';

test('alertText names the env, strategy, score and target', () => {
  const t = alertText({ label: 'PROD Environment', url: 'https://a.com/', strategy: 'mobile', score: 40, threshold: 50 });
  assert.match(t, /PROD Environment/);
  assert.match(t, /mobile/);
  assert.match(t, /\*40\*/);
  assert.match(t, /target 50/);
  assert.match(t, /https:\/\/a\.com\//);
});

test('alertText falls back to the url when label is missing', () => {
  const t = alertText({ label: null, url: 'https://a.com/', strategy: 'desktop', score: 30, threshold: 66 });
  assert.match(t, /\*https:\/\/a\.com\/\*/);
});

test('alertText includes a dashboard link when provided', () => {
  const t = alertText({ label: 'X', url: 'https://a.com/', strategy: 'mobile', score: 1, threshold: 2, dashboardUrl: 'https://dash/' });
  assert.match(t, /<https:\/\/dash\/\|View dashboard>/);
});
