import { http, HttpResponse } from 'msw';
import { ROLES, type Role } from '@/shared/auth/roles';
import { createFacilityHandlers, type MockScenario } from './facilities';

export interface HandlerOptions {
  /** Role returned by GET /me. */
  role?: Role;
  /** Artificial latency so loading states are visible. */
  delayMs?: number;
  getScenario?: () => MockScenario;
}

export function createHandlers(
  baseUrl: string,
  { role = ROLES.applicant, delayMs = 0, getScenario }: HandlerOptions = {},
) {
  const root = baseUrl.replace(/\/+$/, '');

  return [
    http.get(`${root}/me`, () =>
      HttpResponse.json({
        id: 'mock-user-1',
        email: 'mock.user@example.org',
        displayName: 'Mock User',
        role,
      }),
    ),

    ...createFacilityHandlers(root, { delayMs, getScenario }),
  ];
}
