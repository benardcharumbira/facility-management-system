import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { resetBookingStore } from '@/mocks/data/bookingStore';
import { resetFacilityStore } from '@/mocks/data/facilityStore';
import { server } from '@/mocks/server';
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

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetClerk();
  resetBookingStore();
  resetFacilityStore();
});
afterAll(() => server.close());
