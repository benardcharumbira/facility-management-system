import { describe, expect, it } from 'vitest';
import {
  createApiClient,
  type FacilityDetail,
  type FacilityFilterOptions,
  type FacilityListResponse,
} from '@/shared/api';
import { FACILITY_FIXTURES } from './data/facilities';
import { queryFacilities } from './facilities';
import { TEST_API_BASE_URL } from './server';

const client = createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => null });
const list = (query: Record<string, string | number | string[]>) =>
  client.get<FacilityListResponse>('/facilities', { query });

describe('facilities fixture', () => {
  it('covers the required shapes', () => {
    expect(FACILITY_FIXTURES.length).toBeGreaterThanOrEqual(28);
    expect(new Set(FACILITY_FIXTURES.map((f) => f.type.id)).size).toBe(8);
    expect(FACILITY_FIXTURES.some((f) => f.primaryImageUrl === null)).toBe(true);
    expect(
      FACILITY_FIXTURES.filter((f) => f.status === 'unavailable').length,
    ).toBeGreaterThanOrEqual(2);
    expect(FACILITY_FIXTURES.some((f) => f.capacity === null)).toBe(true);
    const parents = FACILITY_FIXTURES.filter((f) => f.parentFacility).map(
      (f) => f.parentFacility?.id,
    );
    expect(parents.length).toBeGreaterThanOrEqual(3);
    for (const id of parents) expect(FACILITY_FIXTURES.some((f) => f.id === id)).toBe(true);
  });
});

describe('GET /facilities (mock server side behaviour)', () => {
  it('returns active facilities by default, name ascending, in the standard envelope', async () => {
    const result = await list({});
    const active = FACILITY_FIXTURES.filter((f) => f.status === 'active');
    expect(result).toMatchObject({ page: 1, pageSize: 24, totalItems: active.length });
    expect(result.totalPages).toBe(Math.ceil(active.length / 24));
    const names = result.items.map((f) => f.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(result.items.every((f) => f.status === 'active')).toBe(true);
  });

  it('combines two filter groups with search', async () => {
    const result = await list({
      type: ['community-hall', 'civic-hall'],
      locality: ['hillcrest', 'central'],
      q: 'kitchen',
    });
    expect(result.items.length).toBeGreaterThan(0);
    for (const f of result.items) {
      expect(['community-hall', 'civic-hall']).toContain(f.type.id);
      expect(['Hillcrest', 'Central']).toContain(f.locality);
      expect(`${f.name} ${f.code} ${f.shortDescription} ${f.locality}`.toLowerCase()).toContain(
        'kitchen',
      );
    }
    // Hillcrest Community Hall's description mentions the kitchen; Civic Centre West Wing's does not.
    expect(result.items.map((f) => f.code)).toContain('HC-HALL');
    expect(result.items.map((f) => f.code)).not.toContain('CC-WEST');
  });

  it('ANDs amenities and ORs within type', async () => {
    const both = await list({ amenities: ['stage', 'kitchen'], pageSize: 100 });
    expect(both.items.length).toBeGreaterThan(0);
    for (const f of both.items) {
      const ids = f.amenities.map((a) => a.id);
      expect(ids).toEqual(expect.arrayContaining(['stage', 'kitchen']));
    }
    const types = await list({ type: ['court', 'swimming-pool'], status: 'all', pageSize: 100 });
    expect(new Set(types.items.map((f) => f.type.id))).toEqual(new Set(['court', 'swimming-pool']));
  });

  it('filters capacity inclusively and excludes null capacity', async () => {
    const result = await list({ minCapacity: 20, maxCapacity: 60, status: 'all', pageSize: 100 });
    expect(result.items.length).toBeGreaterThan(0);
    for (const f of result.items) {
      expect(f.capacity).not.toBeNull();
      expect(f.capacity).toBeGreaterThanOrEqual(20);
      expect(f.capacity).toBeLessThanOrEqual(60);
    }
    expect(result.items.map((f) => f.capacity)).toContain(20);
    expect(result.items.map((f) => f.capacity)).toContain(60);
  });

  it('honours the status filter', async () => {
    const all = await list({ status: 'all', pageSize: 100 });
    const unavailable = await list({ status: 'unavailable', pageSize: 100 });
    expect(all.totalItems).toBe(FACILITY_FIXTURES.length);
    expect(unavailable.items.every((f) => f.status === 'unavailable')).toBe(true);
    expect(unavailable.totalItems).toBeGreaterThanOrEqual(2);
  });

  it('sorts by capacity with null capacity last in both directions', async () => {
    for (const sort of ['capacity', '-capacity']) {
      const { items } = await list({ sort, pageSize: 100 });
      const caps = items.map((f) => f.capacity);
      const firstNull = caps.indexOf(null);
      expect(firstNull).toBeGreaterThan(-1);
      expect(caps.slice(firstNull).every((c) => c === null)).toBe(true);
      const real = caps.slice(0, firstNull) as number[];
      const expected = [...real].sort((a, b) => (sort === 'capacity' ? a - b : b - a));
      expect(real).toEqual(expected);
    }
  });

  it('sorts by type and locality', async () => {
    const byType = await list({ sort: 'type', pageSize: 100 });
    const typeNames = byType.items.map((f) => f.type.name);
    expect(typeNames).toEqual([...typeNames].sort((a, b) => a.localeCompare(b)));
    const byLocality = await list({ sort: 'locality', pageSize: 100 });
    const localities = byLocality.items.map((f) => f.locality);
    expect(localities).toEqual([...localities].sort((a, b) => a.localeCompare(b)));
  });

  it('paginates and clamps page size', async () => {
    const first = await list({ pageSize: 10, page: 1 });
    const second = await list({ pageSize: 10, page: 2 });
    expect(first.items).toHaveLength(10);
    expect(second.page).toBe(2);
    expect(new Set([...first.items, ...second.items].map((f) => f.id)).size).toBe(20);
    expect((await list({ pageSize: 1000 })).pageSize).toBe(100);
    const beyond = await list({ pageSize: 10, page: 99 });
    expect(beyond.items).toEqual([]);
    expect(beyond.totalItems).toBe(first.totalItems);
  });

  it('reports totalPages 0 when nothing matches', async () => {
    expect(await list({ q: 'zzzzzz' })).toMatchObject({ items: [], totalItems: 0, totalPages: 0 });
  });

  it('rejects invalid parameters with problem details', async () => {
    await expect(list({ sort: 'size' })).rejects.toMatchObject({
      status: 400,
      title: 'Invalid query',
    });
    await expect(list({ page: 'x' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('GET /facilities/:id', () => {
  it('returns the detail with children for a parent and 404 for an unknown id', async () => {
    const detail = await client.get<FacilityDetail>('/facilities/fac-cc-main');
    expect(detail.childFacilities.map((c) => c.id).sort()).toEqual([
      'fac-cc-cr1',
      'fac-cc-east',
      'fac-cc-west',
    ]);
    expect(detail.images.length).toBeGreaterThan(0);
    await expect(client.get('/facilities/nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('GET /facilities/filter-options', () => {
  it('returns counts, amenities and capacity bounds from the catalogue', async () => {
    const options = await client.get<FacilityFilterOptions>('/facilities/filter-options');
    expect(options.types.length).toBe(8);
    expect(options.types.reduce((sum, t) => sum + t.count, 0)).toBe(
      queryFacilities(FACILITY_FIXTURES, { pageSize: 100 }).totalItems,
    );
    expect(options.localities.map((l) => l.id)).toContain('old-town');
    expect(options.amenities).toHaveLength(9);
    expect(options.capacity).toEqual({ min: 4, max: 1000 });
  });
});
