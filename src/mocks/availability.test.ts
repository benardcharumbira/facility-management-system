import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  createApiClient,
  type AvailabilityDay,
  type FacilityAvailability,
  type FacilitySummary,
} from '@/shared/api';
import { FIXED_NOW } from '@/test/clock';
import { computeAvailability } from './availability';
import { FACILITY_TIME_ZONE, buildLedger, type Ledger } from './data/bookingLedger';
import { REAL_FACILITIES } from './data/facilities.real';
import { server, TEST_API_BASE_URL } from './server';

const ZONE = FACILITY_TIME_ZONE;
const facility = (id: string) => {
  const found = REAL_FACILITIES.find((f) => f.id === id);
  if (!found) throw new Error(`No ${id}`);
  return found;
};

const ledger = buildLedger({ now: FIXED_NOW, startedAt: FIXED_NOW, catalogue: REAL_FACILITIES });
const day = (id: string, date: string, now = FIXED_NOW, l: Ledger = ledger): AvailabilityDay => {
  const result = computeAvailability({
    facility: facility(id),
    catalogue: REAL_FACILITIES,
    ledger: l,
    from: date,
    to: date,
    now,
  });
  const found = result.days[0];
  if (!found) throw new Error('no day');
  return found;
};
/** "HH:mm" in the facility zone, from a UTC instant. */
const local = (instant: string) => DateTime.fromISO(instant, { zone: ZONE }).toFormat('HH:mm');
const spans = (d: AvailabilityDay) =>
  d.segments.map((s) => `${s.status} ${local(s.startsAt)}-${local(s.endsAt)}`);

// With the clock fixed at Monday 2 November 2026: week 2 starts 16 November, week 4 on 30 November.
describe('availability engine: hierarchy', () => {
  it('blocks every child with the parent named when the parent is booked all day', () => {
    const parent = day('city-hall', '2026-11-20');
    expect(parent.status).toBe('fully_booked');
    expect(spans(parent)).toEqual(['booked 07:00-23:00']);

    for (const id of ['mitchell-wing', 'loch-wing', 'city-hall-committee-room']) {
      const child = day(id, '2026-11-20');
      expect(child.status, id).toBe('fully_booked');
      expect(child.segments).toHaveLength(1);
      expect(child.segments[0]).toMatchObject({
        status: 'blocked_by_related',
        relatedFacility: { id: 'city-hall', name: 'City Hall', relationship: 'parent' },
      });
    }
  });

  it('blocks the parent with the child named, and leaves unaffected siblings available', () => {
    expect(spans(day('mitchell-wing', '2026-11-19'))).toEqual(['booked 10:00-15:00']);

    const parent = day('city-hall', '2026-11-19');
    expect(parent.status).toBe('partially_booked');
    expect(spans(parent)).toEqual(['blocked_by_related 10:00-15:00']);
    expect(parent.segments[0]?.relatedFacility).toEqual({
      id: 'mitchell-wing',
      name: 'Mitchell Wing',
      relationship: 'child',
    });

    for (const id of ['loch-wing', 'city-hall-committee-room']) {
      const sibling = day(id, '2026-11-19');
      expect(sibling.status, id).toBe('available');
      expect(sibling.segments).toEqual([]);
    }
  });

  it('does not let a venue in another building affect anything', () => {
    expect(day('rothdene-hall', '2026-11-20').status).not.toBe('fully_booked');
    expect(day('council-chambers', '2026-11-20').segments).toEqual([]);
  });
});

describe('availability engine: buffers, holds and closures', () => {
  it('puts set-up the day before and clear-down the day after, distinct from the booking', () => {
    expect(spans(day('rothdene-hall', '2026-12-04'))).toEqual(['buffer 16:00-23:00']);
    expect(spans(day('rothdene-hall', '2026-12-05'))).toEqual([
      'buffer 07:00-10:00',
      'booked 10:00-16:00',
      'buffer 16:00-23:00',
    ]);
    expect(spans(day('rothdene-hall', '2026-12-06'))).toEqual(['buffer 07:00-10:00']);
  });

  it('holds a pending request until the hold expires, then releases it', () => {
    expect(spans(day('loch-wing', '2026-11-11'))).toEqual(['held 10:00-14:00']);
    const later = FIXED_NOW.plus({ hours: 4 });
    expect(day('loch-wing', '2026-11-11', later).segments).toEqual([]);
  });

  it('closes every venue on a public holiday, and one venue for maintenance, with different reasons', () => {
    for (const venue of REAL_FACILITIES) {
      expect(day(venue.id, '2026-12-16')).toMatchObject({
        status: 'closed',
        closedReason: 'Public holiday: Day of Reconciliation',
        opensAt: null,
        segments: [],
      });
    }
    expect(day('vaal-marina-hall', '2026-12-08')).toMatchObject({
      status: 'closed',
      closedReason: 'Maintenance',
    });
    // Maintenance on the hall does not close the board room that shares its site.
    expect(day('vaal-marina-board-room', '2026-12-08').status).not.toBe('closed');
  });

  it('observes a Sunday holiday on the Monday', () => {
    // Heritage Day, 24 September 2023, fell on a Sunday, so Monday 25 September was the holiday.
    const empty: Ledger = { bookings: [], blackouts: [] };
    const monday = day('rothdene-hall', '2023-09-25', FIXED_NOW, empty);
    expect(monday).toMatchObject({
      status: 'closed',
      closedReason: 'Public holiday: Heritage Day',
    });
    expect(day('rothdene-hall', '2023-09-26', FIXED_NOW, empty).status).toBe('available');
  });

  it('opens a weekend only venue on weekends and explains the weekdays', () => {
    expect(day('sicelo-hall', '2026-11-02')).toMatchObject({
      status: 'closed',
      closedReason: 'Not open on Mondays',
    });
    expect(day('sicelo-hall', '2026-11-07')).toMatchObject({ opensAt: '08:00', closesAt: '22:00' });
  });
});

describe('availability engine: range of data', () => {
  it('has a completely free week for every venue', () => {
    for (const venue of REAL_FACILITIES) {
      const week = computeAvailability({
        facility: venue,
        catalogue: REAL_FACILITIES,
        ledger,
        from: '2026-11-23',
        to: '2026-11-29',
        now: FIXED_NOW,
      });
      for (const d of week.days)
        expect(['available', 'closed'], `${venue.id} ${d.date}`).toContain(d.status);
    }
  });

  it('has a busy week with no free day', () => {
    const week = computeAvailability({
      facility: facility('vaal-marina-hall'),
      catalogue: REAL_FACILITIES,
      ledger,
      from: '2026-11-09',
      to: '2026-11-15',
      now: FIXED_NOW,
    });
    expect(week.days.map((d) => d.status)).not.toContain('available');
    expect(week.days.filter((d) => d.status === 'partially_booked').length).toBeGreaterThan(3);
  });
});

describe('availability engine: overlap resolution', () => {
  const booking = (id: string, from: string, to: string, extra: Record<string, unknown> = {}) => ({
    id,
    facilityId: 'rothdene-hall',
    startsAt: DateTime.fromISO(`2026-11-10T${from}`, { zone: ZONE }),
    endsAt: DateTime.fromISO(`2026-11-10T${to}`, { zone: ZONE }),
    status: 'approved' as const,
    holdExpiresAt: null,
    setupMinutes: 0,
    teardownMinutes: 0,
    ...extra,
  });
  const run = (bookings: ReturnType<typeof booking>[]) =>
    day('rothdene-hall', '2026-11-10', FIXED_NOW, { bookings, blackouts: [] });

  it('merges bookings that abut', () => {
    expect(spans(run([booking('a', '09:00', '10:00'), booking('b', '10:00', '11:00')]))).toEqual([
      'booked 09:00-11:00',
    ]);
  });

  it('lets a booking win where a buffer overlaps it, and never overlaps segments', () => {
    const d = run([
      booking('a', '09:00', '11:00', { teardownMinutes: 120 }),
      booking('b', '12:00', '13:00'),
    ]);
    expect(spans(d)).toEqual(['booked 09:00-11:00', 'buffer 11:00-12:00', 'booked 12:00-13:00']);
    for (let i = 1; i < d.segments.length; i += 1) {
      expect(d.segments[i]!.startsAt >= d.segments[i - 1]!.endsAt).toBe(true);
    }
  });

  it('classifies a fully covered day as fully booked and a partly covered one as partial', () => {
    expect(run([booking('a', '07:00', '23:00')]).status).toBe('fully_booked');
    expect(run([booking('a', '09:00', '10:00')]).status).toBe('partially_booked');
  });
});

describe('GET /facilities/:id/availability', () => {
  const client = createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => null });
  const get = (id: string, query: Record<string, string>) =>
    client.get<FacilityAvailability>(`/facilities/${id}/availability`, { query });

  it('returns UTC instants, the zone and the booking rules', async () => {
    const result = await get('city-hall', { from: '2026-11-20', to: '2026-11-20' });
    expect(result).toMatchObject({
      facilityId: 'city-hall',
      timeZone: 'Africa/Johannesburg',
      minimumNoticeHours: 48,
      maximumHorizonDays: 90,
      minimumDurationMinutes: 60,
    });
    expect(result.days[0]?.segments[0]).toMatchObject({
      startsAt: '2026-11-20T05:00:00Z',
      endsAt: '2026-11-20T21:00:00Z',
    });
  });

  it('accepts 62 days and refuses more, bad dates and unknown facilities', async () => {
    expect((await get('city-hall', { from: '2026-11-01', to: '2026-12-02' })).days).toHaveLength(
      32,
    );
    expect((await get('city-hall', { from: '2026-11-01', to: '2027-01-01' })).days).toHaveLength(
      62,
    );
    await expect(get('city-hall', { from: '2026-11-01', to: '2027-01-02' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(get('city-hall', { from: 'soon', to: '2026-11-01' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(get('city-hall', { from: '2026-11-05', to: '2026-11-01' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(get('nope', { from: '2026-11-01', to: '2026-11-02' })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('serves every venue', async () => {
    for (const venue of REAL_FACILITIES as FacilitySummary[]) {
      const result = await get(venue.id, { from: '2026-11-01', to: '2026-11-07' });
      expect(result.days).toHaveLength(7);
    }
    expect(server).toBeDefined();
  });
});
