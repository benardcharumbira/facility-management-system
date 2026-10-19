import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from '@/mocks/server';
import { resetClerk } from './clerk-mock';
import './viewport';

vi.mock('@clerk/react', () => import('./clerk-mock'));

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetClerk();
});
afterAll(() => server.close());
