import { DateTime } from 'luxon';
import { sendsInvalidRequests } from '@/test/contract';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createApiClient,
  isApiProblem,
  type AdminBlackout,
  type AdminFacility,
  type AdminFacilityImage,
  type AdminFacilityList,
  type ApiProblem,
  type FacilityAvailability,
  type FacilityDetail,
  type FacilityListResponse,
  type FacilitySchedule,
  type FacilityType,
  type ImpactResult,
  type ProposedChange,
} from '@/shared/api';
import { FIXED_NOW } from '@/test/clock';
import { seedApprovals } from './data/approvalSeeds';
import { seedFacilityAdmin } from './data/facilityAdminSeeds';
import { TEST_API_BASE_URL } from './server';

const as = (token: string | null) =>
  createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => token });
/** The default mock caller is a facility administrator. */
const admin = as(null);
const zone = 'Africa/Johannesburg';

beforeEach(() => seedFacilityAdmin(FIXED_NOW));

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

const facility = (id: string) => admin.get<AdminFacility>(`/admin/facilities/${id}`);
const impact = (id: string, change: ProposedChange) =>
  admin.post<ImpactResult>(`/admin/facilities/${id}/impact`, { body: change });
const refs = (result: ImpactResult) =>
  result.affectedBookings.map((b) => b.reference.replace('MVL-2026-', ''));
const publicList = (query: Record<string, string> = {}) =>
  admin.get<FacilityListResponse>('/facilities', {
    query: { status: 'all', pageSize: 100, ...query },
  });
const publicDetail = (id: string) => admin.get<FacilityDetail>(`/facilities/${id}`);

/** A local day, offset from the fixed "today", as an instant. */
const day = (offset: number, time = '00:00') => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return DateTime.fromISO('2026-11-02', { zone })
    .plus({ days: offset })
    .set({ hour: h, minute: m })
    .toUTC()
    .toISO({ suppressMilliseconds: true }) as string;
};
const date = (offset: number) =>
  DateTime.fromISO('2026-11-02', { zone }).plus({ days: offset }).toISODate() as string;
const availability = (id: string, offset: number) =>
  admin.get<FacilityAvailability>(`/facilities/${id}/availability`, {
    query: { from: date(offset), to: date(offset) },
  });

const newFacility = (extra: Record<string, unknown> = {}) =>
  admin.post<AdminFacility>('/admin/facilities', {
    body: {
      name: 'Annex Room',
      code: 'ANX-1',
      typeId: 'committee-room',
      locality: 'Meyerton',
      shortDescription: 'A small room next to City Hall.',
      description: '',
      parentFacilityId: null,
      ...extra,
    },
  });

describe('permissions', () => {
  it('refuses anyone who is not an administrator', async () => {
    const applicant = as('user:applicant-thandi');
    expect((await failure(applicant.get('/admin/facilities'))).status).toBe(403);
    expect((await failure(applicant.get('/admin/facilities/city-hall'))).status).toBe(403);
    expect((await failure(applicant.get('/admin/facility-types'))).status).toBe(403);
    expect((await failure(applicant.post('/admin/facilities/city-hall/archive'))).status).toBe(403);
  });

  it('lets facility administrators and system administrators in', async () => {
    expect(
      (await as('user:approver-vaal').get<AdminFacilityList>('/admin/facilities')).totalItems,
    ).toBeGreaterThan(0);
    expect(
      (await as('user:mock-sysadmin').get<AdminFacilityList>('/admin/facilities')).totalItems,
    ).toBeGreaterThan(0);
  });
});

describe('the list', () => {
  it('includes archived facilities only when asked, and shows each parent followed by its spaces', async () => {
    const page = await admin.get<AdminFacilityList>('/admin/facilities', {
      query: { pageSize: 100 },
    });
    expect(page.items.map((i) => i.status)).not.toContain('archived');
    const names = page.items.map((i) => i.name);
    const hall = names.indexOf('City Hall');
    expect(names.slice(hall + 1, hall + 4).sort()).toEqual([
      'City Hall Committee Room',
      'Loch Wing',
      'Mitchell Wing',
    ]);
    expect(page.items.slice(hall + 1, hall + 4).every((i) => i.depth === 1)).toBe(true);
    expect(page.items[hall]).toMatchObject({ depth: 0, childCount: 3, parentFacility: null });
    expect(page.items.find((i) => i.name === 'Loch Wing')?.parentFacility).toEqual({
      id: 'city-hall',
      name: 'City Hall',
    });
  });

  it('shows at a glance the future bookings and whether a blackout is in effect', async () => {
    const page = await admin.get<AdminFacilityList>('/admin/facilities', {
      query: { pageSize: 100 },
    });
    const by = Object.fromEntries(page.items.map((i) => [i.id, i]));
    expect(by['rothdene-hall']?.futureBookings).toBe(4);
    expect(by['lakeside-hall']?.futureBookings).toBe(2);
    expect(by['sicelo-hall']?.futureBookings).toBe(0);
    // City Hall's blackout is in effect now, and so is it on the spaces inside.
    expect(by['city-hall']?.blackoutActive).toBe(true);
    expect(by['mitchell-wing']?.blackoutActive).toBe(true);
    expect(by['rothdene-hall']?.blackoutActive).toBe(false);
  });

  it('reports facilities nobody approves for', async () => {
    const page = await admin.get<AdminFacilityList>('/admin/facilities', {
      query: { pageSize: 100 },
    });
    expect(page.withoutApprover).toBe(3);
    const none = page.items
      .filter((i) => i.approverCount === 0)
      .map((i) => i.id)
      .sort();
    expect(none).toEqual(['activity-room', 'bantu-bonke-hall', 'council-chambers']);
  });

  it('filters by structure, type, locality, status and search, and sorts', async () => {
    const list = (query: Record<string, string | string[]>) =>
      admin.get<AdminFacilityList>('/admin/facilities', { query: { pageSize: 100, ...query } });
    expect((await list({ structure: 'child' })).items.map((i) => i.name).sort()).toEqual([
      'City Hall Committee Room',
      'Loch Wing',
      'Mitchell Wing',
      'Vaal Marina Board Room',
    ]);
    expect((await list({ structure: 'parent' })).items.map((i) => i.name).sort()).toEqual([
      'City Hall',
      'Vaal Marina Hall',
    ]);
    expect((await list({ type: 'hall-wing' })).totalItems).toBe(2);
    expect((await list({ locality: 'Vaal Marina' })).totalItems).toBe(2);
    expect((await list({ q: 'rothdene' })).items.map((i) => i.id)).toEqual(['rothdene-hall']);
    expect((await list({ status: 'archived' })).totalItems).toBe(0);
    const flat = (await list({ sort: '-futureBookings' })).items;
    expect(flat[0]?.id).toBe('rothdene-hall');
    expect(flat.every((i) => i.depth === 0)).toBe(true);
  });
});

describe('creating a facility', () => {
  it('starts unavailable, because nobody approves for it yet', async () => {
    const created = await newFacility();
    expect(created.status).toBe('unavailable');
    expect(created.approvers).toEqual([]);
    expect(created.id).toBe('annex-room');
  });

  it('with a parent gives the containment relationship, which the public screens then show', async () => {
    await newFacility({ parentFacilityId: 'city-hall' });

    const mine = await publicDetail('annex-room');
    expect(mine.parentFacility).toEqual({ id: 'city-hall', name: 'City Hall' });
    const parent = await publicDetail('city-hall');
    expect(parent.childFacilities.map((c) => c.name)).toContain('Annex Room');
    const sibling = await publicDetail('loch-wing');
    expect(sibling.siblingFacilities.map((c) => c.name)).toContain('Annex Room');

    const browse = await publicList({ q: 'annex' });
    expect(browse.items[0]).toMatchObject({
      name: 'Annex Room',
      parentFacility: { id: 'city-hall', name: 'City Hall' },
      status: 'unavailable',
    });
  });

  it('and with a parent blocks the parent while the child is booked, in the availability engine', async () => {
    // Booked time at the new space blocks the whole of City Hall, across the hierarchy.
    await newFacility({ parentFacilityId: 'rothdene-hall', typeId: 'hall' });
    const created = await facility('annex-room');
    await admin.put('/admin/facilities/annex-room/schedule', {
      body: {
        ...created.schedule,
        days: created.schedule.days.map((d) => ({ ...d, opensAt: '07:00', closesAt: '23:00' })),
      },
    });
    const result = await availability('rothdene-hall', 40);
    expect(result.days[0]?.status).not.toBe('closed');
    const child = await availability('annex-room', 40);
    const related = child.days[0]?.segments.find((s) => s.status === 'blocked_by_related');
    expect(related?.relatedFacility).toMatchObject({ id: 'rothdene-hall', relationship: 'parent' });
  });

  it('refuses a duplicate code, a missing field and an unknown type, naming each', async () => {
    const failed = await failure(newFacility({ code: 'city-hall', name: '', typeId: 'nope' }));
    expect(failed.status).toBe(422);
    expect(failed.errors.code?.[0]).toMatch(/City Hall already uses/);
    expect(failed.errors.name).toBeDefined();
    expect(failed.errors.typeId).toBeDefined();
  });

  it('replaces fixture data: what is saved is no longer provisional', async () => {
    const before = await facility('rothdene-hall');
    expect(before.provisionalFields).toContain('locality');
    await admin.patch('/admin/facilities/rothdene-hall', {
      body: { locality: 'Rothdene', code: 'ROTH-1' },
    });
    const after = await facility('rothdene-hall');
    expect(after.provisionalFields).not.toContain('locality');
    expect(after.provisionalFields).not.toContain('code');
    expect(after.provisionalFields).toContain('operatingSchedule');
    const shown = (await publicList({ q: 'rothdene' })).items[0];
    expect(shown?.provisionalFields).not.toContain('locality');
  });
});

describe('the hierarchy', () => {
  it('cannot be made into a cycle, and the options do not offer one', async () => {
    const hall = await facility('city-hall');
    const offered = hall.eligibleParents.map((p) => p.id);
    expect(offered).not.toContain('city-hall');
    for (const inside of ['mitchell-wing', 'loch-wing', 'city-hall-committee-room']) {
      expect(offered).not.toContain(inside);
    }
    expect(offered).toContain('rothdene-hall');

    for (const parent of ['mitchell-wing', 'city-hall']) {
      const patched = await failure(
        admin.patch('/admin/facilities/city-hall', { body: { parentFacilityId: parent } }),
      );
      expect(patched.status).toBe(422);
      expect(patched.errors.parentFacilityId?.[0]).toBeDefined();
      const checked = await failure(
        impact('city-hall', { kind: 'hierarchy', parentFacilityId: parent }),
      );
      expect(checked.status).toBe(422);
    }
    expect((await facility('city-hall')).parentFacility).toBeNull();
  });

  it('cannot place a facility inside a deeper descendant either', async () => {
    await admin.patch('/admin/facilities/rothdene-hall', {
      body: { parentFacilityId: 'loch-wing' },
    });
    const failed = await failure(
      admin.patch('/admin/facilities/city-hall', { body: { parentFacilityId: 'rothdene-hall' } }),
    );
    expect(failed.status).toBe(422);
  });

  it('names a new conflict when a facility is moved into a building', async () => {
    const result = await impact('activity-room', {
      kind: 'hierarchy',
      parentFacilityId: 'rothdene-hall',
    });
    expect(result.totalAffected).toBe(1);
    expect(result.affectedBookings[0]).toMatchObject({
      reference: 'MVL-2026-9210',
      applicantName: 'Tebogo Molefe',
      reason: 'new_conflict',
      conflictsWith: { reference: 'MVL-2026-9201', facility: { id: 'rothdene-hall' } },
    });
  });

  it('affects nothing when the move creates no clash', async () => {
    const result = await impact('sicelo-hall', {
      kind: 'hierarchy',
      parentFacilityId: 'city-hall',
    });
    expect(result).toEqual({ affectedBookings: [], totalAffected: 0 });
  });

  it('once applied, changes what blocks what on the public availability', async () => {
    const before = await availability('activity-room', 40);
    expect(before.days[0]?.segments.some((s) => s.status === 'blocked_by_related')).toBe(false);
    await admin.patch('/admin/facilities/activity-room', {
      body: { parentFacilityId: 'rothdene-hall' },
    });
    const after = await availability('activity-room', 40);
    expect(
      after.days[0]?.segments.filter((s) => s.status === 'blocked_by_related').length,
    ).toBeGreaterThan(0);
  });
});

describe('blackouts', () => {
  const whole = (from: number, to: number) => ({
    kind: 'blackout' as const,
    blackout: {
      startsAt: day(from),
      endsAt: day(to + 1),
      allDay: true,
      reason: 'Closed for floor maintenance',
    },
  });

  it('lists every booking a blackout across them would cover, before anything is changed', async () => {
    const result = await impact('rothdene-hall', whole(40, 41));
    expect(result.totalAffected).toBe(3);
    expect(refs(result)).toEqual(['9201', '9202', '9203']);
    expect(result.affectedBookings.every((b) => b.reason === 'inside_blackout')).toBe(true);
    expect(result.affectedBookings[0]).toMatchObject({
      applicantName: 'Grace Mthembu',
      status: 'approved',
      facility: { name: 'Rothdene Hall' },
    });
    // Nothing was created.
    expect(await admin.get<AdminBlackout[]>('/admin/facilities/rothdene-hall/blackouts')).toEqual(
      [],
    );
  });

  it('reaches only the bookings it overlaps, to the minute', async () => {
    const part = await impact('rothdene-hall', {
      kind: 'blackout',
      blackout: {
        startsAt: day(40, '13:00'),
        endsAt: day(40, '14:00'),
        allDay: false,
        reason: 'Short closure',
      },
    });
    expect(part.totalAffected).toBe(0);
  });

  it('applies to the spaces inside a facility', async () => {
    const result = await impact('vaal-marina-hall', whole(33, 33));
    expect(refs(result)).toEqual(['9208']);
  });

  it('shows on the public calendar as a closed day, with its reason', async () => {
    await admin.post('/admin/facilities/rothdene-hall/blackouts', { body: whole(40, 41).blackout });
    const closed = await availability('rothdene-hall', 40);
    expect(closed.days[0]).toMatchObject({
      status: 'closed',
      closedReason: 'Closed for floor maintenance',
    });
  });

  it('shows part of a day as a closure with its reason, leaving the rest bookable', async () => {
    await admin.post('/admin/facilities/lakeside-hall/blackouts', {
      body: {
        startsAt: day(46, '12:00'),
        endsAt: day(46, '14:00'),
        allDay: false,
        reason: 'Fire drill',
      },
    });
    const result = await availability('lakeside-hall', 46);
    expect(result.days[0]?.status).toBe('partially_booked');
    expect(result.days[0]?.segments).toContainEqual(
      expect.objectContaining({ status: 'closure', reason: 'Fire drill' }),
    );
  });

  it('on a parent applies to its children, who show it as inherited', async () => {
    await admin.post('/admin/facilities/rothdene-hall/blackouts', { body: whole(60, 61).blackout });
    // Rothdene has no children in the fixture, so build one.
    await admin.patch('/admin/facilities/activity-room', {
      body: { parentFacilityId: 'rothdene-hall' },
    });
    const inherited = await admin.get<AdminBlackout[]>('/admin/facilities/activity-room/blackouts');
    expect(inherited).toHaveLength(1);
    expect(inherited[0]).toMatchObject({
      inheritedFrom: { id: 'rothdene-hall', name: 'Rothdene Hall' },
      state: 'future',
    });
    expect((await availability('activity-room', 60)).days[0]?.status).toBe('closed');
  });

  it('can be deleted before it starts, not once it has started', async () => {
    const created = await admin.post<AdminBlackout>('/admin/facilities/rothdene-hall/blackouts', {
      body: whole(60, 61).blackout,
    });
    await admin.delete(`/admin/facilities/rothdene-hall/blackouts/${created.id}`);
    expect(await admin.get<AdminBlackout[]>('/admin/facilities/rothdene-hall/blackouts')).toEqual(
      [],
    );

    const current = (await admin.get<AdminBlackout[]>('/admin/facilities/city-hall/blackouts'))[0];
    expect(current?.state).toBe('current');
    const failed = await failure(
      admin.delete(`/admin/facilities/city-hall/blackouts/${current?.id}`),
    );
    expect(failed.status).toBe(409);
  });

  it('needs a reason, an end after the start, and a future', async () => {
    const post = (body: object) =>
      failure(admin.post('/admin/facilities/rothdene-hall/blackouts', { body }));
    expect((await post({ ...whole(40, 40).blackout, reason: ' ' })).errors.reason).toBeDefined();
    expect(
      (await post({ ...whole(40, 40).blackout, endsAt: day(39) })).errors.endsAt,
    ).toBeDefined();
    expect((await post({ ...whole(-5, -4).blackout })).errors.startsAt).toBeDefined();
  });
});

describe('the schedule', () => {
  const scheduleOf = async (id: string): Promise<FacilitySchedule> => (await facility(id)).schedule;

  it('affects nothing when nothing retroactive changes', async () => {
    const schedule = await scheduleOf('vaal-marina-hall');
    expect((await impact('vaal-marina-hall', { kind: 'schedule', schedule })).totalAffected).toBe(
      0,
    );
    const wider = { ...schedule, days: schedule.days.map((d) => ({ ...d, closesAt: '23:30' })) };
    expect(
      (await impact('vaal-marina-hall', { kind: 'schedule', schedule: wider })).totalAffected,
    ).toBe(0);
    expect((await impact('rothdene-hall', { kind: 'details' })).totalAffected).toBe(0);
  });

  it('surfaces a booking left outside narrowed hours, and only that one', async () => {
    const schedule = await scheduleOf('vaal-marina-hall');
    const narrower = { ...schedule, days: schedule.days.map((d) => ({ ...d, closesAt: '22:00' })) };
    const result = await impact('vaal-marina-hall', { kind: 'schedule', schedule: narrower });
    expect(refs(result)).toEqual(['9206']);
    expect(result.affectedBookings[0]?.reason).toBe('outside_operating_hours');
  });

  it('surfaces a conflict that did not exist when a buffer is increased', async () => {
    const schedule = await scheduleOf('lakeside-hall');
    expect(schedule.setupMinutes).toBe(0);
    const result = await impact('lakeside-hall', {
      kind: 'schedule',
      schedule: { ...schedule, setupMinutes: 30 },
    });
    expect(result.totalAffected).toBe(1);
    expect(result.affectedBookings[0]).toMatchObject({
      reference: 'MVL-2026-9205',
      reason: 'new_conflict',
      conflictsWith: { reference: 'MVL-2026-9204' },
    });
    // Clear-down time does the same from the other side.
    const after = await impact('lakeside-hall', {
      kind: 'schedule',
      schedule: { ...schedule, teardownMinutes: 30 },
    });
    expect(refs(after)).toEqual(['9205']);
    // A buffer that still fits the twenty minute gap creates nothing.
    const small = await impact('lakeside-hall', {
      kind: 'schedule',
      schedule: { ...schedule, setupMinutes: 15 },
    });
    expect(small.totalAffected).toBe(0);
  });

  it('once saved, shows on the public detail and the calendar', async () => {
    const schedule = await scheduleOf('lakeside-hall');
    const days = schedule.days.map((d) => ({ ...d, opensAt: '09:00', closesAt: '20:00' }));
    await admin.put('/admin/facilities/lakeside-hall/schedule', {
      body: { ...schedule, days, setupMinutes: 30, minimumNoticeHours: 24, maximumHorizonDays: 30 },
    });
    expect((await publicDetail('lakeside-hall')).operatingSchedule[0]).toMatchObject({
      opensAt: '09:00',
      closesAt: '20:00',
    });
    const result = await availability('lakeside-hall', 45);
    expect(result).toMatchObject({ minimumNoticeHours: 24, maximumHorizonDays: 30 });
    expect(result.days[0]).toMatchObject({ opensAt: '09:00', closesAt: '20:00' });
    // The buffer now shows around the approved booking.
    expect(result.days[0]?.segments.filter((s) => s.status === 'buffer').length).toBeGreaterThan(0);
  });

  it('validates the hours it is given', async () => {
    sendsInvalidRequests();
    const schedule = await scheduleOf('lakeside-hall');
    const put = (body: object) =>
      failure(admin.put('/admin/facilities/lakeside-hall/schedule', { body }));
    const backwards = schedule.days.map((d, i) =>
      i === 0 ? { ...d, opensAt: '17:00', closesAt: '08:00' } : d,
    );
    expect((await put({ ...schedule, days: backwards })).errors['days.0']).toBeDefined();
    const half = schedule.days.map((d, i) => (i === 1 ? { ...d, opensAt: null } : d));
    expect((await put({ ...schedule, days: half })).errors['days.1']).toBeDefined();
    expect((await put({ ...schedule, setupMinutes: -5 })).errors.setupMinutes).toBeDefined();
  });
});

describe('capacity', () => {
  it('names bookings that now exceed a reduced capacity, and not ones that still fit', async () => {
    const detail = await facility('rothdene-hall');
    expect(detail.capacity.byArrangement.find((c) => c.arrangement === 'Banquet')?.capacity).toBe(
      150,
    );
    const reduce = (banquet: number) =>
      impact('rothdene-hall', {
        kind: 'capacity',
        capacity: {
          maximum: detail.capacity.maximum,
          byArrangement: detail.capacity.byArrangement.map((c) =>
            c.arrangement === 'Banquet' ? { ...c, capacity: banquet } : c,
          ),
        },
      });
    const result = await reduce(120);
    expect(refs(result)).toEqual(['9209']);
    expect(result.affectedBookings[0]?.reason).toBe('over_capacity');
    expect(refs(await reduce(90))).toEqual(['9202', '9209']);
    expect((await reduce(160)).totalAffected).toBe(0);
  });

  it('validates, and refuses capacity for a type it does not apply to', async () => {
    const put = (id: string, body: object) =>
      failure(admin.put(`/admin/facilities/${id}/capacity`, { body }));
    const tooMany = await put('rothdene-hall', {
      maximum: 100,
      byArrangement: [{ arrangement: 'Banquet', capacity: 150 }],
    });
    expect(tooMany.errors['byArrangement.0']?.[0]).toMatch(/more than the maximum/);
    const twice = await put('rothdene-hall', {
      maximum: 250,
      byArrangement: [
        { arrangement: 'Banquet', capacity: 10 },
        { arrangement: 'banquet', capacity: 20 },
      ],
    });
    expect(twice.errors['byArrangement.1']).toBeDefined();

    await admin.post('/admin/facility-types', { body: { name: 'Park', capacityApplies: false } });
    const park = await newFacility({ name: 'Park', code: 'PK-1', typeId: 'park' });
    expect((await put(park.id, { maximum: 50, byArrangement: [] })).errors.maximum).toBeDefined();
  });

  it('once saved, shows on the public detail', async () => {
    await admin.put('/admin/facilities/rothdene-hall/capacity', {
      body: { maximum: 200, byArrangement: [{ arrangement: 'Cinema', capacity: 200 }] },
    });
    const shown = await publicDetail('rothdene-hall');
    expect(shown.capacityByArrangement).toEqual([{ arrangement: 'Cinema', capacity: 200 }]);
    expect(shown.capacity).toBe(200);
  });
});

describe('status and archiving', () => {
  it('names future bookings when a facility is made unavailable, and not when it is reopened', async () => {
    const result = await impact('vaal-marina-hall', { kind: 'status', status: 'unavailable' });
    expect(refs(result)).toEqual(['9207', '9206']);
    expect(result.affectedBookings.every((b) => b.reason === 'facility_unavailable')).toBe(true);
    expect(
      (await impact('vaal-marina-hall', { kind: 'status', status: 'active' })).totalAffected,
    ).toBe(0);
  });

  it('lists the future bookings when archiving, and the facility then leaves the public estate', async () => {
    const result = await impact('vaal-marina-board-room', { kind: 'archive' });
    expect(refs(result)).toEqual(['9208']);

    await admin.post('/admin/facilities/vaal-marina-board-room/archive');
    expect((await publicList()).items.map((i) => i.id)).not.toContain('vaal-marina-board-room');
    expect((await failure(publicDetail('vaal-marina-board-room'))).status).toBe(404);
    expect((await publicDetail('vaal-marina-hall')).childFacilities).toEqual([]);

    // Its history is intact, and it is visible to administrators behind a filter.
    const archived = await admin.get<AdminFacilityList>('/admin/facilities', {
      query: { status: 'archived' },
    });
    expect(archived.items.map((i) => i.id)).toEqual(['vaal-marina-board-room']);
    expect(archived.items[0]?.futureBookings).toBe(1);
    expect((await facility('vaal-marina-board-room')).status).toBe('archived');
  });

  it('cannot be booked once archived', async () => {
    await admin.post('/admin/facilities/vaal-marina-board-room/archive');
    const failed = await failure(
      admin.post('/bookings', {
        body: {
          facilityId: 'vaal-marina-board-room',
          startsAt: day(70, '09:00'),
          endsAt: day(70, '11:00'),
        },
      }),
    );
    expect(failed.status).toBe(422);
  });

  it('can be restored, and comes back unavailable', async () => {
    await admin.post('/admin/facilities/vaal-marina-board-room/archive');
    const restored = await admin.post<AdminFacility>(
      '/admin/facilities/vaal-marina-board-room/restore',
    );
    expect(restored.status).toBe('unavailable');
    expect((await publicList()).items.map((i) => i.id)).toContain('vaal-marina-board-room');
  });

  it('is refused while the facility still contains others, and cannot be restored under an archived parent', async () => {
    const blocked = await failure(admin.post('/admin/facilities/vaal-marina-hall/archive'));
    expect(blocked.status).toBe(409);
    expect(blocked.detail).toMatch(/Vaal Marina Board Room/);

    await admin.post('/admin/facilities/vaal-marina-board-room/archive');
    await admin.post('/admin/facilities/vaal-marina-hall/archive');
    const orphan = await failure(admin.post('/admin/facilities/vaal-marina-board-room/restore'));
    expect(orphan.status).toBe(409);
  });

  it('cannot be edited while archived', async () => {
    await admin.post('/admin/facilities/vaal-marina-board-room/archive');
    const failed = await failure(
      admin.patch('/admin/facilities/vaal-marina-board-room', { body: { name: 'Changed' } }),
    );
    expect(failed.status).toBe(409);
  });

  it('has no way to delete a facility at all', async () => {
    sendsInvalidRequests();
    const failed = await failure(admin.delete('/admin/facilities/rothdene-hall'));
    // There is no such endpoint, so nothing answers it.
    expect(failed.status).not.toBe(204);
    expect((await facility('rothdene-hall')).id).toBe('rothdene-hall');
  });
});

describe('approvers', () => {
  it('flags a facility with nobody and will not activate it', async () => {
    const created = await newFacility();
    const failed = await failure(
      admin.patch(`/admin/facilities/${created.id}`, { body: { status: 'active' } }),
    );
    expect(failed.status).toBe(422);
    expect(failed.errors.status?.[0]).toMatch(/at least one approver/);

    await admin.put(`/admin/facilities/${created.id}/approvers`, {
      body: { userIds: ['approver-vaal'] },
    });
    const active = await admin.patch<AdminFacility>(`/admin/facilities/${created.id}`, {
      body: { status: 'active' },
    });
    expect(active.status).toBe('active');
    expect(active.approvers).toEqual([
      expect.objectContaining({ id: 'approver-vaal', name: 'Pieter van Wyk' }),
    ]);
  });

  it('will not remove the last approver from an active facility', async () => {
    const failed = await failure(
      admin.put('/admin/facilities/sicelo-hall/approvers', { body: { userIds: [] } }),
    );
    expect(failed.status).toBe(422);
    await admin.patch('/admin/facilities/sicelo-hall', { body: { status: 'unavailable' } });
    await admin.put('/admin/facilities/sicelo-hall/approvers', { body: { userIds: [] } });
    expect((await facility('sicelo-hall')).approvers).toEqual([]);
  });

  it('offers only people who can approve', async () => {
    const candidates = await admin.get<Array<{ id: string }>>('/admin/approver-candidates');
    expect(candidates.map((c) => c.id).sort()).toEqual([
      'approver-empty',
      'approver-idle',
      'approver-partial',
      'approver-vaal',
      'mock-approver-1',
    ]);
    const failed = await failure(
      admin.put('/admin/facilities/sicelo-hall/approvers', {
        body: { userIds: ['applicant-thandi'] },
      }),
    );
    expect(failed.status).toBe(422);
  });

  it('is what scopes the approval queue', async () => {
    seedApprovals(FIXED_NOW);
    const queue = (token: string) =>
      as(token)
        .get<{ totalItems: number }>('/approvals')
        .then((p) => p.totalItems);
    expect(await queue('user:approver-empty')).toBe(0);
    await admin.put('/admin/facilities/activity-room/approvers', {
      body: { userIds: ['approver-empty'] },
    });
    expect(await queue('user:approver-empty')).toBe(1);
  });
});

describe('images', () => {
  const upload = (id: string, name: string, caption: string | null) => {
    const body = new FormData();
    body.set('file', new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'image/png' }));
    if (caption !== null) body.set('caption', caption);
    return admin.upload<AdminFacilityImage>(`/admin/facilities/${id}/images`, body);
  };

  it('will not take an image without a caption', async () => {
    const failed = await failure(upload('rothdene-hall', 'hall.png', ' '));
    expect(failed.status).toBe(422);
    expect(failed.errors.caption?.[0]).toMatch(/Describe the image/);
    expect((await facility('rothdene-hall')).images).toEqual([]);
  });

  it('takes an image with a caption, which the public sees as its alternative text', async () => {
    const image = await upload('rothdene-hall', 'hall.png', 'The main hall, set for a wedding');
    expect(image).toMatchObject({ caption: 'The main hall, set for a wedding', isPrimary: true });
    expect((await publicDetail('rothdene-hall')).images).toEqual([
      { url: image.url, caption: 'The main hall, set for a wedding' },
    ]);
    expect((await publicList({ q: 'rothdene' })).items[0]?.primaryImageUrl).toBe(image.url);
  });

  it('refuses the wrong type, and reports one that fails', async () => {
    expect((await failure(upload('rothdene-hall', 'notes.pdf', 'Notes'))).status).toBe(422);
    expect((await failure(upload('rothdene-hall', 'fail.png', 'Fails'))).status).toBe(500);
  });

  it('can be recaptioned (not blanked), made primary, reordered and removed', async () => {
    const one = await upload('rothdene-hall', 'a.png', 'First');
    const two = await upload('rothdene-hall', 'b.png', 'Second');
    const patch = (id: string, body: object) =>
      admin.patch<AdminFacilityImage>(`/admin/facilities/rothdene-hall/images/${id}`, { body });

    expect((await failure(patch(one.id, { caption: '  ' }))).status).toBe(422);
    expect((await patch(one.id, { caption: 'First, renamed' })).caption).toBe('First, renamed');

    await patch(two.id, { isPrimary: true });
    let images = (await facility('rothdene-hall')).images;
    expect(images.map((i) => [i.caption, i.isPrimary])).toEqual([
      ['First, renamed', false],
      ['Second', true],
    ]);
    // The public gallery leads with the primary image.
    expect((await publicDetail('rothdene-hall')).images.map((i) => i.caption)).toEqual([
      'Second',
      'First, renamed',
    ]);

    await patch(two.id, { position: 0 });
    images = (await facility('rothdene-hall')).images;
    expect(images.map((i) => i.caption)).toEqual(['Second', 'First, renamed']);

    await admin.delete(`/admin/facilities/rothdene-hall/images/${two.id}`);
    images = (await facility('rothdene-hall')).images;
    expect(images).toHaveLength(1);
    expect(images[0]?.isPrimary).toBe(true);
  });
});

describe('facility types', () => {
  it('lists them with how many facilities use each, and adds and renames', async () => {
    const types = await admin.get<FacilityType[]>('/admin/facility-types');
    expect(types.find((t) => t.id === 'hall')).toMatchObject({ name: 'Hall', facilityCount: 5 });
    expect(types.find((t) => t.id === 'open-space')?.capacityApplies).toBe(false);

    const created = await admin.post<FacilityType>('/admin/facility-types', {
      body: { name: 'Sports field', capacityApplies: false },
    });
    expect(created).toMatchObject({
      name: 'Sports field',
      capacityApplies: false,
      facilityCount: 0,
    });
    const renamed = await admin.patch<FacilityType>(`/admin/facility-types/${created.id}`, {
      body: { name: 'Sports ground' },
    });
    expect(renamed.name).toBe('Sports ground');
    // A renamed type reads through to the public screens.
    await admin.patch('/admin/facility-types/hall', { body: { name: 'Community hall' } });
    expect((await publicList({ q: 'rothdene' })).items[0]?.type.name).toBe('Community hall');
  });

  it('refuses a blank or duplicate name', async () => {
    expect(
      (
        await failure(
          admin.post('/admin/facility-types', { body: { name: ' ', capacityApplies: true } }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await failure(
          admin.post('/admin/facility-types', { body: { name: 'hall', capacityApplies: true } }),
        )
      ).errors.name,
    ).toBeDefined();
  });
});
