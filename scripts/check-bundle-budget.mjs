import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { analyse } from './bundleBudget.mjs';

/**
 * The most JavaScript, gzipped, that the landing route may transfer. Agreed, then enforced by the
 * build. See "Landing page performance" in the README for how the number was reached and what
 * would lower it.
 */
export const BUDGET_KB = 175;

const dist = resolve(import.meta.dirname, '..', 'dist');
const manifest = JSON.parse(readFileSync(resolve(dist, '.vite', 'manifest.json'), 'utf8'));
const gzipBytes = (file) => gzipSync(readFileSync(resolve(dist, file))).length;

const result = analyse(manifest, gzipBytes, BUDGET_KB * 1024);
console.log('\nLanding route, JavaScript transferred (gzip):');
for (const chunk of result.files.sort((a, b) => b.bytes - a.bytes)) {
  console.log(`  ${(chunk.bytes / 1024).toFixed(1).padStart(7)} KB  ${chunk.file}`);
}
console.log(
  `  ${(result.total / 1024).toFixed(1).padStart(7)} KB  total, budget ${BUDGET_KB} KB\n`,
);

if (result.problems.length > 0) {
  for (const problem of result.problems) console.error(`Bundle budget: ${problem}`);
  process.exit(1);
}
