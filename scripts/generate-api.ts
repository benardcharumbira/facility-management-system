/**
 * Regenerates the published API contract from the schemas and the mock.
 *
 *   npm run api:generate   writes api/openapi.yaml and api/INVENTORY.md
 *   npm run api:check      fails if the committed copies are not what this would write
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DateTime, Settings } from 'luxon';
import { setupServer } from 'msw/node';
import { createCaller, EXAMPLE_NOW } from '../src/api-contract/examples';
import { generateArtifacts, seedMock } from '../src/api-contract/generate';
import { createHandlers } from '../src/mocks/handlers';

const BASE = 'http://localhost:5000/api';
const root = resolve(import.meta.dirname, '..', 'api');
const check = process.argv.includes('--check');

Settings.now = () => EXAMPLE_NOW.toMillis();
const server = setupServer(
  ...createHandlers(BASE, { now: () => DateTime.fromMillis(Settings.now(), { zone: 'utc' }) }),
);
server.listen({ onUnhandledRequest: 'error' });
seedMock();

try {
  const artifacts = await generateArtifacts(createCaller(BASE, fetch));
  const files: Array<[string, string]> = [
    ['openapi.yaml', artifacts.openapi],
    ['INVENTORY.md', artifacts.inventory],
    ['ERRORS.md', artifacts.errors],
  ];
  const stale: string[] = [];
  for (const [name, content] of files) {
    const path = resolve(root, name);
    if (check) {
      let committed = '';
      try {
        committed = readFileSync(path, 'utf8');
      } catch {
        // Missing counts as stale.
      }
      if (committed !== content) stale.push(`api/${name}`);
    } else {
      writeFileSync(path, content);
      console.log(`wrote api/${name}`);
    }
  }
  if (stale.length > 0) {
    console.error(
      `The API contract is out of date: ${stale.join(', ')}. Run \`npm run api:generate\` and commit the result.`,
    );
    process.exitCode = 1;
  } else if (check) {
    console.log('The API contract is up to date.');
  }
} finally {
  server.close();
}
