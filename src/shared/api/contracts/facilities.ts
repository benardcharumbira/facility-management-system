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
  caption: string | null;
}

export interface CapacityByArrangement {
  /** For example cinema, school room, banquet, u-shape. Matches the booking form's choices. */
  arrangement: string;
  capacity: number;
}

export interface FacilityResource {
  id: string;
  name: string;
  /** `kitchen` items are itemised and long; the UI collapses them. */
  category: 'venue' | 'kitchen';
  /** Null where the quantity is not known or not meaningful. 1 for a resource that is simply present. */
  quantity: number | null;
  /** False for a resource that is present or absent, like a stage, where a count means nothing. */
  quantified: boolean;
}

/** One entry per day. `opensAt` and `closesAt` are null when closed. */
export interface OperatingDay {
  /** 1 Monday through 7 Sunday. */
  dayOfWeek: number;
  /** HH:mm, 24 hour, in the facility's local time (Africa/Johannesburg). */
  opensAt: string | null;
  closesAt: string | null;
}

/**
 * `GET /api/facilities/{id}`. The summary plus everything needed to decide whether this venue
 * suits an event. Responds 404 with an RFC 7807 problem document for an unknown id.
 *
 * Hierarchy: `parentFacility` (from the summary) is set on a space inside a larger venue.
 * `childFacilities` lists the separately bookable spaces inside this venue. `siblingFacilities`
 * lists the other children of the same parent, excluding this facility, and is empty for a
 * standalone venue. Booking a parent venue takes all of its children.
 */
export interface FacilityDetail extends FacilitySummary {
  /** Full text, not the short form. Paragraphs are separated by a blank line. */
  description: string;
  /** Ordered gallery. May be empty, in which case the UI shows a type based placeholder. */
  images: FacilityImage[];
  /** Null when seating arrangements do not apply (fixed seating, open space). */
  capacityByArrangement: CapacityByArrangement[] | null;
  resources: FacilityResource[];
  operatingSchedule: OperatingDay[];
  childFacilities: Array<{ id: string; name: string; type: string; capacity: number | null }>;
  siblingFacilities: Array<{ id: string; name: string; type: string }>;
  /** The responsible municipal department. */
  managedBy: string;
  /** Conditions the applicant should know up front. */
  bookingNotes: string | null;
  /** Always present on the detail shape; empty when nothing is provisional. */
  provisionalFields: string[];
}
