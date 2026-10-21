import { DateTime } from 'luxon';
import { sendsInvalidRequests } from '@/test/contract';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createApiClient,
  isApiProblem,
  type AdminFacility,
  type ApiProblem,
  type ApprovalDetail,
  type ApprovalListItem,
  type Booking,
  type FacilityAvailability,
  type ImpactResult,
} from '@/shared/api';
import type { Paginated } from '@/shared/types/pagination';
import { FIXED_NOW } from '@/test/clock';
import { seedFacilityAdmin, seedSpanRequests } from './data/facilityAdminSeeds';
import { TERMS_VERSION } from './data/bookingOptions';
import { TEST_API_BASE_URL } from './server';

const ZONE = 'Africa/Johannesburg';
const as = (token: string | null) =>
  createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => token });
const applicant = as(null);
const admin = as('user:mock-approver-1');
const vaalApprover = as('user:approver-vaal');

beforeEach(() => {
  seedFacilityAdmin(FIXED_NOW);
  seedSpanRequests(FIXED_NOW);
});

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

/** A local moment in the facility zone as a UTC instant. */
const at = (date: string, time: string) =>
  DateTime.fromISO(`${date}T${time}`, { zone: ZONE })
    .toUTC()
    .toISO({ suppressMilliseconds: true }) as string;

async function spanBooking(
  facilityId: string,
  from: [string, string],
  to: [string, string],
  extra = {},
) {
  const draft = await applicant.post<Booking>('/bookings', {
    body: { facilityId, startsAt: at(...from), endsAt: at(...to) },
  });
  await applicant.patch(`/bookings/${draft.id}`, {
    body: {
      eventTypeId: 'meeting',
      description: 'A wedding weekend',
      attendeeCount: 30,
      seatingArrangementId: 'cinema',
      resources: [],
      acceptedTermsVersion: TERMS_VERSION,
      ...extra,
    },
  });
  return draft;
}
const submit = (id: string) => applicant.post<Booking>(`/bookings/${id}/submit`);
const availability = (id: string, from: string, to: string, client = applicant) =>
  client.get<FacilityAvailability>(`/facilities/${id}/availability`, { query: { from, to } });

describe('what the model already held', () => {
  it('stores a span as two instants, with one reference and one status', async () => {
    const draft = await spanBooking(
      'lakeside-hall',
      ['2026-11-27', '14:00'],
      ['2026-11-29', '12:00'],
    );
    const pending = await submit(draft.id);
    expect(pending).toMatchObject({
      status: 'pending',
      reference: draft.reference,
      startsAt: at('2026-11-27', '14:00'),
      endsAt: at('2026-11-29', '12:00'),
    });
    expect(Object.keys(pending)).not.toContain('occurrences');
  });

  it('tells the client how many days a booking may cover', async () => {
    const result = await availability('lakeside-hall', '2026-11-27', '2026-11-29');
    expect(result.maximumBookingDays).toBe(7);
  });
});

describe('an available span', () => {
  it('is accepted when every day of it is free, including a Sunday', async () => {
    const draft = await spanBooking(
      'lakeside-hall',
      ['2026-11-27', '14:00'],
      ['2026-11-29', '12:00'],
    );
    expect((await submit(draft.id)).status).toBe('pending');
  });

  it('then holds every day of it, as one block continuing across them', async () => {
    const draft = await spanBooking(
      'lakeside-hall',
      ['2026-11-27', '14:00'],
      ['2026-11-29', '12:00'],
    );
    await submit(draft.id);
    const [fri, sat, sun] = (await availability('lakeside-hall', '2026-11-27', '2026-11-29')).days;
    expect(fri?.segments[0]).toMatchObject({ status: 'held', continuesAfter: true });
    expect(fri?.segments[0]?.continuesBefore).toBeUndefined();
    expect(sat).toMatchObject({ status: 'fully_booked' });
    expect(sat?.segments).toHaveLength(1);
    expect(sat?.segments[0]).toMatchObject({
      status: 'held',
      continuesBefore: true,
      continuesAfter: true,
    });
    expect(sun?.segments[0]).toMatchObject({ status: 'held', continuesBefore: true });
    expect(sun?.segments[0]?.continuesAfter).toBeUndefined();
  });
});

describe('a span with an unavailable day in the middle', () => {
  it('is refused, naming the day, the reason and the related facility', async () => {
    // City Hall is booked all day on Friday 20 November, which blocks its wing.
    const draft = await spanBooking(
      'mitchell-wing',
      ['2026-11-19', '16:00'],
      ['2026-11-21', '12:00'],
    );
    const refused = await failure(submit(draft.id));
    expect(refused.status).toBe(409);
    expect(refused.detail).toContain('Friday 20 November is not free');
    expect(refused.detail).toContain('City Hall is booked');
    expect(refused.extensions).toMatchObject({ relatedFacility: { name: 'City Hall' } });
  });

  it('is refused, though neither end touches the booked day', async () => {
    const draft = await spanBooking(
      'mitchell-wing',
      ['2026-11-19', '16:00'],
      ['2026-11-21', '12:00'],
    );
    const refused = await failure(submit(draft.id));
    expect(refused.extensions?.conflictingWindow).toBeDefined();
    expect((await applicant.get<Booking>(`/bookings/${draft.id}`)).status).toBe('draft');
  });
});

describe('a span across a day the venue is closed', () => {
  it('is accepted: days inside a span are occupied in full, whatever the hours', async () => {
    // The committee room opens on weekdays only.
    const draft = await spanBooking(
      'city-hall-committee-room',
      ['2026-11-27', '14:00'],
      ['2026-11-30', '12:00'],
      { seatingArrangementId: 'boardroom', attendeeCount: 10 },
    );
    expect((await submit(draft.id)).status).toBe('pending');
  });

  it('then occupies its closed Saturday and Sunday in full, and blocks its parent for them', async () => {
    const draft = await spanBooking(
      'city-hall-committee-room',
      ['2026-11-27', '14:00'],
      ['2026-11-30', '12:00'],
      { seatingArrangementId: 'boardroom', attendeeCount: 10 },
    );
    await submit(draft.id);
    const room = await availability('city-hall-committee-room', '2026-11-28', '2026-11-29');
    for (const day of room.days) {
      expect(day).toMatchObject({ status: 'fully_booked', closedBy: 'schedule', opensAt: null });
      expect(day.segments).toHaveLength(1);
      expect(day.segments[0]).toMatchObject({
        status: 'held',
        continuesBefore: true,
        continuesAfter: true,
      });
    }
    const hall = await availability('city-hall', '2026-11-28', '2026-11-28');
    expect(hall.days[0]?.segments[0]).toMatchObject({
      status: 'blocked_by_related',
      relatedFacility: { id: 'city-hall-committee-room', relationship: 'child' },
    });
  });

  it('cannot start or end on a day the venue is closed', async () => {
    const starts = await spanBooking(
      'city-hall-committee-room',
      ['2026-11-28', '10:00'],
      ['2026-11-30', '12:00'],
    );
    expect((await failure(submit(starts.id))).detail).toMatch(
      /Saturday 28 November is closed.*cannot start/,
    );
    const ends = await spanBooking(
      'city-hall-committee-room',
      ['2026-11-26', '10:00'],
      ['2026-11-28', '12:00'],
    );
    expect((await failure(submit(ends.id))).detail).toMatch(
      /Saturday 28 November is closed.*cannot end/,
    );
  });

  it('still binds the start and the end to the opening hours', async () => {
    const late = await spanBooking(
      'city-hall-committee-room',
      ['2026-11-27', '17:00'],
      ['2026-11-30', '12:00'],
    );
    expect((await failure(submit(late.id))).detail).toMatch(
      /open 08:00 to 16:30 on Friday 27 November.*start/,
    );
  });
});

describe('a span across a blackout', () => {
  it('is refused, naming the day and the reason', async () => {
    // Vaal Marina Hall is closed for maintenance on Tuesday 8 and Wednesday 9 December.
    const draft = await spanBooking(
      'vaal-marina-hall',
      ['2026-12-07', '10:00'],
      ['2026-12-10', '12:00'],
    );
    const refused = await failure(submit(draft.id));
    expect(refused.detail).toContain('Tuesday 8 December is closed: Maintenance');
    expect(refused.detail).toContain('cannot run across a closure');
  });

  it('is refused for a blackout set in administration, too', async () => {
    const day = (d: string) => at(d, '00:00');
    await admin.post('/admin/facilities/lakeside-hall/blackouts', {
      body: {
        startsAt: day('2026-11-28'),
        endsAt: day('2026-11-29'),
        allDay: true,
        reason: 'Floor repairs',
      },
    });
    const draft = await spanBooking(
      'lakeside-hall',
      ['2026-11-27', '14:00'],
      ['2026-11-29', '12:00'],
    );
    expect((await failure(submit(draft.id))).detail).toContain(
      'Saturday 28 November is closed: Floor repairs',
    );
  });
});

describe('the limit on a span', () => {
  it('refuses one longer than the facility allows, stating the limit', async () => {
    const draft = await spanBooking(
      'lakeside-hall',
      ['2026-11-23', '10:00'],
      ['2026-12-01', '12:00'],
    );
    const refused = await failure(submit(draft.id));
    expect(refused.detail).toContain('at most 7 days');
    expect(refused.detail).toContain('Yours covers 9');
  });

  it('follows the facility’s own setting, set in administration', async () => {
    const facility = await admin.get<AdminFacility>('/admin/facilities/lakeside-hall');
    await admin.put('/admin/facilities/lakeside-hall/schedule', {
      body: { ...facility.schedule, maximumBookingDays: 2 },
    });
    const draft = await spanBooking(
      'lakeside-hall',
      ['2026-11-27', '14:00'],
      ['2026-11-29', '12:00'],
    );
    expect((await failure(submit(draft.id))).detail).toContain('at most 2 days. Yours covers 3');
    expect(
      (await availability('lakeside-hall', '2026-11-27', '2026-11-27')).maximumBookingDays,
    ).toBe(2);
  });

  it('says plainly that a venue takes single day bookings only when its limit is 1', async () => {
    const facility = await admin.get<AdminFacility>('/admin/facilities/lakeside-hall');
    await admin.put('/admin/facilities/lakeside-hall/schedule', {
      body: { ...facility.schedule, maximumBookingDays: 1 },
    });
    const draft = await spanBooking(
      'lakeside-hall',
      ['2026-11-27', '14:00'],
      ['2026-11-28', '12:00'],
    );
    expect((await failure(submit(draft.id))).detail).toContain('within a single day');
  });

  it('is set in the schedule, whole and at least 1', async () => {
    sendsInvalidRequests();
    const facility = await admin.get<AdminFacility>('/admin/facilities/lakeside-hall');
    for (const maximumBookingDays of [0, 1.5, 400]) {
      const refused = await failure(
        admin.put('/admin/facilities/lakeside-hall/schedule', {
          body: { ...facility.schedule, maximumBookingDays },
        }),
      );
      expect(refused.errors.maximumBookingDays).toBeDefined();
    }
  });

  it('starts at a week for a new facility', async () => {
    const created = await admin.post<AdminFacility>('/admin/facilities', {
      body: {
        name: 'Annex',
        code: 'ANX',
        typeId: 'committee-room',
        locality: 'Meyerton',
        shortDescription: 'A room.',
        description: '',
        parentFacilityId: null,
      },
    });
    expect(created.schedule.maximumBookingDays).toBe(7);
  });
});

describe('set-up and clear-down time', () => {
  it('sit at the outer edges of a span, never between its days', async () => {
    const facility = await admin.get<AdminFacility>('/admin/facilities/lakeside-hall');
    await admin.put('/admin/facilities/lakeside-hall/schedule', {
      body: { ...facility.schedule, setupMinutes: 60, teardownMinutes: 60 },
    });
    const draft = await spanBooking(
      'lakeside-hall',
      ['2026-11-27', '14:00'],
      ['2026-11-29', '12:00'],
    );
    await submit(draft.id);
    const [fri, sat, sun] = (await availability('lakeside-hall', '2026-11-27', '2026-11-29')).days;
    const shape = (d: typeof fri) =>
      d?.segments.map(
        (s) =>
          `${s.status} ${DateTime.fromISO(s.startsAt, { zone: ZONE }).toFormat('HH:mm')}-${DateTime.fromISO(s.endsAt, { zone: ZONE }).toFormat('HH:mm')}`,
      );
    expect(shape(fri)).toEqual(['buffer 13:00-14:00', 'held 14:00-23:00']);
    expect(shape(sat)).toEqual(['held 07:00-23:00']);
    expect(shape(sun)).toEqual(['held 07:00-12:00', 'buffer 12:00-13:00']);
  });

  it('are one block with the booking they belong to: no moment is blocked twice', async () => {
    const facility = await admin.get<AdminFacility>('/admin/facilities/lakeside-hall');
    await admin.put('/admin/facilities/lakeside-hall/schedule', {
      body: { ...facility.schedule, setupMinutes: 1080, teardownMinutes: 0 },
    });
    // From Friday 09:00 with an 18 hour set-up, which reaches back into Thursday afternoon.
    const draft = await spanBooking(
      'lakeside-hall',
      ['2026-11-27', '09:00'],
      ['2026-11-28', '12:00'],
    );
    await submit(draft.id);
    const days = (await availability('lakeside-hall', '2026-11-26', '2026-11-28')).days;
    const [thu, fri, sat] = days;
    expect(thu?.segments.map((s) => s.status)).toEqual(['buffer']);
    expect(fri?.segments.map((s) => s.status)).toEqual(['buffer', 'held']);
    expect(sat?.segments.map((s) => s.status)).toEqual(['held']);
    // Every segment on every day abuts the next without overlapping it.
    for (const day of days) {
      day.segments.forEach((seg, i) => {
        const next = day.segments[i + 1];
        if (next) expect(Date.parse(seg.endsAt)).toBeLessThanOrEqual(Date.parse(next.startsAt));
      });
    }
  });
});

describe('a span competing with another request', () => {
  it('is listed against a single day request in the middle of it, and the other way round', async () => {
    const list = await vaalApprover.get<Paginated<ApprovalListItem>>('/approvals', {
      query: { pageSize: 50 },
    });
    const span = list.items.find((i) => i.reference.endsWith('9302'));
    const single = list.items.find((i) => i.reference.endsWith('9303'));
    expect(span && single).toBeTruthy();
    const spanDetail = await vaalApprover.get<ApprovalDetail>(`/approvals/${span?.id}`);
    const singleDetail = await vaalApprover.get<ApprovalDetail>(`/approvals/${single?.id}`);
    expect(spanDetail.context.competingRequests.map((c) => c.reference)).toContain(
      single?.reference,
    );
    expect(singleDetail.context.competingRequests.map((c) => c.reference)).toContain(
      span?.reference,
    );
  });

  it('is one work item: one reference and one decision', async () => {
    const list = await vaalApprover.get<Paginated<ApprovalListItem>>('/approvals', {
      query: { pageSize: 50 },
    });
    const span = list.items.find((i) => i.reference.endsWith('9302'));
    expect(list.items.filter((i) => i.reference.endsWith('9302'))).toHaveLength(1);
    const approved = await vaalApprover.post<ApprovalDetail>(`/bookings/${span?.id}/approve`, {
      body: {},
    });
    expect(approved.status).toBe('approved');
  });
});

describe('an approved span', () => {
  it('is one block across the days it covers', async () => {
    const [fri, sat, sun] = (await availability('rothdene-hall', '2027-01-08', '2027-01-10')).days;
    expect(fri?.segments.at(-1)).toMatchObject({ status: 'booked', continuesAfter: true });
    expect(sat?.segments).toHaveLength(1);
    expect(sat?.segments[0]).toMatchObject({
      status: 'booked',
      continuesBefore: true,
      continuesAfter: true,
    });
    expect(sun?.segments[0]).toMatchObject({ status: 'booked', continuesBefore: true });
  });

  it('is seen from the related facility, as the same continuous stretch', async () => {
    // The committee room's approved weekend span in the ledger, seen from City Hall.
    const hall = await availability('city-hall', '2026-12-19', '2026-12-20');
    for (const day of hall.days) {
      expect(day.segments[0]).toMatchObject({
        status: 'blocked_by_related',
        relatedFacility: { name: 'City Hall Committee Room' },
        continuesBefore: true,
        continuesAfter: true,
      });
    }
  });
});

describe('the impact of a closure on a span', () => {
  const closure = (date: string) => ({
    kind: 'blackout',
    blackout: {
      startsAt: at(date, '00:00'),
      endsAt: at(DateTime.fromISO(date).plus({ days: 1 }).toISODate() ?? '', '00:00'),
      allDay: true,
      reason: 'Maintenance',
    },
  });

  it('reports the whole booking when a closure touches one day of it, naming the day', async () => {
    const result = await admin.post<ImpactResult>('/admin/facilities/rothdene-hall/impact', {
      body: closure('2027-01-09'),
    });
    const wedding = result.affectedBookings.find((b) => b.reference.endsWith('9301'));
    expect(wedding).toMatchObject({ reason: 'inside_blackout', day: '2027-01-09' });
    expect(result.affectedBookings.filter((b) => b.reference.endsWith('9301'))).toHaveLength(1);
  });

  it('names the first day the closure reaches, when it reaches several', async () => {
    const result = await admin.post<ImpactResult>('/admin/facilities/rothdene-hall/impact', {
      body: {
        kind: 'blackout',
        blackout: {
          startsAt: at('2027-01-09', '00:00'),
          endsAt: at('2027-01-12', '00:00'),
          allDay: true,
          reason: 'Maintenance',
        },
      },
    });
    expect(result.affectedBookings.find((b) => b.reference.endsWith('9301'))?.day).toBe(
      '2027-01-09',
    );
  });

  it('leaves out the day for a booking within one', async () => {
    const result = await admin.post<ImpactResult>('/admin/facilities/vaal-marina-hall/impact', {
      body: closure('2027-01-15'),
    });
    const single = result.affectedBookings.find((b) => b.reference.endsWith('9303'));
    expect(single).toBeDefined();
    expect(single?.day).toBeUndefined();
  });

  it('does not count days in between against the operating hours: a closed Saturday is fine', async () => {
    const facility = await admin.get<AdminFacility>('/admin/facilities/rothdene-hall');
    const days = facility.schedule.days.map((d) =>
      d.dayOfWeek === 6 ? { ...d, opensAt: null, closesAt: null } : d,
    );
    const result = await admin.post<ImpactResult>('/admin/facilities/rothdene-hall/impact', {
      body: { kind: 'schedule', schedule: { ...facility.schedule, days } },
    });
    expect(result.affectedBookings.map((b) => b.reference)).not.toContain(
      expect.stringMatching(/9301$/),
    );
    expect(result.affectedBookings.some((b) => b.reference.endsWith('9301'))).toBe(false);
  });

  it('does count the first day’s start and the last day’s end', async () => {
    const facility = await admin.get<AdminFacility>('/admin/facilities/rothdene-hall');
    const days = facility.schedule.days.map((d) =>
      d.dayOfWeek === 5 ? { ...d, closesAt: '13:00' } : d,
    );
    const result = await admin.post<ImpactResult>('/admin/facilities/rothdene-hall/impact', {
      body: { kind: 'schedule', schedule: { ...facility.schedule, days } },
    });
    expect(result.affectedBookings.find((b) => b.reference.endsWith('9301'))?.reason).toBe(
      'outside_operating_hours',
    );
  });
});

describe('what has not been introduced', () => {
  it('has no occurrences, partial availability or per day cancellation on a booking', async () => {
    const draft = await spanBooking(
      'lakeside-hall',
      ['2026-11-27', '14:00'],
      ['2026-11-29', '12:00'],
    );
    const booking = await submit(draft.id);
    const keys = Object.keys(booking).join(' ');
    expect(keys).not.toMatch(/occurrence|series|recurr|perDay|days\b/i);
    expect(Object.keys(booking.actions)).toEqual(expect.not.arrayContaining(['cancelDay']));
  });
});
