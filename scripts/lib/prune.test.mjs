import test from 'node:test';
import assert from 'node:assert/strict';
import { pruneRunFiles } from './prune.mjs';

test('pruneRunFiles returns only files before window start', () => {
  const files = ['2026-05-01T00-00-00Z.json', '2026-06-15T10-00-00Z.json', '2026-07-06T14-00-00Z.json'];
  const del = pruneRunFiles(files, new Date('2026-06-01T00:00:00Z'));
  assert.deepEqual(del, ['2026-05-01T00-00-00Z.json']);
});

test('ignores non-timestamp files', () => {
  assert.deepEqual(pruneRunFiles(['.gitkeep', 'x.json'], new Date('2026-06-01T00:00:00Z')), []);
});
