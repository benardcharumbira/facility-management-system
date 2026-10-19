import { describe, expect, it } from 'vitest';
import {
  SLOT_CONFLICT_PROBLEM_TYPE,
  createApiClient,
  isApiProblem,
  type ApiProblem,
  type Booking,
  type BookingDocument,
  type BookingOptions,
  type FacilityAvailability,
  type SlotConflictExtensions,
} from '@/shared/api';
import { TERMS_VERSION } from './data/bookingOptions';
import { TEST_API_BASE_URL } from './server';

const api = createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => null });

// The test clock is Monday 2 November 2026. Tuesday 24 November is in the completely free week;
// 09:00 to 12:00 in Johannesburg is 07:00 to 10:00 UTC.
const FREE_SLOT = { startsAt: '2026-11-24T07:00:00Z', endsAt: '2026-11-24T10:00:00Z' };
// City Hall is booked all day on Friday 20 November, which blocks Mitchell Wing.
const CITY_HALL_DAY = { startsAt: '2026-11-20T07:00:00Z', endsAt: '2026-11-20T10:00:00Z' };

const create = (facilityId: string, slot = FREE_SLOT) =>
  api.post<Booking>('/bookings', { body: { facilityId, ...slot } });

async function completed(
  facilityId: string,
  slot = FREE_SLOT,
  extra: Record<string, unknown> = {},
) {
  const draft = await create(facilityId, slot);
  return api.patch<Booking>(`/bookings/${draft.id}`, {
    body: {
      eventTypeId: 'meeting',
      description: 'A community meeting',
      attendeeCount: 30,
      seatingArrangementId: 'cinema',
      resources: [{ resourceId: 'chairs', quantity: 30 }],
      acceptedTermsVersion: TERMS_VERSION,
      ...extra,
    },
  });
}

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

describe('GET /booking-options', () => {
  it('returns controlled lists, all fourteen kitchen resources, terms and upload rules', async () => {
    const options = await api.get<BookingOptions>('/booking-options');
    expect(options.eventTypes.length).toBeGreaterThan(3);
    expect(options.seatingArrangements.map((s) => s.name)).toEqual(
      expect.arrayContaining(['Cinema', 'Banquet', 'School room', 'U-shape']),
    );
    expect(options.resources.filter((r) => r.category === 'venue').map((r) => r.name)).toEqual([
      'Tables',
      'Chairs',
      'Stage',
      'Podium',
      'Sound system',
    ]);
    expect(options.resources.filter((r) => r.category === 'kitchen').map((r) => r.name)).toEqual([
      'Cups',
      'Teaspoons',
      'Sugar bowls',
      'Glasses',
      'Jugs',
      'Milk jugs',
      'Water jars',
      'Dining forks',
      'Urn',
      'Side plates',
      'Dinner plates',
      'Knives',
      'Forks',
      'Bowls',
    ]);
    expect(options.terms.version).toBe(TERMS_VERSION);
    expect(options.uploads.acceptedTypes.map((t) => t.label)).toEqual(
      expect.arrayContaining(['PDF', 'JPEG', 'PNG']),
    );
  });
});

describe('drafts', () => {
  it('creates a draft with an id and a reference, and loads it back', async () => {
    const draft = await create('rothdene-hall');
    expect(draft).toMatchObject({
      status: 'draft',
      facilityId: 'rothdene-hall',
      facility: { name: 'Rothdene Hall', timeZone: 'Africa/Johannesburg' },
      ...FREE_SLOT,
    });
    expect(draft.reference).toMatch(/^MVL-2026-\d{5}$/);
    expect(await api.get<Booking>(`/bookings/${draft.id}`)).toEqual(draft);
    expect((await failure(api.get('/bookings/nope'))).status).toBe(404);
  });

  it('updates partially without holding the slot', async () => {
    const draft = await create('rothdene-hall');
    const updated = await api.patch<Booking>(`/bookings/${draft.id}`, {
      body: { description: 'Quarterly meeting' },
    });
    expect(updated).toMatchObject({
      description: 'Quarterly meeting',
      eventTypeId: null,
      status: 'draft',
    });

    // A draft holds nothing: the same slot is still free for anyone.
    const availability = await api.get<FacilityAvailability>(
      '/facilities/rothdene-hall/availability',
      {
        query: { from: '2026-11-24', to: '2026-11-24' },
      },
    );
    expect(availability.days[0]?.segments).toEqual([]);
  });

  it('rejects malformed resources and unknown facilities with field errors', async () => {
    const draft = await create('rothdene-hall');
    const bad = await failure(
      api.patch(`/bookings/${draft.id}`, {
        body: { resources: [{ resourceId: 'chairs', quantity: 0 }] },
      }),
    );
    expect(bad).toMatchObject({ status: 422 });
    expect(bad.errors.resources).toBeDefined();
    expect((await failure(create('nope'))).errors.facilityId).toBeDefined();
  });
});

describe('documents', () => {
  const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);
  const upload = (id: string, f: File) => {
    const body = new FormData();
    body.set('file', f);
    return api.upload<BookingDocument>(`/bookings/${id}/documents`, body);
  };

  it('stores an accepted file, reports progress and deletes it', async () => {
    const draft = await create('rothdene-hall');
    const fractions: number[] = [];
    const body = new FormData();
    body.set('file', file('plan.pdf'));
    const stored = await api.upload<BookingDocument>(`/bookings/${draft.id}/documents`, body, {
      onProgress: (f) => fractions.push(f),
    });
    expect(stored).toMatchObject({ name: 'plan.pdf', contentType: 'application/pdf' });
    expect(fractions.at(-1)).toBe(1);
    expect((await api.get<Booking>(`/bookings/${draft.id}`)).documents).toHaveLength(1);

    await api.delete(`/bookings/${draft.id}/documents/${stored.id}`);
    expect((await api.get<Booking>(`/bookings/${draft.id}`)).documents).toHaveLength(0);
  });

  it('refuses an unaccepted type and an oversize file with a field error', async () => {
    const draft = await create('rothdene-hall');
    expect((await failure(upload(draft.id, file('virus.exe')))).errors.file?.[0]).toMatch(
      /not an accepted file type/,
    );
    const big = await failure(upload(draft.id, file('big.pdf', 11 * 1024 * 1024)));
    expect(big.errors.file?.[0]).toMatch(/larger than the size limit/);
  });

  it('fails an upload whose name contains "fail"', async () => {
    const draft = await create('rothdene-hall');
    expect(await failure(upload(draft.id, file('this-will-fail.pdf')))).toMatchObject({
      status: 500,
    });
  });
});

describe('submit', () => {
  it('sets Pending and holds the slot, which the calendar then shows as held', async () => {
    const draft = await completed('rothdene-hall');
    const submitted = await api.post<Booking>(`/bookings/${draft.id}/submit`);
    expect(submitted).toMatchObject({ status: 'pending', reference: draft.reference });
    expect(submitted.submittedAt).not.toBeNull();

    const availability = await api.get<FacilityAvailability>(
      '/facilities/rothdene-hall/availability',
      {
        query: { from: '2026-11-24', to: '2026-11-24' },
      },
    );
    expect(availability.days[0]?.segments).toEqual([
      {
        startsAt: FREE_SLOT.startsAt,
        endsAt: FREE_SLOT.endsAt,
        status: 'held',
        relatedFacility: null,
      },
    ]);
  });

  it('answers a lost race with a 409 slot conflict naming the window', async () => {
    const first = await completed('rothdene-hall');
    const second = await completed('rothdene-hall');
    await api.post(`/bookings/${first.id}/submit`);

    const conflict = await failure(api.post(`/bookings/${second.id}/submit`));
    expect(conflict).toMatchObject({ status: 409, type: SLOT_CONFLICT_PROBLEM_TYPE });
    const extensions = conflict.extensions as unknown as SlotConflictExtensions;
    expect(extensions.conflictingWindow).toEqual(FREE_SLOT);
    expect(extensions.relatedFacility).toBeUndefined();
    // The loser is still a draft, with every answer intact.
    expect(await api.get<Booking>(`/bookings/${second.id}`)).toMatchObject({
      status: 'draft',
      description: 'A community meeting',
    });
  });

  it('names the related facility when the hierarchy causes the conflict', async () => {
    const draft = await completed('mitchell-wing', CITY_HALL_DAY);
    const conflict = await failure(api.post(`/bookings/${draft.id}/submit`));
    const extensions = conflict.extensions as unknown as SlotConflictExtensions;
    expect(conflict.status).toBe(409);
    expect(extensions.relatedFacility).toEqual({
      id: 'city-hall',
      name: 'City Hall',
      relationship: 'parent',
    });
    expect(extensions.reason).toBe('City Hall is booked');
  });

  it('returns field level errors for incomplete or invalid answers', async () => {
    const empty = await create('rothdene-hall');
    const missing = await failure(api.post(`/bookings/${empty.id}/submit`));
    expect(missing.status).toBe(422);
    expect(Object.keys(missing.errors)).toEqual(
      expect.arrayContaining([
        'eventTypeId',
        'description',
        'attendeeCount',
        'seatingArrangementId',
        'termsAccepted',
      ]),
    );

    const rejected = await completed('rothdene-hall', FREE_SLOT, {
      description: 'Please [invalid]',
    });
    expect(
      (await failure(api.post(`/bookings/${rejected.id}/submit`))).errors.description,
    ).toBeDefined();

    const noTerms = await completed('rothdene-hall', FREE_SLOT, { acceptedTermsVersion: 'old' });
    expect(
      (await failure(api.post(`/bookings/${noTerms.id}/submit`))).errors.termsAccepted,
    ).toBeDefined();
  });

  it('is idempotent for a booking that is already pending', async () => {
    const draft = await completed('rothdene-hall');
    const once = await api.post<Booking>(`/bookings/${draft.id}/submit`);
    expect(await api.post<Booking>(`/bookings/${draft.id}/submit`)).toEqual(once);
  });

  it('refuses a window that has become invalid for another reason, as a conflict', async () => {
    // Inside the 48 hour minimum notice.
    const soon = await completed('rothdene-hall', {
      startsAt: '2026-11-03T07:00:00Z',
      endsAt: '2026-11-03T10:00:00Z',
    });
    expect(await failure(api.post(`/bookings/${soon.id}/submit`))).toMatchObject({
      status: 409,
      type: SLOT_CONFLICT_PROBLEM_TYPE,
    });
  });
});
