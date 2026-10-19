import { http, HttpResponse } from 'msw';
import { ROLES, type Role } from '@/shared/auth/roles';
import type { Paginated } from '@/shared/types/pagination';

interface MockFacility {
  id: string;
  name: string;
  type: string;
}

const FACILITY_TYPES = ['Community hall', 'Board room', 'Sports field', 'Court', 'Pool'];
const FACILITIES: MockFacility[] = Array.from({ length: 23 }, (_, index) => ({
  id: `facility-${index + 1}`,
  name: `Facility ${index + 1}`,
  type: FACILITY_TYPES[index % FACILITY_TYPES.length] ?? 'Open space',
}));

export interface HandlerOptions {
  /** Role returned by GET /me. */
  role?: Role;
}

export function createHandlers(baseUrl: string, { role = ROLES.applicant }: HandlerOptions = {}) {
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

    // Sample collection endpoint demonstrating the pagination envelope.
    http.get(`${root}/facilities`, ({ request }) => {
      const url = new URL(request.url);
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 10));
      const start = (page - 1) * pageSize;
      const body: Paginated<MockFacility> = {
        items: FACILITIES.slice(start, start + pageSize),
        page,
        pageSize,
        totalItems: FACILITIES.length,
        totalPages: Math.ceil(FACILITIES.length / pageSize),
      };
      return HttpResponse.json(body);
    }),
  ];
}
