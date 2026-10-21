import type { DateTime } from 'luxon';
import { HttpResponse, http, delay } from 'msw';
import {
  FACILITY_LIST_DEFAULTS,
  FACILITY_SORTS,
  FACILITY_STATUS_FILTERS,
  type FacilityFilterOptions,
  type FacilityListParams,
  type FacilityListResponse,
  type FacilitySort,
  type FacilityStatusFilter,
  type FacilitySummary,
} from '@/shared/api';
import { REAL_FACILITIES } from './data/facilities.real';
import { VOLUME_FACILITIES } from './data/facilities.volume';
import { bufferOf, createAvailabilityHandlers } from './availability';
import { createAdminFacilityHandlers } from './adminFacilities';
import { createAdminResourceHandlers } from './adminResources';
import { createApprovalHandlers } from './approvals';
import { createBookingHandlers } from './bookings';
import { bookingStore } from './data/bookingStore';
import { facilityStore } from './data/facilityStore';
import { slugify } from './data/slug';

/** The server side behaviour the real backend must reproduce. See the contract in shared/api. */
export function queryFacilities(
  catalogue: readonly FacilitySummary[],
  params: FacilityListParams,
): FacilityListResponse {
  const {
    q = '',
    type = [],
    locality = [],
    minCapacity,
    maxCapacity,
    amenities = [],
    status = FACILITY_LIST_DEFAULTS.status,
    sort = FACILITY_LIST_DEFAULTS.sort,
    page = FACILITY_LIST_DEFAULTS.page,
    pageSize = FACILITY_LIST_DEFAULTS.pageSize,
  } = params;

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);

  const matches = catalogue.filter((facility) => {
    if (status !== 'all' && facility.status !== status) return false;
    if (type.length > 0 && !type.includes(facility.type.id)) return false;
    if (locality.length > 0 && !locality.includes(slugify(facility.locality))) return false;
    if (minCapacity !== undefined && (facility.capacity ?? -1) < minCapacity) return false;
    if (maxCapacity !== undefined && (facility.capacity ?? Infinity) > maxCapacity) return false;
    if (!amenities.every((id) => facility.amenities.some((a) => a.id === id))) return false;
    if (words.length > 0) {
      const haystack = [facility.name, facility.code, facility.shortDescription, facility.locality]
        .join(' ')
        .toLowerCase();
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  });

  const sorted = [...matches].sort(comparatorFor(sort));
  const size = Math.min(FACILITY_LIST_DEFAULTS.maxPageSize, Math.max(1, pageSize));
  const current = Math.max(1, page);
  const start = (current - 1) * size;

  return {
    items: sorted.slice(start, start + size),
    page: current,
    pageSize: size,
    totalItems: sorted.length,
    totalPages: Math.ceil(sorted.length / size),
  };
}

function comparatorFor(sort: FacilitySort) {
  const byName = (a: FacilitySummary, b: FacilitySummary) =>
    a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  const capacity = (direction: 1 | -1) => (a: FacilitySummary, b: FacilitySummary) => {
    if (a.capacity === null && b.capacity === null) return byName(a, b);
    if (a.capacity === null) return 1;
    if (b.capacity === null) return -1;
    return direction * (a.capacity - b.capacity) || byName(a, b);
  };
  switch (sort) {
    case 'name':
      return byName;
    case '-name':
      return (a: FacilitySummary, b: FacilitySummary) => byName(b, a);
    case 'capacity':
      return capacity(1);
    case '-capacity':
      return capacity(-1);
    case 'type':
      return (a: FacilitySummary, b: FacilitySummary) =>
        a.type.name.localeCompare(b.type.name) || byName(a, b);
    case 'locality':
      return (a: FacilitySummary, b: FacilitySummary) =>
        a.locality.localeCompare(b.locality) || byName(a, b);
  }
}

/** The vocabulary and counts come from the catalogue itself, so they always match the data. */
export function buildFilterOptions(catalogue: readonly FacilitySummary[]): FacilityFilterOptions {
  const active = catalogue.filter((facility) => facility.status === 'active');
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

  const types = new Map(catalogue.map((f) => [f.type.id, f.type.name]));
  const localities = new Map(catalogue.map((f) => [slugify(f.locality), f.locality]));
  const amenities = new Map(
    catalogue.flatMap((f) => f.amenities.map((a) => [a.id, a.name] as const)),
  );
  const capacities = catalogue.flatMap((f) => (f.capacity === null ? [] : [f.capacity]));

  return {
    types: [...types]
      .map(([id, name]) => ({
        id,
        name,
        count: active.filter((f) => f.type.id === id).length,
      }))
      .sort(byName),
    localities: [...localities]
      .map(([id, name]) => ({
        id,
        name,
        count: active.filter((f) => slugify(f.locality) === id).length,
      }))
      .sort(byName),
    amenities: [...amenities].map(([id, name]) => ({ id, name })).sort(byName),
    capacity: capacities.length
      ? { min: Math.min(...capacities), max: Math.max(...capacities) }
      : { min: 0, max: 0 },
  };
}

class BadQuery extends Error {}

function parseInteger(searchParams: URLSearchParams, name: string): number | undefined {
  const raw = searchParams.get(name);
  if (raw === null) return undefined;
  if (!/^\d+$/.test(raw)) throw new BadQuery(`"${name}" must be a non-negative integer.`);
  return Number(raw);
}

function parseEnum<T extends string>(
  searchParams: URLSearchParams,
  name: string,
  allowed: readonly T[],
): T | undefined {
  const raw = searchParams.get(name);
  if (raw === null) return undefined;
  const match = allowed.find((value) => value === raw);
  if (match === undefined) throw new BadQuery(`"${name}" must be one of: ${allowed.join(', ')}.`);
  return match;
}

export function parseFacilityParams(searchParams: URLSearchParams): FacilityListParams {
  return {
    q: searchParams.get('q') ?? undefined,
    type: searchParams.getAll('type'),
    locality: searchParams.getAll('locality'),
    minCapacity: parseInteger(searchParams, 'minCapacity'),
    maxCapacity: parseInteger(searchParams, 'maxCapacity'),
    amenities: searchParams.getAll('amenities'),
    status: parseEnum<FacilityStatusFilter>(searchParams, 'status', FACILITY_STATUS_FILTERS),
    sort: parseEnum<FacilitySort>(searchParams, 'sort', FACILITY_SORTS),
    page: parseInteger(searchParams, 'page'),
    pageSize: parseInteger(searchParams, 'pageSize'),
  };
}

function problem(status: number, title: string, detail?: string) {
  return HttpResponse.json(
    { type: 'about:blank', title, status, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export type MockScenario = 'empty' | 'error' | 'conflict' | undefined;
export type MockDatasetName = 'real' | 'volume';

export const DATASETS: Record<MockDatasetName, readonly FacilitySummary[]> = {
  real: REAL_FACILITIES,
  volume: VOLUME_FACILITIES,
};

export interface FacilityHandlerOptions {
  delayMs: number;
  /** Which fixture to serve. Defaults to the confirmed Midvaal venues. */
  dataset?: MockDatasetName;
  /** The current instant for the availability calendar. Defaults to real time. */
  now?: () => DateTime;
  /**
   * Lets a reviewer force a state, e.g. from the page URL in development. `empty` serves an
   * empty catalogue, `error` fails every facilities request.
   */
  getScenario?: () => MockScenario;
}

export function createFacilityHandlers(
  root: string,
  { delayMs, getScenario, dataset = 'real', now }: FacilityHandlerOptions,
) {
  /** Loads this set of handlers' fixture if a different one is in the store. */
  const ready = () => facilityStore.ensure(dataset, DATASETS[dataset]);
  ready();
  /** The public estate: what browsing, availability and new bookings see. Archived facilities are gone. */
  const catalogue = () => {
    ready();
    return getScenario?.() === 'empty' ? [] : facilityStore.publicCatalogue();
  };
  const settings = (id: string) => {
    ready();
    return facilityStore.settingsOf(id);
  };
  const wait = () => (delayMs > 0 ? delay(delayMs) : Promise.resolve());

  return [
    ...createAvailabilityHandlers(root, {
      delayMs,
      catalogue,
      fail: () => getScenario?.() === 'error',
      now,
      extraBookings: () => bookingStore.holds(undefined, bufferOf(settings)),
      settings,
    }),
    ...createBookingHandlers(root, {
      delayMs,
      catalogue,
      now,
      forceConflict: () => getScenario?.() === 'conflict',
      empty: () => getScenario?.() === 'empty',
      fail: () => getScenario?.() === 'error',
      settings,
    }),

    ...createApprovalHandlers(root, {
      delayMs,
      // Archived facilities still have bookings to decide.
      catalogue: () => {
        ready();
        return facilityStore.allSummaries();
      },
      now,
      empty: () => getScenario?.() === 'empty',
      fail: () => getScenario?.() === 'error',
    }),

    ...createAdminFacilityHandlers(root, {
      delayMs,
      now,
      ready,
      fail: () => getScenario?.() === 'error',
    }),

    ...createAdminResourceHandlers(root, {
      delayMs,
      now,
      ready,
      fail: () => getScenario?.() === 'error',
    }),

    http.get(`${root}/facilities/filter-options`, async () => {
      await wait();
      if (getScenario?.() === 'error') return problem(500, 'Mock failure');
      return HttpResponse.json(buildFilterOptions(catalogue()));
    }),

    http.get(`${root}/facilities`, async ({ request }) => {
      await wait();
      if (getScenario?.() === 'error') {
        return problem(500, 'Mock failure', 'The facilities service is unavailable.');
      }
      try {
        const params = parseFacilityParams(new URL(request.url).searchParams);
        return HttpResponse.json(queryFacilities(catalogue(), params));
      } catch (error) {
        if (error instanceof BadQuery) return problem(400, 'Invalid query', error.message);
        throw error;
      }
    }),

    http.get(`${root}/facilities/:id`, async ({ params }) => {
      await wait();
      if (getScenario?.() === 'error') return problem(500, 'Mock failure');
      const detail =
        getScenario?.() === 'empty'
          ? undefined
          : (ready(), facilityStore.publicDetail(String(params.id)));
      return detail
        ? HttpResponse.json(detail)
        : problem(404, 'Facility not found', 'No facility exists with that id.');
    }),
  ];
}
