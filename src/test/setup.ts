import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { resetMockStores } from '@/mocks/data/reset';
import { server } from '@/mocks/server';
import { installContractChecks } from './contract';
import { resetClerk } from './clerk-mock';
import './clock';
import './viewport';

// The first render of a heavy page in a cold worker, with the whole suite running beside it, can
// exceed the 1000ms default.
configure({ asyncUtilTimeout: 6000 });

// jsdom lacks these browser APIs, which Radix primitives rely on.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

vi.mock('@clerk/react', () => import('./clerk-mock'));

const contract = installContractChecks(server);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => contract.reset());
afterEach(async () => {
  cleanup();
  server.resetHandlers();
  resetClerk();
  resetMockStores();
  // Last, so a broken contract fails the test without leaving the next one a mess to clear.
  await contract.assertClean();
});
afterAll(() => server.close());
