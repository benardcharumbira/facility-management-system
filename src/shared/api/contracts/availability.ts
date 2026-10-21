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
 *
 * **Multi day bookings.** A booking is two instants, so one may cover several days; the model needed
 * no change, only the rules around it. A day wholly inside a booking is occupied in full, whatever
 * the operating hours of that day, and appears so below. Operating hours constrain only the start on
 * the first day and the end on the last. Blackouts still block a span. Set-up and clear-down time
 * attach to the outer edges of a booking, so they appear at the span's ends and never between days.
 */

export const AVAILABILITY_MAX_SPAN_DAYS = 62;

export type AvailabilityDayStatus = 'available' | 'partially_booked' | 'fully_booked' | 'closed';

/**
 * - `booked`: an approved booking exists on this facility.
 * - `held`: a pending request holds the time temporarily.
 * - `buffer`: set-up or clear-down time attached to an adjacent booking.
 * - `blocked_by_related`: another facility in the hierarchy is booked (see `relatedFacility`).
 * - `closure`: part of the day is closed by a blackout (see `reason`). A blackout covering the whole
 *   operating day closes the day instead.
 */
export type AvailabilitySegmentStatus =
  'booked' | 'held' | 'buffer' | 'blocked_by_related' | 'closure';

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
  /** Present only for `closure`: why, as a sentence the public can read. */
  reason?: string;
  /**
   * The booking this belongs to began on an earlier day / ends on a later one, so the block is one
   * piece of a multi day span and is drawn joined to its neighbours. Absent means false.
   */
  continuesBefore?: boolean;
  continuesAfter?: boolean;
}

/** Why a day is closed: its weekly hours, a public holiday, or a blackout set in administration. */
export type ClosedBy = 'schedule' | 'holiday' | 'blackout';

export interface AvailabilityDay {
  /** ISO date in the facility time zone. */
  date: string;
  status: AvailabilityDayStatus;
  /** HH:mm in the facility time zone; null when closed. */
  opensAt: string | null;
  closesAt: string | null;
  /** For example "Public holiday", "Maintenance". Present when `status` is `closed`. */
  closedReason: string | null;
  /**
   * What closes it, so a client can tell a day a span may cross (`schedule`, `holiday`) from one it
   * may not (`blackout`). Null unless the day is closed, or is closed by hours but occupied in full
   * by a booking that spans it.
   */
  closedBy?: ClosedBy | null;
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
  /** The most calendar days one booking may cover. 1 means a booking is within a single day. */
  maximumBookingDays: number;
  days: AvailabilityDay[];
}
