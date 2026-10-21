/**
 * Contract for facility administration. This file is the specification handed to the backend: the
 * MSW handlers implement it and the client is written against it.
 *
 * ```
 * GET    /api/admin/facilities                          all, including archived (filters, sort, envelope)
 * POST   /api/admin/facilities                          create; always starts unavailable
 * GET    /api/admin/facilities/{id}                     everything the edit screen needs
 * PATCH  /api/admin/facilities/{id}                     details and parent; partial
 * POST   /api/admin/facilities/{id}/impact              preview the effect of a proposed change
 * POST   /api/admin/facilities/{id}/archive
 * POST   /api/admin/facilities/{id}/restore
 * PUT    /api/admin/facilities/{id}/schedule
 * GET    /api/admin/facilities/{id}/blackouts
 * POST   /api/admin/facilities/{id}/blackouts
 * DELETE /api/admin/facilities/{id}/blackouts/{blackoutId}
 * POST   /api/admin/facilities/{id}/images              multipart: "file" and "caption"
 * PATCH  /api/admin/facilities/{id}/images/{imageId}    caption, position, primary
 * DELETE /api/admin/facilities/{id}/images/{imageId}
 * PUT    /api/admin/facilities/{id}/capacity
 * PUT    /api/admin/facilities/{id}/approvers
 * GET    /api/admin/facility-types
 * POST   /api/admin/facility-types
 * PATCH  /api/admin/facility-types/{id}
 * GET    /api/admin/approver-candidates                 users who can be designated (an addition)
 * ```
 *
 * **Permissions.** System administrators and facility administrators only, enforced on the server
 * from the session identity. Anyone else answers 403.
 *
 * **Impact first.** Almost every change here reaches backwards into bookings that already exist.
 * None is prevented, and none happens silently: the client posts the proposed change to `impact`,
 * and if `totalAffected` is not zero it shows the bookings and asks for explicit confirmation
 * before making the change in a second call. The impact check decides nothing, cancels nothing and
 * notifies nobody. Only approved and pending bookings that have not yet ended are considered.
 *
 * **Containment.** Booking a parent blocks every child, and booking any child blocks the parent.
 * A facility cannot be its own ancestor: `eligibleParents` leaves those out, and the server
 * refuses a cycle with 422 regardless.
 *
 * **No hard delete.** A facility carries booking history, so it is archived, never deleted.
 * Archived facilities are absent from the public estate and from new bookings, and can be restored.
 *
 * **Approvers.** A facility needs at least one designated approver to be active, because requests
 * for it otherwise reach nobody. Activating one without, or removing the last approver of an
 * active one, answers 422. Facilities that already lack one are reported in the list.
 *
 * **Time.** Instants are UTC ISO 8601; dates and HH:mm times are in the facility time zone.
 * Validation failures are 422 problem documents with field level `errors`.
 */
import type { Paginated } from '@/shared/types/pagination';
import type { CapacityByArrangement, OperatingDay } from './facilities';

export type AdminFacilityStatus = 'active' | 'unavailable' | 'archived';
export const ADMIN_FACILITY_STATUSES: readonly AdminFacilityStatus[] = [
  'active',
  'unavailable',
  'archived',
];

export interface FacilityType {
  id: string;
  name: string;
  /** Whether a facility of this type has a capacity at all. Open spaces may not. */
  capacityApplies: boolean;
  facilityCount: number;
}

export interface CreateFacilityTypeRequest {
  name: string;
  capacityApplies: boolean;
}
export type UpdateFacilityTypeRequest = Partial<CreateFacilityTypeRequest>;

/** Whether a facility contains others (`parent`), sits inside one (`child`), or neither. */
export type FacilityStructure = 'parent' | 'child' | 'standalone';

export interface AdminFacilityRow {
  id: string;
  name: string;
  code: string;
  type: { id: string; name: string };
  locality: string;
  status: AdminFacilityStatus;
  parentFacility: { id: string; name: string } | null;
  childCount: number;
  /**
   * Nesting within the rows returned, for indentation. A child whose parent is not in the result
   * (filtered out) is shown at depth 0 and still names its parent.
   */
  depth: number;
  /** Approved and pending bookings that have not yet ended. */
  futureBookings: number;
  /** A blackout, this facility's own or inherited from a parent, is in effect now. */
  blackoutActive: boolean;
  approverCount: number;
}

export const ADMIN_FACILITY_SORTS = [
  'hierarchy',
  'name',
  'type',
  'locality',
  'status',
  '-futureBookings',
] as const;
export type AdminFacilitySort = (typeof ADMIN_FACILITY_SORTS)[number];

/**
 * `GET /api/admin/facilities`. All optional. `q` matches name, code and locality (every word).
 * Archived facilities are left out unless `status` includes `archived`. Groups combine with AND,
 * values within a group with OR. The default sort, `hierarchy`, lists each parent followed by its
 * children; every other sort is flat.
 */
export interface AdminFacilityListParams {
  q?: string;
  type?: string[];
  locality?: string[];
  status?: AdminFacilityStatus[];
  structure?: FacilityStructure[];
  sort?: AdminFacilitySort;
  page?: number;
  pageSize?: number;
}

export interface AdminFacilityList extends Paginated<AdminFacilityRow> {
  /** Active or unavailable facilities with nobody to approve for them. Unfiltered. */
  withoutApprover: number;
  /** Every locality in use, for the filter. */
  localities: string[];
}

export interface AdminFacilityImage {
  id: string;
  url: string;
  /** Required. Used as the alternative text on the public screens. */
  caption: string;
  isPrimary: boolean;
}

export const IMAGE_RULES = {
  acceptedTypes: [
    { extension: '.jpg', contentType: 'image/jpeg', label: 'JPG' },
    { extension: '.jpeg', contentType: 'image/jpeg', label: 'JPG' },
    { extension: '.png', contentType: 'image/png', label: 'PNG' },
    { extension: '.webp', contentType: 'image/webp', label: 'WebP' },
  ],
  maxFileSizeBytes: 5 * 1024 * 1024,
  maxImages: 12,
} as const;

export interface FacilitySchedule {
  /** Seven entries, Monday (1) to Sunday (7). Closed is `opensAt` and `closesAt` both null. */
  days: OperatingDay[];
  /** Set-up time held before every booking, and clear-down time after, in minutes. */
  setupMinutes: number;
  teardownMinutes: number;
  /** A booking cannot start sooner than this many hours from now. */
  minimumNoticeHours: number;
  /** How far ahead booking is permitted, in days. */
  maximumHorizonDays: number;
}

export interface FacilityCapacity {
  /** The most the venue holds. Null where capacity does not apply or is not known. */
  maximum: number | null;
  byArrangement: CapacityByArrangement[];
}

export interface Approver {
  id: string;
  name: string;
  email: string;
}

export interface AdminFacility {
  id: string;
  name: string;
  /** The facility's own time zone: the dates and times in administration are in it. */
  timeZone: string;
  code: string;
  type: { id: string; name: string; capacityApplies: boolean };
  locality: string;
  shortDescription: string;
  description: string;
  status: AdminFacilityStatus;
  parentFacility: { id: string; name: string } | null;
  children: Array<{ id: string; name: string; status: AdminFacilityStatus }>;
  /** Where this facility could be placed: not itself, not anything inside it, not archived. */
  eligibleParents: Array<{ id: string; name: string }>;
  images: AdminFacilityImage[];
  schedule: FacilitySchedule;
  capacity: FacilityCapacity;
  approvers: Approver[];
  futureBookings: number;
  /**
   * MOCK DATA ONLY. Fields that still hold the provisional fixture values. Saving a section
   * replaces them with the municipality's real data and clears them.
   */
  provisionalFields: string[];
}

export interface FacilityDetailsInput {
  name: string;
  code: string;
  typeId: string;
  locality: string;
  shortDescription: string;
  description: string;
  /** Archiving has its own endpoint. */
  status: 'active' | 'unavailable';
  parentFacilityId: string | null;
}

/** A new facility starts `unavailable`, until it has an approver. */
export type CreateFacilityRequest = Omit<FacilityDetailsInput, 'status'>;
export type UpdateFacilityRequest = Partial<FacilityDetailsInput>;

export type BlackoutState = 'past' | 'current' | 'future';

export interface AdminBlackout {
  id: string;
  /** For a whole day closure, local midnight at the start of the first day, as an instant. */
  startsAt: string;
  /** Exclusive: local midnight after the last day for a whole day closure. */
  endsAt: string;
  allDay: boolean;
  /** Shown to the public on the availability calendar, so it reads as a sentence. */
  reason: string;
  /** Set when this blackout belongs to a parent and applies here because of it. */
  inheritedFrom: { id: string; name: string } | null;
  state: BlackoutState;
}

export interface CreateBlackoutRequest {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason: string;
}

export interface UpdateImageRequest {
  caption?: string;
  /** Only ever set to true: another image becomes primary by being set. */
  isPrimary?: true;
  /** New 0 based position in the gallery. */
  position?: number;
}

export interface SetApproversRequest {
  userIds: string[];
}

/** `GET /api/admin/approver-candidates`: who can be designated. */
export type ApproverCandidate = Approver;

// --- impact ---------------------------------------------------------------------------------------

/** What the administrator is about to do. The server works out what it would touch. */
export type ProposedChange =
  | { kind: 'status'; status: 'active' | 'unavailable' }
  | { kind: 'hierarchy'; parentFacilityId: string | null }
  | { kind: 'schedule'; schedule: FacilitySchedule }
  | { kind: 'blackout'; blackout: CreateBlackoutRequest }
  | { kind: 'capacity'; capacity: FacilityCapacity }
  | { kind: 'archive' }
  /** Edits that reach no booking (the name, the images). Always affects nothing. */
  | { kind: 'details' };

export type ImpactReason =
  | 'inside_blackout'
  | 'outside_operating_hours'
  | 'new_conflict'
  | 'over_capacity'
  | 'facility_unavailable'
  /** The facility would hold fewer of a resource than a booking asked for. */
  | 'resource_shortfall'
  /** A resource that is present or absent would no longer be offered at a facility. */
  | 'resource_withdrawn'
  | 'resource_archived';

export interface ImpactedBooking {
  bookingId: string;
  reference: string;
  applicantName: string;
  facility: { id: string; name: string; timeZone: string };
  startsAt: string;
  endsAt: string;
  /** `approved` or `pending`. */
  status: string;
  reason: ImpactReason;
  /** For the resource reasons: which resource, how much was asked for, and what would be held. (An addition.) */
  resource?: {
    id: string;
    name: string;
    requested: number;
    /** What would be held; null for a resource that is simply present or absent. */
    available: number | null;
  };
  /** For `new_conflict`: the other booking it would now clash with. (An addition.) */
  conflictsWith: {
    bookingId: string;
    reference: string;
    facility: { id: string; name: string };
  } | null;
}

export interface ImpactResult {
  affectedBookings: ImpactedBooking[];
  totalAffected: number;
}
