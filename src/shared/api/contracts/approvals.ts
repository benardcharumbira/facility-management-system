/**
 * Contract for the approval queue. This file is the specification handed to the backend: the MSW
 * handlers implement it and the client is written against it.
 *
 * ```
 * GET  /api/approvals                              the caller's queue (filters, sort, standard envelope)
 * GET  /api/approvals/counts                       pending counts: the navigation badge and the facility filter
 * GET  /api/approvals/{id}                         one work item with its decision context
 * GET  /api/approvals/{id}/documents/{documentId}  download one of the applicant's documents
 * POST /api/bookings/{id}/approve                  approve a booking request; optional internal note
 * POST /api/bookings/{id}/reject                   reject a booking request; reason required
 * POST /api/reschedule-requests/{id}/approve       move the booking; optional internal note
 * POST /api/reschedule-requests/{id}/reject        leave the booking where it is; reason required
 * ```
 *
 * **Scope.** The queue belongs to the caller. An approver sees the work items of the facilities
 * they are designated against; a system administrator sees all. The scope comes from the session
 * identity on the server and is NEVER a parameter. A work item outside the caller's scope answers
 * 404, exactly like one that does not exist.
 *
 * **Two kinds of work item.** A `booking_request` is a new request awaiting a decision. A
 * `reschedule_request` is an approved booking whose holder asked to move it. The two have separate
 * identifiers and separate decision endpoints: the id of a booking request IS the booking's id; a
 * reschedule request has its own.
 *
 * **Competition.** Approving one request can make others impossible, in the same facility or
 * across the hierarchy (a parent and its children share a building). The server works out which
 * requests compete, and which approved bookings already stand in the way, and returns both. The
 * client renders what it is given and never walks the hierarchy.
 *
 * A competing request is NOT rejected automatically when its rival is approved. It stays in the
 * queue, can no longer be approved (`actions.approve.allowed` is false, with the reason), and
 * still needs a reason of its own written by an approver before it can be rejected.
 *
 * **Time.** Instants are UTC ISO 8601. Each item carries its facility's zone; screens display in it.
 */
import type { ActionAvailability, BookingDocument } from './bookings';

export type WorkItemType = 'booking_request' | 'reschedule_request';
export const WORK_ITEM_TYPES: readonly WorkItemType[] = ['booking_request', 'reschedule_request'];

/**
 * The state of the work item itself. A reschedule request is `approved` when the booking was
 * moved and `rejected` when it was left where it was.
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export const APPROVAL_STATUSES: readonly ApprovalStatus[] = ['pending', 'approved', 'rejected'];

export const APPROVAL_SORTS = [
  'waiting',
  '-waiting',
  'eventDate',
  '-eventDate',
  'facility',
] as const;
export type ApprovalSort = (typeof APPROVAL_SORTS)[number];

export interface ApprovalWindow {
  startsAt: string;
  endsAt: string;
}

/** One row of the queue. */
export interface ApprovalListItem {
  /** The work item's id: a booking id, or a reschedule request id. */
  id: string;
  type: WorkItemType;
  status: ApprovalStatus;
  bookingId: string;
  reference: string;
  facility: { id: string; name: string; timeZone: string };
  /** The window being decided: the one requested, or for a reschedule the one proposed. */
  startsAt: string;
  endsAt: string;
  /** For a reschedule request, where the booking is now. Null for a booking request. */
  currentWindow: ApprovalWindow | null;
  applicantName: string;
  eventTypeName: string | null;
  /** When the item joined the queue: the submission, or the request to move. Waiting time runs from here. */
  raisedAt: string;
  decidedAt: string | null;
  /** Booking requests only: the slot is released at this instant. Null once decided. */
  holdExpiresAt: string | null;
  /** The municipality's target for deciding, in hours from `raisedAt`. Null where none applies. */
  turnaroundTargetHours: number | null;
  /** Other pending items competing for the same time. */
  competingCount: number;
  /** False when an approved booking already stands in the way, or the item is decided. */
  approvable: boolean;
}

/**
 * `GET /api/approvals`. All optional. `q` matches reference and applicant name (every word, case
 * insensitive). `status` defaults to `pending` when empty. `from` and `to` are inclusive event
 * dates in the facility time zone and apply to `startsAt`. Groups combine with AND, values within
 * a group with OR. Default sort is `waiting`: longest waiting first. Returns `Paginated<ApprovalListItem>`.
 */
export interface ApprovalListParams {
  q?: string;
  status?: ApprovalStatus[];
  type?: WorkItemType[];
  from?: string;
  to?: string;
  facilityId?: string[];
  sort?: ApprovalSort;
  page?: number;
  pageSize?: number;
}

/** `GET /api/approvals/counts`. Pending items in the caller's scope; never follows filters. */
export interface ApprovalCounts {
  pending: number;
  bookingRequests: number;
  rescheduleRequests: number;
  /** Every facility in the caller's scope, with its pending count, for the facility filter. */
  facilities: Array<{ id: string; name: string; pending: number }>;
}

/**
 * How the competing facility relates to the one being decided. `parent`: it contains this one
 * (City Hall, when this is Mitchell Wing). `child`: it is inside this one.
 */
export type FacilityRelationship = 'same_facility' | 'parent' | 'child';

export interface CompetingRequest {
  /** The competing item's work item id, to open it in the queue. */
  workItemId: string;
  workItemType: WorkItemType;
  bookingId: string;
  reference: string;
  applicantName: string;
  /** The window that competing item asks for: requested, or for a reschedule proposed. */
  startsAt: string;
  endsAt: string;
  /** The part of it that overlaps the item being decided. */
  overlap: ApprovalWindow;
  facility: { id: string; name: string };
  relationship: FacilityRelationship;
  submittedAt: string;
  /** False when the competing item is outside the caller's scope: it is named but cannot be opened. */
  inYourQueue: boolean;
}

export interface DecisionContext {
  /** Other pending items that approving this one would make impossible. */
  competingRequests: CompetingRequest[];
  /**
   * Approved bookings that already stand in the way. While there are any, this item cannot be
   * approved. (An addition to the brief.)
   */
  blockedBy: CompetingRequest[];
  /**
   * Related facilities that approving this takes with it for the window (a parent, or the
   * children inside), so the screen can say so without walking the hierarchy. (An addition.)
   */
  affectedFacilities: Array<{ id: string; name: string; relationship: 'parent' | 'child' }>;
  holdExpiresAt: string | null;
  turnaroundTargetHours: number | null;
  applicantPreviousBookingsAtFacility: number;
  /** Expected attendees against the capacity for the chosen arrangement, where it is known. (An addition.) */
  capacity: { expectedAttendees: number | null; arrangement: string | null; limit: number | null };
  capacityWarning: string | null;
  resourceWarning: string | null;
}

export interface DecisionRecord {
  outcome: 'approved' | 'rejected';
  /** Null where the API does not say who. */
  decidedBy: string | null;
  decidedAt: string;
  /** Approvals only. Internal: never shown to the applicant. */
  internalNote: string | null;
  /** Rejections only. What the applicant was sent, verbatim. */
  reason: string | null;
}

export interface ApprovalResource {
  name: string;
  category: 'venue' | 'kitchen';
  quantity: number;
}

/** `GET /api/approvals/{id}`. Names are resolved by the server, so the screen needs no other lookup. */
export interface ApprovalDetail extends ApprovalListItem {
  description: string;
  attendeeCount: number | null;
  seatingArrangementName: string | null;
  resources: ApprovalResource[];
  documents: BookingDocument[];
  context: DecisionContext;
  /** Computed for the caller, now. The client never offers a decision that is not allowed. */
  actions: { approve: ActionAvailability; reject: ActionAvailability };
  decision: DecisionRecord | null;
}

export interface ApproveRequest {
  /** Internal. Never sent to the applicant. */
  note?: string;
}

export interface RejectRequest {
  /** Required. Sent to the applicant verbatim; the only explanation they receive. */
  reason: string;
}

/**
 * Problem type URI for a decision on an item someone else has already decided. Sent with 409.
 * The extension says what was decided, so the screen can say by whom and when.
 */
export const ALREADY_DECIDED_PROBLEM_TYPE = 'https://midvaal.example/problems/already-decided';

export interface AlreadyDecidedExtensions {
  decision: Pick<DecisionRecord, 'outcome' | 'decidedBy' | 'decidedAt'>;
}
