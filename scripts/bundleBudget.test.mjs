import { describe, expect, it } from 'vitest';
import { analyse, landingChunks, LANDING_KEY } from './bundleBudget.mjs';

const chunk = (file, imports = []) => ({ file, imports });

const manifest = () => ({
  'index.html': { ...chunk('assets/index.js', ['_vendor.js', '_shared.js']), isEntry: true },
  '_vendor.js': chunk('assets/vendor.js'),
  '_shared.js': chunk('assets/shared.js', ['_vendor.js']),
  [LANDING_KEY]: chunk('assets/landing.js', ['_shared.js']),
  'src/app/shell/AppShell.tsx': chunk('assets/shell.js', ['_vendor.js']),
  'src/features/bookings/pages/NewBookingPage.tsx': chunk('assets/booking.js'),
  'src/mocks/browser.ts': chunk('assets/browser.js'),
});

const KB = 1024;
const sizes = {
  'assets/index.js': 30 * KB,
  'assets/vendor.js': 100 * KB,
  'assets/shared.js': 10 * KB,
  'assets/landing.js': 2 * KB,
};
const bytes = (file) => sizes[file] ?? 999 * KB;

describe('the landing route bundle', () => {
  it('is the entry, what it imports, and the landing page', () => {
    expect(landingChunks(manifest()).sort()).toEqual(
      ['_shared.js', '_vendor.js', 'index.html', LANDING_KEY].sort(),
    );
  });

  it('adds up the transferred size and passes inside its budget', () => {
    const result = analyse(manifest(), bytes, 150 * KB);
    expect(result.total).toBe(142 * KB);
    expect(result.problems).toEqual([]);
  });

  it('fails over budget, saying by how much it was over', () => {
    const result = analyse(manifest(), bytes, 120 * KB);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatch(/142\.0 KB.*budget of 120\.0 KB/);
  });

  it.each([
    ['the signed in shell', 'src/app/shell/AppShell.tsx'],
    ['a feature’s pages', 'src/features/bookings/pages/NewBookingPage.tsx'],
    ['the mock API', 'src/mocks/browser.ts'],
  ])('fails if %s becomes part of what the landing page loads', (_name, key) => {
    const m = manifest();
    m['index.html'].imports.push(key);
    const result = analyse(m, bytes, 10_000 * KB);
    expect(result.forbidden).toEqual([key]);
    expect(result.problems[0]).toContain(key);
  });

  it('does not mind code that is loaded only by other routes', () => {
    expect(analyse(manifest(), bytes, 10_000 * KB).forbidden).toEqual([]);
  });

  it('refuses a build with no landing page chunk, rather than passing on nothing', () => {
    const m = manifest();
    delete m[LANDING_KEY];
    expect(() => analyse(m, bytes, KB)).toThrow(/landing page chunk/);
  });
});
