import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACTION_NOT_ALLOWED_PROBLEM_TYPE,
  SLOT_CONFLICT_PROBLEM_TYPE,
  createApiClient,
  isApiProblem,
  type ApiProblem,
  type Booking,
  type BookingListItem,
  type BookingsSummary,
} from '@/shared/api';
import type { Paginated } from '@/shared/types/pagination';
import { FIXED_NOW } from '@/test/clock';
import { seedBookings } from './data/bookingSeeds';
import { bookingStore } from './data/bookingStore';
import { TEST_API_BASE_URL } from './server';

const api = createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => null });
const other = createApiClient({
  baseUrl: TEST_API_BASE_URL,
  getToken: async () => 'user:someone-else',
});

beforeEach(() => seedBookings(FIXED_NOW));

const list = (query: Record<string, string | number | string[]> = {}, client = api) =>
  client.get<Paginated<BookingListItem>>('/bookings', { query });
const ids = (page: Paginated<BookingListItem>) => page.items.map((b) => b.id);
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected a failure');
    },
    (error: unknown) => {
      if (!isApiProblem(error)) throw error;
      return error as ApiProblem;
    },
  );

describe('GET /bookings', () => {
  it('puts what needs attention first, then upcoming, then everything past or closed', async () => {
    const page = await list();
    expect(ids(page)).toEqual([
      'seed-draft',
      'seed-pending',
      'seed-approved-soon',
      'seed-approved',
      'seed-cancelled',
      'seed-rejected',
      'seed-past',
    ]);
    expect(page.items.map((b) => b.group)).toEqual([
      'attention',
      'attention',
      'upcoming',
      'upcoming',
      'closed',
      'closed',
      'closed',
    ]);
    expect(page).toMatchObject({ page: 1, totalItems: 7, totalPages: 1 });
    expect(page.items.find((b) => b.id === 'seed-past')?.isPast).toBe(true);
  });

  it("returns only the caller's bookings, decided by identity and never by a parameter", async () => {
    expect(ids(await list())).not.toContain('seed-other');
    expect(ids(await list({}, other))).toEqual(['seed-other']);
    // A user parameter is ignored: it is not how the caller is known.
    expect(ids(await list({ userId: 'someone-else', ownerId: 'someone-else' }))).not.toContain(
      'seed-other',
    );
  });

  it('filters by status, event date, facility and text', async () => {
    expect(ids(await list({ status: ['draft', 'pending'] }))).toEqual([
      'seed-draft',
      'seed-pending',
    ]);
    expect(ids(await list({ facilityId: ['rothdene-hall'] }))).toEqual([
      'seed-draft',
      'seed-approved',
      'seed-past',
    ]);

    // Event dates are in the facility zone and inclusive. Today is Monday 2 November.
    expect(ids(await list({ from: '2026-11-02', to: '2026-11-04' }))).toEqual([
      'seed-approved-soon',
    ]);
    expect(ids(await list({ from: '2026-11-30', to: '2026-11-30' }))).toEqual(['seed-approved']);

    expect(ids(await list({ q: 'workshop' }))).toEqual(['seed-approved']);
    expect(ids(await list({ q: 'lakeside' }))).toEqual(['seed-pending', 'seed-cancelled']);
    expect(ids(await list({ q: 'MVL-2026-9003' }))).toEqual(['seed-approved-soon']);
    expect(ids(await list({ q: 'lakeside postponed' }))).toEqual([]);
  });

  it('sorts by event date, submission date and status', async () => {
    expect(ids(await list({ sort: 'eventDate' }))).toEqual([
      'seed-past',
      'seed-approved-soon',
      'seed-rejected',
      'seed-pending',
      'seed-draft',
      'seed-approved',
      'seed-cancelled',
    ]);
    expect(ids(await list({ sort: '-eventDate' }))[0]).toBe('seed-cancelled');
    expect(ids(await list({ sort: 'status' })).slice(0, 3)).toEqual([
      'seed-draft',
      'seed-pending',
      'seed-past',
    ]);
    // The draft was never submitted, so it sorts last by submission date either way round.
    expect(ids(await list({ sort: 'submitted' })).at(-1)).toBe('seed-draft');
  });

  it('uses the standard envelope and paginates', async () => {
    const first = await list({ pageSize: 3 });
    const last = await list({ pageSize: 3, page: 3 });
    expect(first).toMatchObject({ page: 1, pageSize: 3, totalItems: 7, totalPages: 3 });
    expect(first.items).toHaveLength(3);
    expect(last.items).toHaveLength(1);
  });

  it('rejects bad parameters with problem details', async () => {
    expect((await failure(list({ sort: 'newest' }))).status).toBe(400);
    expect((await failure(list({ status: ['archived'] }))).status).toBe(400);
    expect((await failure(list({ from: 'yesterday' }))).status).toBe(400);
  });
});

describe('GET /bookings/summary', () => {
  it('counts by group, following the filters, and lists facilities unfiltered', async () => {
    const all = await api.get<BookingsSummary>('/bookings/summary');
    expect(all).toMatchObject({ overall: 7, matching: { attention: 2, upcoming: 2, closed: 3 } });
    expect(all.facilities.map((f) => f.name)).toEqual([
      'Activity Room',
      'Lakeside Hall',
      'Rothdene Hall',
      'Vaal Marina Hall',
    ]);

    const approved = await api.get<BookingsSummary>('/bookings/summary', {
      query: { status: ['approved'] },
    });
    expect(approved).toMatchObject({
      overall: 7,
      matching: { attention: 0, upcoming: 2, closed: 1 },
    });
  });

  it('is empty for an applicant with no bookings', async () => {
    const nobody = createApiClient({
      baseUrl: TEST_API_BASE_URL,
      getToken: async () => 'user:nobody',
    });
    expect(await nobody.get<BookingsSummary>('/bookings/summary')).toEqual({
      overall: 0,
      matching: { attention: 0, upcoming: 0, closed: 0 },
      facilities: [],
    });
    expect((await list({}, nobody)).items).toEqual([]);
  });
});

describe('GET /bookings/:id', () => {
  it('returns detail with history, and the reason a rejection was given in full', async () => {
    const rejected = await api.get<Booking>('/bookings/seed-rejected');
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toMatch(/reserved for a municipal event/);
    expect(rejected.rejectionReason?.length).toBeGreaterThan(200);
    expect(rejected.history.map((h) => h.type)).toEqual(['created', 'submitted', 'rejected']);
    expect(rejected.actions).toEqual({
      cancel: { allowed: false, blockedReason: null },
      reschedule: { allowed: false, blockedReason: null },
    });
  });

  it('computes what the caller may do, and says why when not', async () => {
    const pending = await api.get<Booking>('/bookings/seed-pending');
    expect(pending.actions.cancel.allowed).toBe(true);
    expect(pending.holdExpiresAt).not.toBeNull();

    const approved = await api.get<Booking>('/bookings/seed-approved');
    expect(approved.actions.cancel.allowed).toBe(true);
    expect(approved.actions.reschedule).toMatchObject({
      allowed: false,
      blockedReason: expect.stringMatching(/already been requested/),
    });
    expect(approved.rescheduleRequest?.status).toBe('pending');

    const soon = await api.get<Booking>('/bookings/seed-approved-soon');
    expect(soon.actions.cancel.allowed).toBe(false);
    expect(soon.actions.cancel.blockedReason).toMatch(/less than 72 hours/);
  });

  it("answers 404, not 403, for another applicant's booking", async () => {
    const problem = await failure(api.get('/bookings/seed-other'));
    expect(problem).toMatchObject({ status: 404, title: 'Booking not found' });
    expect((await failure(api.post('/bookings/seed-other/cancel', { body: {} }))).status).toBe(404);
    expect((await failure(api.delete('/bookings/seed-other'))).status).toBe(404);
    // And it is the same answer as for an identifier that does not exist at all.
    expect((await failure(api.get('/bookings/nothing-here'))).status).toBe(404);
  });
});

describe('cancel', () => {
  it('cancels a pending request, records it and releases the hold', async () => {
    const before = await api.get<{ days: Array<{ segments: Array<{ status: string }> }> }>(
      '/facilities/lakeside-hall/availability',
      { query: { from: '2026-11-16', to: '2026-11-16' } },
    );
    expect(before.days[0]?.segments.some((s) => s.status === 'held')).toBe(true);

    const cancelled = await api.post<Booking>('/bookings/seed-pending/cancel', {
      body: { reason: 'Changed plans' },
    });
    expect(cancelled).toMatchObject({
      status: 'cancelled',
      holdExpiresAt: null,
      cancellation: { cancelledBy: 'applicant', reason: 'Changed plans' },
    });
    expect(cancelled.history.at(-1)).toMatchObject({
      type: 'cancelled',
      actor: 'applicant',
      note: 'Changed plans',
    });

    const after = await api.get<{ days: Array<{ segments: Array<{ status: string }> }> }>(
      '/facilities/lakeside-hall/availability',
      { query: { from: '2026-11-16', to: '2026-11-16' } },
    );
    expect(after.days[0]?.segments.some((s) => s.status === 'held')).toBe(false);
  });

  it('refuses an approved booking that is too close to its event, and changes nothing', async () => {
    const problem = await failure(api.post('/bookings/seed-approved-soon/cancel', { body: {} }));
    expect(problem).toMatchObject({ status: 409, type: ACTION_NOT_ALLOWED_PROBLEM_TYPE });
    expect(problem.detail).toMatch(/less than 72 hours/);
    expect((await api.get<Booking>('/bookings/seed-approved-soon')).status).toBe('approved');
  });

  it('cancels an approved booking far enough ahead, with the reason optional', async () => {
    const cancelled = await api.post<Booking>('/bookings/seed-approved/cancel', { body: {} });
    expect(cancelled).toMatchObject({
      status: 'cancelled',
      cancellation: { reason: null },
      rescheduleRequest: null,
    });
  });

  it('will not cancel a booking that is already closed', async () => {
    expect((await failure(api.post('/bookings/seed-rejected/cancel', { body: {} }))).status).toBe(
      409,
    );
    expect((await failure(api.post('/bookings/seed-draft/cancel', { body: {} }))).status).toBe(409);
  });
});

describe('reschedule', () => {
  const clearRequest = () => {
    const booking = bookingStore.get('seed-approved', 'mock-user-1');
    if (booking) bookingStore.update({ ...booking, rescheduleRequest: null });
  };

  it('creates a request and leaves the booking approved on its original window', async () => {
    clearRequest();
    const original = await api.get<Booking>('/bookings/seed-approved');
    const result = await api.post<Booking>('/bookings/seed-approved/reschedule', {
      body: { startsAt: '2026-11-24T07:00:00Z', endsAt: '2026-11-24T10:00:00Z' },
    });
    expect(result.status).toBe('approved');
    expect(result.startsAt).toBe(original.startsAt);
    expect(result.endsAt).toBe(original.endsAt);
    expect(result.rescheduleRequest).toMatchObject({
      status: 'pending',
      proposedStartsAt: '2026-11-24T07:00:00Z',
      proposedEndsAt: '2026-11-24T10:00:00Z',
    });
    expect(result.history.at(-1)?.type).toBe('reschedule_requested');
    expect(result.actions.reschedule.allowed).toBe(false);
    expect(
      (await list({ status: ['approved'] })).items.find((b) => b.id === 'seed-approved')
        ?.hasPendingReschedule,
    ).toBe(true);
  });

  it("treats the booking's own time as free when it asks to move a little", async () => {
    clearRequest();
    const result = await api.post<Booking>('/bookings/seed-approved/reschedule', {
      body: { startsAt: '2026-11-30T07:00:00Z', endsAt: '2026-11-30T11:00:00Z' },
    });
    expect(result.rescheduleRequest).not.toBeNull();
  });

  it('answers a taken proposal with a slot conflict', async () => {
    clearRequest();
    const problem = await failure(
      api.post('/bookings/seed-approved/reschedule', {
        // Rothdene Hall is fully booked, with set-up and clear-down, on Saturday 5 December.
        body: { startsAt: '2026-12-05T07:00:00Z', endsAt: '2026-12-05T10:00:00Z' },
      }),
    );
    expect(problem).toMatchObject({ status: 409, type: SLOT_CONFLICT_PROBLEM_TYPE });
  });

  it('is refused while a request is open, when too close, and for anything not approved', async () => {
    const body = { startsAt: '2026-11-24T07:00:00Z', endsAt: '2026-11-24T10:00:00Z' };
    expect((await failure(api.post('/bookings/seed-approved/reschedule', { body }))).type).toBe(
      ACTION_NOT_ALLOWED_PROBLEM_TYPE,
    );
    expect(
      (await failure(api.post('/bookings/seed-approved-soon/reschedule', { body }))).status,
    ).toBe(409);
    expect((await failure(api.post('/bookings/seed-pending/reschedule', { body }))).status).toBe(
      409,
    );
  });
});

describe('delete and download', () => {
  it('deletes a draft and refuses anything else', async () => {
    await api.delete('/bookings/seed-draft');
    expect((await failure(api.get('/bookings/seed-draft'))).status).toBe(404);
    expect((await failure(api.delete('/bookings/seed-pending'))).status).toBe(409);
  });

  it('downloads a document, only for the owner', async () => {
    const blob = await api.download('/bookings/seed-approved/documents/doc-1-programme.pdf');
    expect(await blob.text()).toBe('Mock contents of programme.pdf');
    expect(
      (await failure(other.download('/bookings/seed-approved/documents/doc-1-programme.pdf')))
        .status,
    ).toBe(404);
  });
});
