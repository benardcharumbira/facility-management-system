import { beforeEach, describe, expect, it } from 'vitest';
import { sendsInvalidRequests } from '@/test/contract';
import {
  createApiClient,
  isApiProblem,
  type AdminResource,
  type AdminResourceList,
  type AllocationChange,
  type AllocationMatrix,
  type ApiProblem,
  type BookingOptions,
  type FacilityAllocations,
  type FacilityDetail,
  type FacilityFilterOptions,
  type ResourceImpactResult,
} from '@/shared/api';
import { FIXED_NOW } from '@/test/clock';
import { seedFacilityAdmin } from './data/facilityAdminSeeds';
import { bookingStore } from './data/bookingStore';
import { validateForSubmit } from './bookings';
import { TEST_API_BASE_URL } from './server';

const as = (token: string | null) =>
  createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => token });
const admin = as(null);

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

const catalogue = (query: Record<string, string | string[]> = {}) =>
  admin.get<AdminResourceList>('/admin/resources', { query: { pageSize: 100, ...query } });
const matrix = (query: Record<string, string | string[]> = {}) =>
  admin.get<AllocationMatrix>('/admin/resource-allocations', { query });
const impact = (changes: AllocationChange[]) =>
  admin.post<ResourceImpactResult>('/admin/resource-allocations/impact', { body: { changes } });
const save = (changes: AllocationChange[]) =>
  admin.put('/admin/resource-allocations', { body: { changes } });
const valueOf = async (facilityId: string, resourceId: string) =>
  (await matrix()).allocations.find(
    (a) => a.facilityId === facilityId && a.resourceId === resourceId,
  )?.value;
const refs = (result: ResourceImpactResult) =>
  result.affectedBookings.map((b) => b.reference.replace('MVL-2026-', ''));
const resource = (id: string) => admin.get<AdminResource>(`/admin/resources/${id}`);
const options = () => admin.get<BookingOptions>('/booking-options');
const detail = (id: string) => admin.get<FacilityDetail>(`/facilities/${id}`);

describe('the seeded catalogue', () => {
  it('is the nineteen resources in section 8.4 of the requirements, with their categories', async () => {
    const { items } = await catalogue();
    expect(items).toHaveLength(19);
    const names = (category: string) =>
      items
        .filter((r) => r.category === category)
        .map((r) => r.name)
        .sort();
    expect(names('venue')).toEqual(['Chairs', 'Podium', 'Sound system', 'Stage', 'Tables']);
    expect(names('kitchen')).toEqual(
      [
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
      ].sort(),
    );
  });

  it('marks a stage, a podium and a sound system as not counted, and everything else as counted', async () => {
    const { items } = await catalogue();
    const uncounted = items
      .filter((r) => !r.quantified)
      .map((r) => r.name)
      .sort();
    expect(uncounted).toEqual(['Podium', 'Sound system', 'Stage']);
    expect(items.filter((r) => r.quantified)).toHaveLength(16);
  });

  it('keeps Dining forks and Forks apart, because the source lists both and it is a question', async () => {
    const { items } = await catalogue({ q: 'forks' });
    expect(items.map((r) => r.name).sort()).toEqual(['Dining forks', 'Forks']);
    expect(items[0]?.id).not.toBe(items[1]?.id);
  });

  it('keeps the identifiers existing bookings already use', async () => {
    const ids = (await catalogue()).items.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining(['chairs', 'tables', 'stage', 'kitchen-urn', 'kitchen-cups']),
    );
  });
});

describe('the catalogue list', () => {
  it('counts the facilities holding each, and filters by category, status and search', async () => {
    const urn = (await catalogue({ q: 'urn' })).items[0];
    expect(urn).toMatchObject({
      name: 'Urn',
      category: 'kitchen',
      quantified: true,
      facilitiesHolding: 8,
    });
    expect((await catalogue({ category: 'venue' })).totalItems).toBe(5);
    expect((await catalogue({ category: 'kitchen' })).totalItems).toBe(14);
    expect((await catalogue({ status: 'archived' })).totalItems).toBe(0);
    const popular = (await catalogue({ sort: '-facilitiesHolding' })).items;
    expect(popular[0]?.facilitiesHolding).toBeGreaterThanOrEqual(
      popular[1]?.facilitiesHolding ?? 0,
    );
  });
});

describe('the allocation matrix', () => {
  it('has every resource against every one of the twelve venues', async () => {
    const m = await matrix();
    expect(m.facilities).toHaveLength(12);
    expect(m.resources).toHaveLength(19);
    expect(m.allocations).toHaveLength(12 * 19);
  });

  it('holds a number for a counted resource and available-or-not for the others', async () => {
    expect(await valueOf('city-hall', 'chairs')).toBe(500);
    expect(await valueOf('city-hall', 'tables')).toBe(63);
    expect(await valueOf('city-hall', 'stage')).toBe(true);
    expect(await valueOf('council-chambers', 'stage')).toBe(false);
    expect(await valueOf('council-chambers', 'chairs')).toBe(60);
    // The board room has no kitchen at all.
    expect(await valueOf('vaal-marina-board-room', 'kitchen-cups')).toBe(0);
  });

  it('can be narrowed to some facilities and one category', async () => {
    const m = await matrix({ facilityId: ['city-hall', 'rothdene-hall'], category: 'venue' });
    expect(m.facilities.map((f) => f.id).sort()).toEqual(['city-hall', 'rothdene-hall']);
    expect(m.resources).toHaveLength(5);
    expect(m.allocations).toHaveLength(10);
  });

  it('agrees with what each facility shows the public', async () => {
    const hall = await detail('city-hall');
    expect(hall.resources.find((r) => r.id === 'chairs')).toMatchObject({
      quantity: 500,
      quantified: true,
    });
    expect(hall.resources.find((r) => r.id === 'stage')).toMatchObject({ quantified: false });
    expect(hall.resources.map((r) => r.id)).not.toContain('not-held');
  });
});

describe('impact of a batch of edits', () => {
  it('names a booking whose request a reduced quantity no longer meets, with the resource and numbers', async () => {
    const result = await impact([{ facilityId: 'rothdene-hall', resourceId: 'chairs', value: 95 }]);
    expect(refs(result)).toEqual(['9202', '9209']);
    expect(result.affectedBookings[1]).toMatchObject({
      reference: 'MVL-2026-9209',
      applicantName: 'Dawie Steyn',
      facility: { name: 'Rothdene Hall' },
      reason: 'resource_shortfall',
      resource: { id: 'chairs', name: 'Chairs', requested: 140, available: 95 },
    });
    // Nothing was changed by asking.
    expect(await valueOf('rothdene-hall', 'chairs')).toBe(250);
  });

  it('does not name a booking that the new quantity still meets', async () => {
    const result = await impact([
      { facilityId: 'rothdene-hall', resourceId: 'chairs', value: 100 },
    ]);
    expect(refs(result)).toEqual(['9209']);
  });

  it('names a booking that asked for something an unquantified resource no longer offers', async () => {
    const result = await impact([
      { facilityId: 'rothdene-hall', resourceId: 'stage', value: false },
    ]);
    expect(refs(result)).toEqual(['9202']);
    expect(result.affectedBookings[0]).toMatchObject({
      reason: 'resource_withdrawn',
      resource: { id: 'stage', name: 'Stage', requested: 1, available: null },
    });
  });

  it('checks the whole batch at once: a booking short on two resources is listed for each and counted once', async () => {
    const result = await impact([
      { facilityId: 'rothdene-hall', resourceId: 'chairs', value: 50 },
      { facilityId: 'rothdene-hall', resourceId: 'kitchen-cups', value: 100 },
      { facilityId: 'rothdene-hall', resourceId: 'stage', value: false },
      { facilityId: 'lakeside-hall', resourceId: 'chairs', value: 60 },
    ]);
    expect(refs(result)).toEqual(['9201', '9202', '9202', '9204', '9205', '9209', '9209']);
    expect(result.totalAffected).toBe(5);
    const forNine = result.affectedBookings.filter((b) => b.reference.endsWith('9209'));
    expect(forNine.map((b) => b.resource?.name).sort()).toEqual(['Chairs', 'Cups']);
  });

  it('affects nothing when the edits meet every request', async () => {
    const result = await impact([
      { facilityId: 'rothdene-hall', resourceId: 'chairs', value: 400 },
      { facilityId: 'rothdene-hall', resourceId: 'kitchen-teaspoons', value: 1 },
      { facilityId: 'city-hall', resourceId: 'stage', value: false },
      { facilityId: 'sicelo-hall', resourceId: 'kitchen-urn', value: 0 },
    ]);
    expect(result).toMatchObject({ affectedBookings: [], totalAffected: 0 });
  });

  it('counts the last edit to a cell, as the save will', async () => {
    const result = await impact([
      { facilityId: 'rothdene-hall', resourceId: 'chairs', value: 50 },
      { facilityId: 'rothdene-hall', resourceId: 'chairs', value: 300 },
    ]);
    expect(result.totalAffected).toBe(0);
  });

  it('does not blame an edit for a shortfall that was already there', async () => {
    await save([{ facilityId: 'rothdene-hall', resourceId: 'chairs', value: 50 }]);
    const again = await impact([{ facilityId: 'rothdene-hall', resourceId: 'chairs', value: 40 }]);
    expect(again.totalAffected).toBe(0);
  });
});

describe('saving a batch', () => {
  it('applies every change', async () => {
    await save([
      { facilityId: 'rothdene-hall', resourceId: 'kitchen-urn', value: 3 },
      { facilityId: 'sicelo-hall', resourceId: 'stage', value: false },
    ]);
    expect(await valueOf('rothdene-hall', 'kitchen-urn')).toBe(3);
    expect(await valueOf('sicelo-hall', 'stage')).toBe(false);
  });

  it('refuses the whole batch, naming the changes at fault, when any is invalid, and changes nothing', async () => {
    sendsInvalidRequests();
    const failed = await failure(
      save([
        { facilityId: 'rothdene-hall', resourceId: 'kitchen-urn', value: 3 },
        {
          facilityId: 'rothdene-hall',
          resourceId: 'kitchen-cups',
          value: 'many' as unknown as number,
        },
        { facilityId: 'rothdene-hall', resourceId: 'stage', value: 4 as unknown as boolean },
        { facilityId: 'nowhere', resourceId: 'chairs', value: 1 },
        { facilityId: 'rothdene-hall', resourceId: 'chairs', value: 99_999 },
      ]),
    );
    expect(failed.status).toBe(422);
    expect(Object.keys(failed.errors).sort()).toEqual([
      'changes.1',
      'changes.2',
      'changes.3',
      'changes.4',
    ]);
    expect(failed.errors['changes.2']?.[0]).toMatch(/not counted/);
    expect(await valueOf('rothdene-hall', 'kitchen-urn')).toBe(2);
  });

  it('rolls everything back when the batch fails part way through applying', async () => {
    const failed = await failure(
      save([
        { facilityId: 'rothdene-hall', resourceId: 'kitchen-urn', value: 9 },
        { facilityId: 'sicelo-hall', resourceId: 'chairs', value: 1 },
        // The Bantu Bonke Hall is locked for a stocktake, which is found only when it is reached.
        { facilityId: 'bantu-bonke-hall', resourceId: 'chairs', value: 5 },
      ]),
    );
    expect(failed.status).toBe(409);
    expect(failed.detail).toMatch(/stocktake/);
    expect(await valueOf('rothdene-hall', 'kitchen-urn')).toBe(2);
    expect(await valueOf('sicelo-hall', 'chairs')).toBe(200);
  });

  it('refuses an empty or malformed request', async () => {
    sendsInvalidRequests();
    expect((await failure(admin.put('/admin/resource-allocations', { body: {} }))).status).toBe(
      422,
    );
  });
});

describe('creating and changing the catalogue', () => {
  const create = (body: object) => admin.post<AdminResource>('/admin/resources', { body });

  it('adds a resource that then exists everywhere: the booking form, the matrix, the facilities', async () => {
    const projector = await create({
      name: 'Projector',
      category: 'venue',
      quantified: false,
      description: 'A ceiling mounted projector and screen.',
    });
    expect(projector).toMatchObject({ id: 'projector', status: 'active', facilitiesHolding: 0 });

    expect((await options()).resources.find((r) => r.id === 'projector')).toMatchObject({
      quantified: false,
      category: 'venue',
    });
    const m = await matrix();
    expect(m.resources.map((r) => r.id)).toContain('projector');
    expect(await valueOf('city-hall', 'projector')).toBe(false);

    // Nobody holds one yet, so it is not an amenity. Once a facility does, it is.
    let filters = await admin.get<FacilityFilterOptions>('/facilities/filter-options');
    expect(filters.amenities.map((a) => a.id)).not.toContain('projector');
    await save([{ facilityId: 'city-hall', resourceId: 'projector', value: true }]);
    filters = await admin.get<FacilityFilterOptions>('/facilities/filter-options');
    expect(filters.amenities).toContainEqual({ id: 'projector', name: 'Projector' });
    expect((await detail('city-hall')).amenities.map((a) => a.id)).toContain('projector');
  });

  it('refuses a duplicate or missing name and a category outside the vocabulary', async () => {
    sendsInvalidRequests();
    const failed = await failure(create({ name: 'chairs', category: 'garden', quantified: true }));
    expect(failed.errors.name?.[0]).toMatch(/already a resource called Chairs/);
    expect(failed.errors.category).toBeDefined();
    expect(
      (await failure(create({ name: ' ', category: 'venue', quantified: true }))).errors.name,
    ).toBeDefined();
  });

  it('renames a resource everywhere it appears', async () => {
    await admin.patch('/admin/resources/kitchen-urn', { body: { name: 'Tea urn' } });
    expect((await options()).resources.find((r) => r.id === 'kitchen-urn')?.name).toBe('Tea urn');
    expect(
      (await detail('rothdene-hall')).resources.find((r) => r.id === 'kitchen-urn')?.name,
    ).toBe('Tea urn');
  });
});

describe('changing whether a resource is counted', () => {
  it('discards the numbers when it stops being counted, and says how many allocations', async () => {
    const result = await admin.post<ResourceImpactResult>('/admin/resources/kitchen-urn/impact', {
      body: { kind: 'quantified', quantified: false },
    });
    expect(result).toMatchObject({
      allocationsAffected: 8,
      facilitiesAffected: 8,
      totalAffected: 0,
    });

    await admin.patch('/admin/resources/kitchen-urn', { body: { quantified: false } });
    expect(await valueOf('rothdene-hall', 'kitchen-urn')).toBe(true);
    expect(await valueOf('vaal-marina-board-room', 'kitchen-urn')).toBe(false);
    const shown = (await detail('rothdene-hall')).resources.find((r) => r.id === 'kitchen-urn');
    expect(shown).toMatchObject({ quantified: false });
  });

  it('leaves every facility at zero when it starts being counted, and names bookings that asked for it', async () => {
    const result = await admin.post<ResourceImpactResult>('/admin/resources/stage/impact', {
      body: { kind: 'quantified', quantified: true },
    });
    expect(result.allocationsAffected).toBeGreaterThan(0);
    expect(refs(result)).toEqual(['9202']);
    expect(result.affectedBookings[0]).toMatchObject({
      reason: 'resource_shortfall',
      resource: { id: 'stage', requested: 1, available: 0 },
    });

    await admin.patch('/admin/resources/stage', { body: { quantified: true } });
    expect(await valueOf('city-hall', 'stage')).toBe(0);
    expect((await detail('city-hall')).resources.map((r) => r.id)).not.toContain('stage');
    expect((await options()).resources.find((r) => r.id === 'stage')?.quantified).toBe(true);
  });

  it('affects nothing when the flag is not actually changing, or only the name', async () => {
    const same = await admin.post<ResourceImpactResult>('/admin/resources/stage/impact', {
      body: { kind: 'quantified', quantified: false },
    });
    expect(same).toMatchObject({ totalAffected: 0, allocationsAffected: 0 });
    const rename = await admin.post<ResourceImpactResult>('/admin/resources/stage/impact', {
      body: { kind: 'details' },
    });
    expect(rename.totalAffected).toBe(0);
  });
});

describe('archiving a resource', () => {
  it('names the pending and approved bookings that asked for it', async () => {
    const result = await admin.post<ResourceImpactResult>('/admin/resources/kitchen-urn/impact', {
      body: { kind: 'archive' },
    });
    // In the order of the events.
    expect(refs(result)).toEqual(['9211', '9202', '9209']);
    expect(result.affectedBookings.every((b) => b.reason === 'resource_archived')).toBe(true);
    expect(result.affectedBookings.find((b) => b.reference.endsWith('9211'))?.status).toBe(
      'pending',
    );
  });

  it('removes it from the booking form, the matrix, every facility and the browse filters, but not from history', async () => {
    await admin.post('/admin/resources/stage/archive');

    expect((await options()).resources.map((r) => r.id)).not.toContain('stage');
    expect((await options()).retiredResources.map((r) => r.id)).toContain('stage');
    expect((await matrix()).resources.map((r) => r.id)).not.toContain('stage');
    expect((await detail('city-hall')).resources.map((r) => r.id)).not.toContain('stage');
    expect((await detail('city-hall')).amenities.map((a) => a.id)).not.toContain('stage');
    const filters = await admin.get<FacilityFilterOptions>('/facilities/filter-options');
    expect(filters.amenities.map((a) => a.id)).not.toContain('stage');

    // The booking that asked for it still does, and the resource is still known by name.
    expect(
      bookingStore.all().find((e) => e.booking.id === 'adm-9202')?.booking.resources,
    ).toContainEqual({
      resourceId: 'stage',
      quantity: 1,
    });
    expect((await options()).retiredResources.find((r) => r.id === 'stage')?.name).toBe('Stage');
    expect((await catalogue({ status: 'archived' })).items.map((r) => r.id)).toEqual(['stage']);
  });

  it('refuses a new request for it, saying which', async () => {
    await admin.post('/admin/resources/stage/archive');
    const held = bookingStore.all().find((e) => e.booking.id === 'adm-9202')?.booking;
    expect(held).toBeDefined();
    const errors = validateForSubmit({
      ...(held as NonNullable<typeof held>),
      acceptedTermsVersion: null,
    });
    expect(errors.resources?.[0]).toMatch(/Stage can no longer be requested/);
  });

  it('can be restored, and its allocations come back', async () => {
    await admin.post('/admin/resources/stage/archive');
    await admin.post('/admin/resources/stage/restore');
    expect((await options()).resources.map((r) => r.id)).toContain('stage');
    expect(await valueOf('city-hall', 'stage')).toBe(true);
    expect((await detail('city-hall')).amenities.map((a) => a.id)).toContain('stage');
  });

  it('cannot be edited while archived, and cannot be deleted at all', async () => {
    sendsInvalidRequests();
    await admin.post('/admin/resources/stage/archive');
    expect(
      (await failure(admin.patch('/admin/resources/stage', { body: { name: 'Platform' } }))).status,
    ).toBe(409);
    expect((await failure(admin.delete('/admin/resources/stage'))).status).not.toBe(204);
    expect((await resource('stage')).status).toBe('archived');
  });
});

describe('one facility', () => {
  it('lists every active resource with its value, counted or not', async () => {
    const found = await admin.get<FacilityAllocations>('/admin/facilities/rothdene-hall/resources');
    expect(found.facility.name).toBe('Rothdene Hall');
    expect(found.resources).toHaveLength(19);
    expect(found.resources.find((r) => r.id === 'chairs')).toMatchObject({
      quantified: true,
      value: 250,
    });
    expect(found.resources.find((r) => r.id === 'podium')).toMatchObject({
      quantified: false,
      value: false,
    });
  });

  it('saves its values atomically, and refuses the lot on one bad value', async () => {
    sendsInvalidRequests();
    await admin.put('/admin/facilities/rothdene-hall/resources', {
      body: {
        values: [
          { resourceId: 'kitchen-urn', value: 4 },
          { resourceId: 'podium', value: true },
        ],
      },
    });
    expect(await valueOf('rothdene-hall', 'kitchen-urn')).toBe(4);
    expect(await valueOf('rothdene-hall', 'podium')).toBe(true);

    const failed = await failure(
      admin.put('/admin/facilities/rothdene-hall/resources', {
        body: {
          values: [
            { resourceId: 'kitchen-urn', value: 6 },
            { resourceId: 'chairs', value: -1 },
          ],
        },
      }),
    );
    expect(failed.status).toBe(422);
    expect(await valueOf('rothdene-hall', 'kitchen-urn')).toBe(4);
  });

  it('answers 404 for a facility that does not exist', async () => {
    expect((await failure(admin.get('/admin/facilities/nowhere/resources'))).status).toBe(404);
  });
});

describe('permissions', () => {
  it('refuses anyone who is not an administrator', async () => {
    const applicant = as('user:applicant-thandi');
    for (const path of [
      '/admin/resources',
      '/admin/resource-allocations',
      '/admin/facilities/rothdene-hall/resources',
    ]) {
      expect((await failure(applicant.get(path))).status).toBe(403);
    }
    expect(
      (await failure(applicant.put('/admin/resource-allocations', { body: { changes: [] } })))
        .status,
    ).toBe(403);
  });
});

describe('what the browse filters and the booking form see', () => {
  it('derive a facility’s amenities from what it holds, and the vocabulary from all of them', async () => {
    const before = await admin.get<FacilityFilterOptions>('/facilities/filter-options');
    expect(before.amenities.map((a) => a.id).sort()).toEqual([
      'chairs',
      'kitchen',
      'podium',
      'sound-system',
      'stage',
      'tables',
    ]);
    expect((await detail('city-hall')).amenities.map((a) => a.id)).toContain('podium');

    await save([{ facilityId: 'city-hall', resourceId: 'podium', value: false }]);
    expect((await detail('city-hall')).amenities.map((a) => a.id)).not.toContain('podium');
    expect((await detail('loch-wing')).amenities.map((a) => a.id)).toContain('podium');

    // A venue with no kitchen resource left has no kitchen amenity.
    const kitchen = (await matrix({ facilityId: 'rothdene-hall', category: 'kitchen' }))
      .allocations;
    await save(kitchen.map((a) => ({ ...a, value: 0 })));
    expect((await detail('rothdene-hall')).amenities.map((a) => a.id)).not.toContain('kitchen');
  });

  it('give the booking form a flag for what is counted', async () => {
    const { resources } = await options();
    expect(resources.find((r) => r.id === 'stage')?.quantified).toBe(false);
    expect(resources.find((r) => r.id === 'chairs')?.quantified).toBe(true);
  });
});
