import { setupWorker } from 'msw/browser';
import { getEnv } from '@/app/env';
import { createHandlers } from './handlers';

const env = getEnv();

export const worker = setupWorker(...createHandlers(env.apiBaseUrl, { role: env.mockRole }));
