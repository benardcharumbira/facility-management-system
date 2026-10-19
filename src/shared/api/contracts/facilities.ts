import type { Paginated } from '@/shared/types/pagination';

/**
 * Contract for facility browsing. This file is the specification handed to the backend:
 * the MSW handlers implement it and the client is written against it.
 *
 * Collection envelope (all collection endpoints): `Paginated<T>`
 * `{ items, page, pageSize, totalItems, totalPages }`, with `totalPages: 0` when empty.
 */

export const FACILITY_SORTS = [
  'name',
  '-name',
  'capacity',
  '-capacity',
  'type',
  'locality',
] as const;
export type FacilitySort = (typeof FACILITY_SORTS)[number];

/** `all` returns active and unavailable facilities together. */
export const FACILITY_STATUS_FILTERS = ['active', 'unavailable', 'all'] as const;
export type FacilityStatusFilter = (typeof FACILITY_STATUS_FILTERS)[number];

export type FacilityStatus = 'active' | 'unavailable';

export const FACILITY_LIST_DEFAULTS = {
  status: 'active',
  sort: 'name',
  page: 1,
  pageSize: 24,
  maxPageSize: 100,
} as const satisfies {
  status: FacilityStatusFilter;
  sort: FacilitySort;
  page: number;
  pageSize: number;
  maxPageSize: number;
};

export interface FacilitySummary {
  id: string;
  name: string;
  code: string;
  type: { id: string; name: string };
  /** Set on child facilities (e.g. a wing or committee room inside a civic centre). */
  parentFacility: { id: string; name: string } | null;
  /** Null where capacity does not apply (e.g. open spaces). */
  capacity: number | null;
  /** Display name of the suburb or area. Filter by the id from `filter-options`. */
  locality: string;
  shortDescription: string;
  primaryImageUrl: string | null;
  amenities: Array<{ id: string; name: string }>;
  status: FacilityStatus;
  /**
   * MOCK DATA ONLY. Names the fields on this record that were invented or inferred rather than
   * supplied by the client. The real API never sends it; the development banner keys off it.
   */
  provisionalFields?: string[];
}

/**
 * `GET /api/facilities`. Every parameter is optional.
 *
 * Different groups combine with AND. Within a group: `type` and `locality` are OR,
 * `amenities` is AND (all must be present). Array parameters are sent repeated
 * (`type=a&type=b`). `q` is split on whitespace and every word must match one of
 * name, code, short description or locality (case insensitive substring).
 * `minCapacity` / `maxCapacity` are inclusive and exclude facilities with null capacity.
 *
 * Reserved for the availability slice, not yet implemented and to be ignored by the
 * backend until then: `availableFrom` and `availableTo` (ISO 8601 instants with offset).
 */
export interface FacilityListParams {
  q?: string;
  type?: string[];
  locality?: string[];
  minCapacity?: number;
  maxCapacity?: number;
  amenities?: string[];
  /** Default `active`. */
  status?: FacilityStatusFilter;
  /** Default `name`. Facilities with null capacity sort last in both directions. */
  sort?: FacilitySort;
  /** 1 based. Default 1. */
  page?: number;
  /** Default 24, maximum 100. */
  pageSize?: number;
}

export type FacilityListResponse = Paginated<FacilitySummary>;

export interface FilterOption {
  id: string;
  name: string;
  /** Number of active facilities with this value across the whole catalogue. */
  count: number;
}

/** `GET /api/facilities/filter-options`. Counts ignore any currently applied filters. */
export interface FacilityFilterOptions {
  types: FilterOption[];
  localities: FilterOption[];
  amenities: Array<{ id: string; name: string }>;
  capacity: { min: number; max: number };
}

export interface FacilityImage {
  url: string;
  /** Meaningful alternative text, written by the facility administrator. */
  alt: string;
}

/**
 * `GET /api/facilities/{id}`. The summary plus everything needed to decide whether to book.
 * Responds 404 with problem details when the id is unknown.
 */
export interface FacilityDetail extends FacilitySummary {
  /** Full description, paragraphs separated by a blank line. */
  description: string;
  /** Ordered gallery. The first entry matches `primaryImageUrl`. May be empty. */
  images: FacilityImage[];
  address: string | null;
  /** Facilities whose `parentFacility` is this one. Empty for most facilities. */
  childFacilities: Array<Pick<FacilitySummary, 'id' | 'name' | 'type' | 'capacity' | 'status'>>;
}
