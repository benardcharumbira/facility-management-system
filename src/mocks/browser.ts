import { setupWorker } from 'msw/browser';
import { getEnv } from '@/app/env';
import { createHandlers } from './handlers';
import type { MockScenario } from './facilities';

const env = getEnv();
const DEV_LATENCY_MS = 600;

/** `?mock=empty` or `?mock=error` on any page URL forces that API behaviour during review. */
function scenarioFromUrl(): MockScenario {
  const value = new URLSearchParams(window.location.search).get('mock');
  return value === 'empty' || value === 'error' ? value : undefined;
}

export const worker = setupWorker(
  ...createHandlers(env.apiBaseUrl, {
    role: env.mockRole,
    delayMs: DEV_LATENCY_MS,
    getScenario: scenarioFromUrl,
    dataset: env.mockDataset,
  }),
);
