import { describe, expect, it } from 'vitest';
import {
  createApiClient,
  type FacilityDetail,
  type FacilityFilterOptions,
  type FacilityListResponse,
} from '@/shared/api';
import { server, TEST_API_BASE_URL } from './server';
import { REAL_FACILITIES } from './data/facilities.real';
import { VOLUME_FACILITIES } from './data/facilities.volume';
import { buildFilterOptions, createFacilityHandlers, queryFacilities } from './facilities';

const client = createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => null });
const list = (query: Record<string, string | number | string[]>) =>
  client.get<FacilityListResponse>('/facilities', { query });
const names = (r: FacilityListResponse) => r.items.map((f) => f.name);

const useVolume = () =>
  server.use(...createFacilityHandlers(TEST_API_BASE_URL, { delayMs: 0, dataset: 'volume' }));

describe('GET /facilities against the Midvaal venues', () => {
  it('returns all twelve, name ascending, in the standard envelope', async () => {
    const result = await list({});
    expect(result).toMatchObject({ page: 1, pageSize: 24, totalItems: 12, totalPages: 1 });
    expect(names(result)).toEqual([
      'Activity Room',
      'Bantu Bonke Hall',
      'City Hall',
      'City Hall Committee Room',
      'Council Chambers',
      'Lakeside Hall',
      'Loch Wing',
      'Mitchell Wing',
      'Rothdene Hall',
      'Sicelo Hall',
      'Vaal Marina Board Room',
      'Vaal Marina Hall',
    ]);
  });

  it('combines two filter groups with search', async () => {
    const result = await list({
      type: ['hall', 'hall-wing'],
      locality: ['meyerton', 'vaal-marina'],
      q: 'wing',
    });
    expect(names(result)).toEqual(['Loch Wing', 'Mitchell Wing']);
  });

  it('searches name, code and locality, every word must match', async () => {
    expect(names(await list({ q: 'marina' }))).toEqual([
      'Vaal Marina Board Room',
      'Vaal Marina Hall',
    ]);
    expect(names(await list({ q: 'LOCH-WING' }))).toEqual(['Loch Wing']);
    expect(names(await list({ q: 'rothdene hall' }))).toEqual(['Rothdene Hall']);
    expect((await list({ q: 'meyerton' })).totalItems).toBe(5);
    expect((await list({ q: 'meyerton rothdene' })).totalItems).toBe(0);
  });

  it('ANDs amenities and ORs within type', async () => {
    const result = await list({ amenities: ['stage', 'kitchen'] });
    expect(names(result)).not.toContain('Loch Wing');
    expect(names(result)).toEqual(
      expect.arrayContaining(['City Hall', 'Rothdene Hall', 'Sicelo Hall']),
    );
    for (const f of result.items) {
      expect(f.amenities.map((a) => a.id)).toEqual(expect.arrayContaining(['stage', 'kitchen']));
    }
    const types = await list({ type: ['board-room', 'council-chamber'] });
    expect(names(types)).toEqual(['Council Chambers', 'Vaal Marina Board Room']);
  });

  it('filters capacity inclusively', async () => {
    const result = await list({ minCapacity: 20, maxCapacity: 150 });
    expect(result.items.map((f) => f.capacity).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
      20, 40, 60, 150, 150,
    ]);
  });

  it('honours the status filter', async () => {
    expect((await list({ status: 'all' })).totalItems).toBe(12);
    expect((await list({ status: 'unavailable' })).totalItems).toBe(0);
  });

  it('sorts by capacity, type and locality', async () => {
    expect(names(await list({ sort: 'capacity' }))[0]).toBe('Vaal Marina Board Room');
    expect(names(await list({ sort: '-capacity' }))[0]).toBe('City Hall');
    const byType = (await list({ sort: 'type' })).items.map((f) => f.type.name);
    expect(byType).toEqual([...byType].sort((a, b) => a.localeCompare(b)));
    const byLocality = (await list({ sort: 'locality' })).items.map((f) => f.locality);
    expect(byLocality).toEqual([...byLocality].sort((a, b) => a.localeCompare(b)));
  });

  it('reports totalPages 0 when nothing matches, and rejects invalid parameters', async () => {
    expect(await list({ q: 'zzzzzz' })).toMatchObject({ items: [], totalItems: 0, totalPages: 0 });
    await expect(list({ sort: 'size' })).rejects.toMatchObject({
      status: 400,
      title: 'Invalid query',
    });
    await expect(list({ page: 'x' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('GET /facilities against the volume fixture', () => {
  it('paginates and clamps page size', async () => {
    useVolume();
    const first = await list({ pageSize: 10, page: 1 });
    const last = await list({ pageSize: 10, page: 7 });
    expect(first).toMatchObject({ totalItems: 66, totalPages: 7, pageSize: 10 });
    expect(first.items).toHaveLength(10);
    expect(last.items).toHaveLength(6);
    expect(new Set([...first.items, ...last.items].map((f) => f.id)).size).toBe(16);
    expect((await list({ pageSize: 1000 })).pageSize).toBe(100);
    expect((await list({ pageSize: 10, page: 99 })).items).toEqual([]);
  });

  it('sorts null capacity last in both directions', async () => {
    for (const sort of ['capacity', '-capacity']) {
      const { items } = await queryFacilitiesAll(sort);
      const caps = items.map((f) => f.capacity);
      const firstNull = caps.indexOf(null);
      expect(firstNull).toBeGreaterThan(-1);
      expect(caps.slice(firstNull).every((c) => c === null)).toBe(true);
      const real = caps.slice(0, firstNull) as number[];
      expect(real).toEqual([...real].sort((a, b) => (sort === 'capacity' ? a - b : b - a)));
    }
  });

  it('excludes null capacity from a capacity filter', () => {
    const result = queryFacilities(VOLUME_FACILITIES, {
      minCapacity: 0,
      status: 'all',
      pageSize: 100,
    });
    expect(result.items.every((f) => f.capacity !== null)).toBe(true);
    expect(result.totalItems).toBeLessThan(VOLUME_FACILITIES.length);
  });
});

function queryFacilitiesAll(sort: string) {
  return queryFacilities(VOLUME_FACILITIES, {
    sort: sort as 'capacity',
    pageSize: 100,
    status: 'all',
  });
}

describe('GET /facilities/filter-options', () => {
  it('derives types, localities, amenities and capacity bounds from the Midvaal venues', async () => {
    const options = await client.get<FacilityFilterOptions>('/facilities/filter-options');
    expect(options.types).toEqual([
      { id: 'activity-room', name: 'Activity room', count: 1 },
      { id: 'board-room', name: 'Board room', count: 1 },
      { id: 'civic-hall', name: 'Civic hall', count: 1 },
      { id: 'committee-room', name: 'Committee room', count: 1 },
      { id: 'council-chamber', name: 'Council chamber', count: 1 },
      { id: 'hall', name: 'Hall', count: 5 },
      { id: 'hall-wing', name: 'Hall wing', count: 2 },
    ]);
    expect(options.localities.map((l) => [l.name, l.count])).toEqual([
      ['Lakeside', 1],
      ['Meyerton', 5],
      ['Rothdene', 1],
      ['Sicelo', 1],
      ['To be confirmed', 2],
      ['Vaal Marina', 2],
    ]);
    expect(options.amenities.map((a) => a.name)).toEqual([
      'Chairs',
      'Kitchen',
      'Podium',
      'Sound system',
      'Stage',
      'Tables',
    ]);
    expect(options.capacity).toEqual({ min: 14, max: 500 });
  });

  it('reflects whichever fixture is active', () => {
    const options = buildFilterOptions(VOLUME_FACILITIES);
    expect(options.localities.map((l) => l.name)).toContain('Fictionville');
    expect(options.localities.map((l) => l.name)).not.toContain('Meyerton');
    expect(buildFilterOptions([]).capacity).toEqual({ min: 0, max: 0 });
  });
});

describe('GET /facilities/:id', () => {
  it('resolves every Midvaal venue, with children for a parent and no invented address', async () => {
    for (const venue of REAL_FACILITIES) {
      const detail = await client.get<FacilityDetail>(`/facilities/${venue.id}`);
      expect(detail.name).toBe(venue.name);
      expect(detail.address).toBeNull();
      expect(detail.images).toEqual([]);
    }
    const cityHall = await client.get<FacilityDetail>('/facilities/city-hall');
    expect(cityHall.childFacilities.map((c) => c.name).sort()).toEqual([
      'City Hall Committee Room',
      'Loch Wing',
      'Mitchell Wing',
    ]);
    await expect(client.get('/facilities/nope')).rejects.toMatchObject({ status: 404 });
  });
});
