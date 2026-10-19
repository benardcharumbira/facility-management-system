import { DateTime } from 'luxon';
import { http, HttpResponse } from 'msw';
import { ROLES, type Role } from '@/shared/auth/roles';
import { seedBookings } from './data/bookingSeeds';
import { createFacilityHandlers, type MockDatasetName, type MockScenario } from './facilities';

export interface HandlerOptions {
  /** Role returned by GET /me. */
  role?: Role;
  /** Artificial latency so loading states are visible. */
  delayMs?: number;
  getScenario?: () => MockScenario;
  /** Which facilities fixture to serve (default: the confirmed Midvaal venues). */
  dataset?: MockDatasetName;
  now?: () => DateTime;
  /** Fill the mock applicant's bookings with samples in every state (development). */
  seedBookings?: boolean;
}

export function createHandlers(
  baseUrl: string,
  {
    role = ROLES.applicant,
    delayMs = 0,
    getScenario,
    dataset,
    now,
    seedBookings: seed,
  }: HandlerOptions = {},
) {
  const root = baseUrl.replace(/\/+$/, '');
  if (seed) seedBookings(now?.() ?? DateTime.now());

  return [
    http.get(`${root}/me`, () =>
      HttpResponse.json({
        id: 'mock-user-1',
        email: 'mock.user@example.org',
        displayName: 'Mock User',
        role,
      }),
    ),

    ...createFacilityHandlers(root, { delayMs, getScenario, dataset, now }),
  ];
}
