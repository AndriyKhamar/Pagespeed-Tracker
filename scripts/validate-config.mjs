import { readFile } from 'node:fs/promises';
import { validateConfig } from './lib/validateConfig.mjs';

const cfg = JSON.parse(await readFile(new URL('../config/urls.json', import.meta.url), 'utf8'));
const errs = validateConfig(cfg);
if (errs.length) {
  console.error('Invalid config/urls.json:');
  for (const e of errs) console.error(' -', e);
  process.exit(1);
}
console.log('config/urls.json OK');
