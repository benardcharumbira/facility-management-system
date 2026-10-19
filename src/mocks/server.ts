import { setupServer } from 'msw/node';
import { createHandlers } from './handlers';

export const TEST_API_BASE_URL = 'http://localhost:5000/api';

export const server = setupServer(...createHandlers(TEST_API_BASE_URL));
