/**
 * Contract for booking requests. This file is the specification handed to the backend: the MSW
 * handlers implement it and the client is written against it.
 *
 * ```
 * GET    /api/booking-options          event types, seating arrangements, resources, terms, upload rules
 * POST   /api/bookings                 create a draft; returns it with its id and reference
 * GET    /api/bookings/{id}            load a draft or a booking
 * PATCH  /api/bookings/{id}            update a draft, partially
 * POST   /api/bookings/{id}/documents  upload one document, multipart/form-data, field "file"
 * DELETE /api/bookings/{id}/documents/{documentId}
 * POST   /api/bookings/{id}/submit     validate, check availability, place the hold, set Pending
 *
 * GET    /api/bookings                 the caller's own bookings (filters, sort and the standard envelope)
 * GET    /api/bookings/summary         counts for the list, and the facilities to filter by
 * DELETE /api/bookings/{id}            delete a draft; drafts only
 * POST   /api/bookings/{id}/cancel     cancel a pending request or an approved booking; optional reason
 * POST   /api/bookings/{id}/reschedule ask to move an approved booking; a request, not a change
 * GET    /api/bookings/{id}/documents/{documentId}   download one document
 * ```
 *
 * **Identity.** Every booking endpoint acts for the caller, identified by the session token. The
 * list returns only the caller's own bookings and never takes a user parameter. Asking for another
 * applicant's booking answers 404, not 403, so identifiers cannot be probed for existence.
 *
 * **Holds.** `submit` is the only call that validates availability and creates the hold on the
 * slot. Creating or updating a draft NEVER holds or reserves time. A draft can therefore be
 * saved for days and its slot taken meanwhile; that surfaces at `submit` as a 409.
 *
 * **Time.** `startsAt` and `endsAt` are UTC ISO 8601 instants. The facility's zone is returned
 * on the booking as `facility.timeZone`; the client displays and chooses times in it.
 *
 * **Reference.** The reference is assigned when the draft is created and does not change.
 */

export type BookingStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'cancelled',
];

export interface BookingResourceRequest {
  resourceId: string;
  /** A positive whole number. */
  quantity: number;
}

/** The fields a client may write. On PATCH send any subset; on POST only the first three. */
export interface BookingFields {
  facilityId: string;
  startsAt: string;
  endsAt: string;
  eventTypeId: string | null;
  description: string;
  attendeeCount: number | null;
  seatingArrangementId: string | null;
  resources: BookingResourceRequest[];
  /** The version of the terms the applicant accepted, or null if they have not. */
  acceptedTermsVersion: string | null;
}

export type CreateBookingRequest = Pick<BookingFields, 'facilityId' | 'startsAt' | 'endsAt'>;
export type UpdateBookingRequest = Partial<BookingFields>;

export interface BookingDocument {
  id: string;
  name: string;
  sizeBytes: number;
  contentType: string;
  uploadedAt: string;
}

/** Whether an action is open to the caller now. When it is not, say why in words, if there is a reason to give. */
export interface ActionAvailability {
  allowed: boolean;
  blockedReason: string | null;
}

export type BookingActor = 'applicant' | 'municipality';

export interface BookingHistoryEntry {
  id: string;
  type: 'created' | 'submitted' | 'approved' | 'rejected' | 'cancelled' | 'reschedule_requested';
  /** A UTC instant. */
  at: string;
  /** Who did it, where known. */
  actor: BookingActor | null;
  note: string | null;
}

/** A request to move an approved booking. The booking keeps its original window until it is decided. */
export interface RescheduleRequest {
  id: string;
  proposedStartsAt: string;
  proposedEndsAt: string;
  requestedAt: string;
  status: 'pending';
}

export interface Booking extends BookingFields {
  id: string;
  reference: string;
  status: BookingStatus;
  facility: { id: string; name: string; timeZone: string };
  documents: BookingDocument[];
  /** When the draft was last written, as a UTC instant. */
  updatedAt: string;
  submittedAt: string | null;
  /** While pending, the request holds the slot until this instant, then the slot is released. */
  holdExpiresAt: string | null;
  decidedAt: string | null;
  /** The approver's reason, in full. Present when rejected. */
  rejectionReason: string | null;
  cancellation: { cancelledAt: string; cancelledBy: BookingActor; reason: string | null } | null;
  /** Oldest first. The applicant facing view of the audit trail. */
  history: BookingHistoryEntry[];
  rescheduleRequest: RescheduleRequest | null;
  /** Computed by the server for the caller, now. The client never offers an action that is not allowed. */
  actions: { cancel: ActionAvailability; reschedule: ActionAvailability };
}

/** Where a booking sits in the default "needs attention first" ordering. */
export type BookingGroup = 'attention' | 'upcoming' | 'closed';

/**
 * One row of the list. `group` is `attention` for a draft or pending request whose event has not
 * passed, `upcoming` for an approved booking whose event has not passed, and `closed` for
 * everything else: past events whatever their status, and rejected or cancelled bookings.
 */
export interface BookingListItem {
  id: string;
  reference: string;
  status: BookingStatus;
  group: BookingGroup;
  /** The event has ended. */
  isPast: boolean;
  facility: { id: string; name: string; timeZone: string };
  startsAt: string;
  endsAt: string;
  eventTypeName: string | null;
  description: string;
  submittedAt: string | null;
  updatedAt: string;
  holdExpiresAt: string | null;
  hasPendingReschedule: boolean;
}

export const BOOKING_SORTS = [
  'attention',
  'eventDate',
  '-eventDate',
  'submitted',
  '-submitted',
  'status',
] as const;
export type BookingSort = (typeof BOOKING_SORTS)[number];

/**
 * `GET /api/bookings`. All optional. `q` matches reference, facility name and description (every
 * word, case insensitive). `from` and `to` are inclusive event dates in the facility time zone.
 * Groups combine with AND, values within a group with OR. Default sort is `attention`: drafts,
 * then pending, then upcoming approved, then everything else. Returns `Paginated<BookingListItem>`.
 */
export interface BookingListParams {
  q?: string;
  status?: BookingStatus[];
  from?: string;
  to?: string;
  facilityId?: string[];
  sort?: BookingSort;
  page?: number;
  pageSize?: number;
}

/**
 * `GET /api/bookings/summary`. Counts follow the same filters as the list, so the screen can tell
 * "no bookings at all" from "none match" from "none in the past". `overall` and `facilities` are
 * unfiltered.
 */
export interface BookingsSummary {
  overall: number;
  matching: Record<BookingGroup, number>;
  facilities: Array<{ id: string; name: string }>;
}

export interface CancelBookingRequest {
  reason?: string;
}

export interface RescheduleBookingRequest {
  startsAt: string;
  endsAt: string;
}

/** Problem type URI for a cancellation or reschedule the rules do not allow. Sent with 409. */
export const ACTION_NOT_ALLOWED_PROBLEM_TYPE =
  'https://midvaal.example/problems/action-not-allowed';

export interface BookingOptionItem {
  id: string;
  name: string;
}

export interface BookingResourceOption extends BookingOptionItem {
  category: 'venue' | 'kitchen';
}

export interface AcceptedUploadType {
  /** e.g. ".pdf" */
  extension: string;
  contentType: string;
  /** e.g. "PDF" */
  label: string;
}

/** `GET /api/booking-options`. Controlled lists, the current terms and the upload rules. */
export interface BookingOptions {
  eventTypes: BookingOptionItem[];
  /** Names match `FacilityDetail.capacityByArrangement[].arrangement` (case insensitive). */
  seatingArrangements: BookingOptionItem[];
  /**
   * Every resource a booking can request, whatever the venue. Venue specific quantities come
   * from `FacilityDetail.resources`. (An addition to the brief: keeps the list out of the client.)
   */
  resources: BookingResourceOption[];
  terms: { version: string; title: string; paragraphs: string[] };
  uploads: {
    maxFileSizeBytes: number;
    maxFiles: number;
    acceptedTypes: AcceptedUploadType[];
  };
  /** For example "within 5 working days". Null when not known. */
  expectedTurnaround: string | null;
}

/** Problem type URI identifying a slot conflict on `submit`. Always sent with status 409. */
export const SLOT_CONFLICT_PROBLEM_TYPE = 'https://midvaal.example/problems/slot-conflict';

/** Extension members of a slot conflict problem document. */
export interface SlotConflictExtensions {
  /** The part of the requested window that is no longer free, as UTC instants. */
  conflictingWindow: { startsAt: string; endsAt: string };
  /** Present when the block comes from another facility in the hierarchy. */
  relatedFacility?: { id: string; name: string; relationship: 'parent' | 'child' };
  /** In plain words, e.g. "Mitchell Wing is booked" or "Booked". */
  reason: string;
}
