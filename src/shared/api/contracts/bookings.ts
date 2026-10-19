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
 * ```
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

export type BookingStatus = 'draft' | 'pending';

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

export interface Booking extends BookingFields {
  id: string;
  reference: string;
  status: BookingStatus;
  facility: { id: string; name: string; timeZone: string };
  documents: BookingDocument[];
  /** When the draft was last written, as a UTC instant. */
  updatedAt: string;
  submittedAt: string | null;
}

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
