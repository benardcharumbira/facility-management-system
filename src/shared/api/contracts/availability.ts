/**
 * Contract for facility availability. This file is the specification handed to the backend:
 * the MSW handler implements it and the client is written against it.
 *
 * Time: every instant is UTC ISO 8601 (`2026-11-14T06:00:00Z`). Dates (`date`, `from`, `to`) and
 * HH:mm times are in the facility's own time zone, returned as `timeZone`. The client does all
 * display and selection in that zone and never in the browser's.
 *
 * The backend owns the merge, the buffer expansion and the hierarchy resolution. The client
 * renders what it is given and must not derive blocking from the facility hierarchy itself.
 */

export const AVAILABILITY_MAX_SPAN_DAYS = 62;

export type AvailabilityDayStatus = 'available' | 'partially_booked' | 'fully_booked' | 'closed';

/**
 * - `booked`: an approved booking exists on this facility.
 * - `held`: a pending request holds the time temporarily.
 * - `buffer`: set-up or clear-down time attached to an adjacent booking.
 * - `blocked_by_related`: another facility in the hierarchy is booked (see `relatedFacility`).
 */
export type AvailabilitySegmentStatus = 'booked' | 'held' | 'buffer' | 'blocked_by_related';

export interface RelatedFacility {
  id: string;
  name: string;
  /**
   * What the related facility is, relative to the facility asked about: `parent` is the larger
   * venue containing it, `child` is a space inside it.
   */
  relationship: 'parent' | 'child';
}

/** Unavailable time only. Operating time not covered by a segment is available. */
export interface AvailabilitySegment {
  startsAt: string;
  endsAt: string;
  status: AvailabilitySegmentStatus;
  /** Present only for `blocked_by_related`. */
  relatedFacility: RelatedFacility | null;
}

export interface AvailabilityDay {
  /** ISO date in the facility time zone. */
  date: string;
  status: AvailabilityDayStatus;
  /** HH:mm in the facility time zone; null when closed. */
  opensAt: string | null;
  closesAt: string | null;
  /** For example "Public holiday", "Maintenance". Present when `status` is `closed`. */
  closedReason: string | null;
  /** Sorted, non overlapping, and merged where they abut. Empty for a closed day. */
  segments: AvailabilitySegment[];
}

/**
 * `GET /api/facilities/{id}/availability?from=YYYY-MM-DD&to=YYYY-MM-DD`
 *
 * `from` and `to` are inclusive dates in the facility time zone, spanning at most
 * `AVAILABILITY_MAX_SPAN_DAYS` days. Responds 400 with problem details for a bad or oversized
 * range and 404 for an unknown facility.
 */
export interface FacilityAvailability {
  facilityId: string;
  timeZone: string;
  /** A booking cannot start sooner than this many hours from now. */
  minimumNoticeHours: number;
  /** How far ahead booking is permitted, in days from today. */
  maximumHorizonDays: number;
  /**
   * Extension to the brief's shape: the shortest booking the facility accepts, so the client can
   * prevent a selection the backend would reject.
   */
  minimumDurationMinutes: number;
  days: AvailabilityDay[];
}
