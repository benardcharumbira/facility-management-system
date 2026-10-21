/**
 * What a visitor to the landing page downloads, worked out from the build's manifest, and whether
 * that stays inside its budget and clear of the signed in application.
 *
 * The landing route loads the entry chunk, everything the entry imports statically, and the
 * landing page's own chunk with what that imports. It must not load the signed in shell, any
 * feature's pages or the mock API. Clerk's own script is fetched from Clerk at run time and is not
 * part of our bundle, so it is not counted here.
 */

/** The chunk the root route loads for a visitor who is not signed in. */
export const LANDING_KEY = 'src/features/public/pages/LandingPage.tsx';

/** Chunks a visitor to the landing page must never download. */
export const FORBIDDEN = [
  (key) => key === 'src/app/shell/AppShell.tsx',
  (key) => key.startsWith('src/features/') && !key.startsWith('src/features/public/'),
  (key) => key.startsWith('src/mocks/'),
  (key) => /msw/i.test(key),
];

export function entryKey(manifest) {
  const key = Object.keys(manifest).find((k) => manifest[k].isEntry && k.endsWith('index.html'));
  if (!key) throw new Error('The manifest has no entry for index.html.');
  return key;
}

/** The manifest keys the landing route loads, following static imports from the entry and the page. */
export function landingChunks(manifest) {
  const seen = new Set();
  const visit = (key) => {
    if (seen.has(key)) return;
    const chunk = manifest[key];
    if (!chunk) throw new Error(`The manifest has no chunk ${key}.`);
    seen.add(key);
    for (const child of chunk.imports ?? []) visit(child);
  };
  visit(entryKey(manifest));
  if (!manifest[LANDING_KEY])
    throw new Error(`The manifest has no landing page chunk (${LANDING_KEY}).`);
  visit(LANDING_KEY);
  return [...seen];
}

/**
 * @param manifest the parsed `.vite/manifest.json`
 * @param gzipBytes returns the transferred size of a built file, given its path in the manifest
 * @param budget the most gzipped JavaScript the landing route may transfer, in bytes
 */
export function analyse(manifest, gzipBytes, budget) {
  const keys = landingChunks(manifest);
  const files = keys
    .map((key) => ({ key, file: manifest[key].file, bytes: gzipBytes(manifest[key].file) }))
    .filter((chunk) => chunk.file.endsWith('.js'));
  const total = files.reduce((sum, chunk) => sum + chunk.bytes, 0);
  const forbidden = keys.filter((key) => FORBIDDEN.some((test) => test(key)));
  const problems = [];
  if (forbidden.length > 0) {
    problems.push(`The landing route would load code it must not: ${forbidden.join(', ')}.`);
  }
  if (total > budget) {
    problems.push(
      `The landing route transfers ${(total / 1024).toFixed(1)} KB of JavaScript (gzipped), over its budget of ${(budget / 1024).toFixed(1)} KB.`,
    );
  }
  return { files, total, forbidden, problems };
}
