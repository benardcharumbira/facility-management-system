/**
 * The server side behaviour the real approvals API must reproduce. In particular:
 *
 * - The queue is scoped by the caller's identity, never by a parameter. Something outside the
 *   caller's scope is simply not found.
 * - The server works out which requests compete for the same time, across the facility hierarchy,
 *   and which approved bookings already stand in the way. The client does none of that.
 * - Approving a request does not reject its rivals. They stay, can no longer be approved, and
 *   still need a reason written by a person before they are rejected.
 * - A reason is mandatory to reject and is stored exactly as typed. An internal note on an
 *   approval is never shown to the applicant.
 * - A decision on something already decided is a 409 that says what was decided, by whom and when.
 *
 * Reviewers can force states: `?mock=empty` empties the queue and `?mock=error` fails it. The
 * seeded request "MVL-…-9115" is one another approver gets to first: the first decision you try
 * on it comes back as already decided.
 */
import { DateTime } from 'luxon';
import { HttpResponse, http, delay } from 'msw';
import {
  ACTION_NOT_ALLOWED_PROBLEM_TYPE,
  ALREADY_DECIDED_PROBLEM_TYPE,
  APPROVAL_SORTS,
  APPROVAL_STATUSES,
  WORK_ITEM_TYPES,
  type ActionAvailability,
  type ApprovalCounts,
  type ApprovalDetail,
  type ApprovalListItem,
  type ApprovalListParams,
  type ApprovalSort,
  type ApprovalStatus,
  type CompetingRequest,
  type DecisionContext,
  type DecisionRecord,
  type FacilitySummary,
  type WorkItemType,
} from '@/shared/api';
import { FACILITY_TIME_ZONE } from './data/bookingLedger';
import { BOOKING_OPTIONS } from './data/bookingOptions';
import {
  applicantName,
  bookingStore,
  type StoredBooking,
  type StoredDecision,
} from './data/bookingStore';
import { deriveDetail } from './data/facilityDetail';
import { facilityStore } from './data/facilityStore';
import { relationOf } from './data/hierarchy';
import { roleOfUser, staffName, userIdOf } from './data/staff';
import { ROLES } from '@/shared/auth/roles';

/** The approver who "gets there first" on a contested request. */
export const RIVAL_APPROVER = 'Pieter van Wyk';

export const TURNAROUND_TARGET_HOURS = 120;
/** Facilities with no published target, so the missing case is exercised. */
const NO_TARGET = new Set(['city-hall-committee-room']);

const MAX_NOTE = 1000;

function problem(
  status: number,
  title: string,
  detail?: string,
  extra: Record<string, unknown> = {},
) {
  return HttpResponse.json(
    { type: 'about:blank', title, status, detail, ...extra },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

/** Who is calling: a token of the form `user:<id>`, else the default mock approver. */
export const approverOf = userIdOf;

/**
 * What an approver may see: the facilities that name them as an approver (set in administration),
 * or everything for a system administrator. Anyone else is designated against nothing.
 */
const scopeOf = (approverId: string): readonly string[] | 'all' =>
  roleOfUser(approverId) === ROLES.systemAdmin
    ? 'all'
    : facilityStore
        .all()
        .filter((f) => f.approverIds.includes(approverId))
        .map((f) => f.id);
const inScope = (scope: readonly string[] | 'all', facilityId: string) =>
  scope === 'all' || scope.includes(facilityId);

const instant = (value: DateTime) => value.toUTC().toISO({ suppressMilliseconds: true }) ?? '';
const iso = (value: string) => DateTime.fromISO(value, { zone: 'utc' });

// --- work items ---------------------------------------------------------------------------------

interface Item {
  id: string;
  type: WorkItemType;
  status: ApprovalStatus;
  booking: StoredBooking;
  ownerId: string;
  startsAt: string;
  endsAt: string;
  current: { startsAt: string; endsAt: string } | null;
  raisedAt: string;
  decidedAt: string | null;
  decision: StoredDecision | undefined;
}

/** Every work item there is, whoever may see it. Withdrawn requests and drafts are not work. */
export function allWorkItems(): Item[] {
  const items: Item[] = [];
  for (const { booking, ownerId } of bookingStore.all()) {
    if (
      booking.submittedAt &&
      (booking.status === 'pending' ||
        booking.status === 'approved' ||
        booking.status === 'rejected')
    ) {
      items.push({
        id: booking.id,
        type: 'booking_request',
        status: booking.status,
        booking,
        ownerId,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        current: null,
        raisedAt: booking.submittedAt,
        decidedAt: booking.decidedAt,
        decision: bookingStore.decisionFor(booking.id),
      });
    }
    const move = booking.rescheduleRequest;
    if (move && booking.status === 'approved') {
      items.push({
        id: move.id,
        type: 'reschedule_request',
        status: 'pending',
        booking,
        ownerId,
        startsAt: move.proposedStartsAt,
        endsAt: move.proposedEndsAt,
        current: { startsAt: booking.startsAt, endsAt: booking.endsAt },
        raisedAt: move.requestedAt,
        decidedAt: null,
        decision: undefined,
      });
    }
  }
  for (const decision of bookingStore.decisions()) {
    if (decision.type !== 'reschedule_request' || !decision.reschedule) continue;
    const found = bookingStore.all().find((e) => e.booking.id === decision.bookingId);
    if (!found) continue;
    items.push({
      id: decision.workItemId,
      type: 'reschedule_request',
      status: decision.outcome,
      booking: found.booking,
      ownerId: found.ownerId,
      startsAt: decision.reschedule.proposedStartsAt,
      endsAt: decision.reschedule.proposedEndsAt,
      current: {
        startsAt: decision.reschedule.previousStartsAt,
        endsAt: decision.reschedule.previousEndsAt,
      },
      raisedAt: decision.reschedule.requestedAt,
      decidedAt: decision.decidedAt,
      decision,
    });
  }
  return items;
}

const overlap = (
  a: { startsAt: string; endsAt: string },
  b: { startsAt: string; endsAt: string },
) => {
  const start = DateTime.max(iso(a.startsAt), iso(b.startsAt));
  const end = DateTime.min(iso(a.endsAt), iso(b.endsAt));
  return start < end ? { startsAt: instant(start), endsAt: instant(end) } : null;
};

interface Competition {
  competing: CompetingRequest[];
  blockedBy: CompetingRequest[];
}

/**
 * Who competes with a pending item, and which approved bookings already stand in the way. Two
 * requests compete when they want overlapping time in the same facility or in facilities that
 * share a building (one contains the other).
 */
export function competitionFor(
  item: Item,
  all: Item[],
  catalogue: readonly FacilitySummary[],
  scope: readonly string[] | 'all',
): Competition {
  const result: Competition = { competing: [], blockedBy: [] };
  if (item.status !== 'pending') return result;
  const facility = catalogue.find((f) => f.id === item.booking.facilityId);
  if (!facility) return result;

  for (const other of all) {
    if (other.booking.id === item.booking.id) continue;
    const otherFacility = catalogue.find((f) => f.id === other.booking.facilityId);
    if (!otherFacility) continue;
    const relationship = relationOf(facility, otherFacility, catalogue);
    if (!relationship) continue;

    const standsInTheWay = other.type === 'booking_request' && other.status === 'approved';
    const pending = other.status === 'pending';
    if (!standsInTheWay && !pending) continue;
    const shared = overlap(item, other);
    if (!shared) continue;

    const entry: CompetingRequest = {
      workItemId: other.id,
      workItemType: other.type,
      bookingId: other.booking.id,
      reference: other.booking.reference,
      applicantName: applicantName(other.ownerId),
      startsAt: other.startsAt,
      endsAt: other.endsAt,
      overlap: shared,
      facility: { id: otherFacility.id, name: otherFacility.name },
      relationship,
      submittedAt: other.raisedAt,
      inYourQueue: inScope(scope, otherFacility.id),
    };
    (standsInTheWay ? result.blockedBy : result.competing).push(entry);
  }
  const oldestFirst = (a: CompetingRequest, b: CompetingRequest) =>
    a.submittedAt.localeCompare(b.submittedAt) || a.reference.localeCompare(b.reference);
  result.competing.sort(oldestFirst);
  result.blockedBy.sort(oldestFirst);
  return result;
}

const turnaroundFor = (facilityId: string) =>
  NO_TARGET.has(facilityId) ? null : TURNAROUND_TARGET_HOURS;

function toListItem(item: Item, competition: Competition): ApprovalListItem {
  const pendingBooking = item.type === 'booking_request' && item.status === 'pending';
  return {
    id: item.id,
    type: item.type,
    status: item.status,
    bookingId: item.booking.id,
    reference: item.booking.reference,
    facility: { ...item.booking.facility },
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    currentWindow: item.current,
    applicantName: applicantName(item.ownerId),
    eventTypeName:
      BOOKING_OPTIONS.eventTypes.find((t) => t.id === item.booking.eventTypeId)?.name ?? null,
    raisedAt: item.raisedAt,
    decidedAt: item.decidedAt,
    holdExpiresAt: pendingBooking ? item.booking.holdExpiresAt : null,
    turnaroundTargetHours: turnaroundFor(item.booking.facilityId),
    competingCount: competition.competing.length,
    approvable: item.status === 'pending' && competition.blockedBy.length === 0,
  };
}

// --- context --------------------------------------------------------------------------------------

function sentenceList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function contextFor(
  item: Item,
  competition: Competition,
  catalogue: readonly FacilitySummary[],
  now: DateTime,
): DecisionContext {
  const facility = catalogue.find((f) => f.id === item.booking.facilityId);
  const detail = facility ? deriveDetail(facility, catalogue) : undefined;
  const booking = item.booking;

  const arrangement =
    BOOKING_OPTIONS.seatingArrangements.find((s) => s.id === booking.seatingArrangementId)?.name ??
    null;
  const limit =
    arrangement && detail?.capacityByArrangement
      ? (detail.capacityByArrangement.find(
          (c) => c.arrangement.toLowerCase() === arrangement.toLowerCase(),
        )?.capacity ?? null)
      : null;
  const attendees = booking.attendeeCount;

  let capacityWarning: string | null = null;
  if (attendees !== null && limit !== null && attendees > limit) {
    capacityWarning = `${attendees} people are expected, but ${facility?.name} holds ${limit} with ${arrangement?.toLowerCase()} seating.`;
  } else if (attendees !== null && facility?.capacity != null && attendees > facility.capacity) {
    capacityWarning = `${attendees} people are expected, but ${facility.name} holds at most ${facility.capacity}.`;
  }

  const shortfalls: string[] = [];
  for (const request of booking.resources) {
    const name = BOOKING_OPTIONS.resources.find((r) => r.id === request.resourceId)?.name;
    const held = detail?.resources.find((r) => r.id === request.resourceId);
    if (!name) continue;
    if (!held) shortfalls.push(`${name} is not held at this venue`);
    else if (held.quantity !== null && request.quantity > held.quantity) {
      shortfalls.push(`${name}: ${request.quantity} requested, ${held.quantity} held`);
    }
  }
  const resourceWarning = shortfalls.length > 0 ? `${sentenceList(shortfalls)}.` : null;

  const previous = bookingStore
    .all()
    .filter(
      (e) =>
        e.ownerId === item.ownerId &&
        e.booking.id !== booking.id &&
        e.booking.facilityId === booking.facilityId &&
        e.booking.status === 'approved' &&
        iso(e.booking.endsAt) < now,
    ).length;

  const affected =
    item.status === 'pending' && facility
      ? catalogue.flatMap((other) => {
          const relationship = relationOf(facility, other, catalogue);
          return relationship === 'parent' || relationship === 'child'
            ? [{ id: other.id, name: other.name, relationship }]
            : [];
        })
      : [];

  return {
    competingRequests: competition.competing,
    blockedBy: competition.blockedBy,
    affectedFacilities: affected,
    holdExpiresAt:
      item.type === 'booking_request' && item.status === 'pending' ? booking.holdExpiresAt : null,
    turnaroundTargetHours: turnaroundFor(booking.facilityId),
    applicantPreviousBookingsAtFacility: previous,
    capacity: { expectedAttendees: attendees, arrangement, limit },
    capacityWarning,
    resourceWarning,
  };
}

const blockedReason = (competition: Competition) => {
  const first = competition.blockedBy[0];
  if (!first) return null;
  const where =
    first.relationship === 'same_facility'
      ? first.facility.name
      : `${first.facility.name}, which shares a building with this venue`;
  return `${first.reference} has already been approved for ${where} at an overlapping time. This request can no longer be approved. You can still reject it, with a reason.`;
};

function actionsFor(item: Item, competition: Competition): ApprovalDetail['actions'] {
  const decided = (): ActionAvailability => ({
    allowed: false,
    blockedReason: 'This request has already been decided.',
  });
  if (item.status !== 'pending') return { approve: decided(), reject: decided() };
  const reason = blockedReason(competition);
  return {
    approve: reason
      ? { allowed: false, blockedReason: reason }
      : { allowed: true, blockedReason: null },
    reject: { allowed: true, blockedReason: null },
  };
}

function decisionRecord(item: Item): DecisionRecord | null {
  const decision = item.decision;
  if (item.status === 'pending') return null;
  if (!decision) {
    // Decided before decisions were recorded: the outcome is known, who and when are not.
    return {
      outcome: item.status === 'rejected' ? 'rejected' : 'approved',
      decidedBy: null,
      decidedAt: item.decidedAt ?? item.raisedAt,
      internalNote: null,
      reason: item.status === 'rejected' ? item.booking.rejectionReason : null,
    };
  }
  return {
    outcome: decision.outcome,
    decidedBy: decision.decidedBy,
    decidedAt: decision.decidedAt,
    internalNote: decision.internalNote,
    reason: decision.reason,
  };
}

export function toDetail(
  item: Item,
  all: Item[],
  catalogue: readonly FacilitySummary[],
  scope: readonly string[] | 'all',
  now: DateTime,
): ApprovalDetail {
  const competition = competitionFor(item, all, catalogue, scope);
  const booking = item.booking;
  const list = toListItem(item, competition);
  return {
    ...list,
    description: booking.description,
    attendeeCount: booking.attendeeCount,
    seatingArrangementName:
      BOOKING_OPTIONS.seatingArrangements.find((s) => s.id === booking.seatingArrangementId)
        ?.name ?? null,
    resources: booking.resources.flatMap((r) => {
      const option = BOOKING_OPTIONS.resources.find((o) => o.id === r.resourceId);
      return option ? [{ name: option.name, category: option.category, quantity: r.quantity }] : [];
    }),
    documents: booking.documents,
    context: contextFor(item, competition, catalogue, now),
    actions: actionsFor(item, competition),
    decision: decisionRecord(item),
  };
}

// --- the queue ------------------------------------------------------------------------------------

class BadQuery extends Error {}

export function parseApprovalParams(search: URLSearchParams): ApprovalListParams {
  const integer = (name: string) => {
    const raw = search.get(name);
    if (raw === null) return undefined;
    if (!/^\d+$/.test(raw)) throw new BadQuery(`"${name}" must be a non-negative integer.`);
    return Number(raw);
  };
  const statuses = search.getAll('status');
  for (const status of statuses) {
    if (!APPROVAL_STATUSES.includes(status as ApprovalStatus)) {
      throw new BadQuery(`"status" must be one of: ${APPROVAL_STATUSES.join(', ')}.`);
    }
  }
  const types = search.getAll('type');
  for (const type of types) {
    if (!WORK_ITEM_TYPES.includes(type as WorkItemType)) {
      throw new BadQuery(`"type" must be one of: ${WORK_ITEM_TYPES.join(', ')}.`);
    }
  }
  const sort = search.get('sort');
  if (sort !== null && !APPROVAL_SORTS.includes(sort as ApprovalSort)) {
    throw new BadQuery(`"sort" must be one of: ${APPROVAL_SORTS.join(', ')}.`);
  }
  for (const name of ['from', 'to']) {
    const value = search.get(name);
    if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadQuery(`"${name}" must be an ISO date (YYYY-MM-DD).`);
    }
  }
  return {
    q: search.get('q') ?? undefined,
    status: statuses as ApprovalStatus[],
    type: types as WorkItemType[],
    from: search.get('from') ?? undefined,
    to: search.get('to') ?? undefined,
    facilityId: search.getAll('facilityId'),
    sort: (sort as ApprovalSort | null) ?? undefined,
    page: integer('page'),
    pageSize: integer('pageSize'),
  };
}

function comparator(sort: ApprovalSort) {
  type Row = ApprovalListItem;
  const byRaised = (a: Row, b: Row) =>
    a.raisedAt.localeCompare(b.raisedAt) || a.reference.localeCompare(b.reference);
  const byStart = (a: Row, b: Row) => a.startsAt.localeCompare(b.startsAt) || byRaised(a, b);
  switch (sort) {
    case 'waiting':
      return byRaised;
    case '-waiting':
      return (a: Row, b: Row) => byRaised(b, a);
    case 'eventDate':
      return byStart;
    case '-eventDate':
      return (a: Row, b: Row) => byStart(b, a);
    case 'facility':
      return (a: Row, b: Row) => a.facility.name.localeCompare(b.facility.name) || byRaised(a, b);
  }
}

/** The caller's queue, for tests and handlers alike. */
export function listApprovals(
  scope: readonly string[] | 'all',
  params: ApprovalListParams,
  catalogue: readonly FacilitySummary[],
) {
  const all = allWorkItems();
  const wanted = params.status?.length ? params.status : (['pending'] as ApprovalStatus[]);
  const words = (params.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);

  const rows = all
    .filter((item) => inScope(scope, item.booking.facilityId))
    .filter((item) => wanted.includes(item.status))
    .filter((item) => !params.type?.length || params.type.includes(item.type))
    .filter(
      (item) => !params.facilityId?.length || params.facilityId.includes(item.booking.facilityId),
    )
    .filter((item) => {
      const date = iso(item.startsAt).setZone(FACILITY_TIME_ZONE).toISODate() ?? '';
      if (params.from && date < params.from) return false;
      if (params.to && date > params.to) return false;
      return true;
    })
    .filter((item) => {
      if (words.length === 0) return true;
      const haystack = `${item.booking.reference} ${applicantName(item.ownerId)}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    })
    .map((item) => toListItem(item, competitionFor(item, all, catalogue, scope)))
    .sort(comparator(params.sort ?? 'waiting'));

  const size = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * size;
  return {
    items: rows.slice(start, start + size),
    page,
    pageSize: size,
    totalItems: rows.length,
    totalPages: Math.ceil(rows.length / size),
  };
}

export function countApprovals(
  scope: readonly string[] | 'all',
  catalogue: readonly FacilitySummary[],
): ApprovalCounts {
  const pending = allWorkItems().filter(
    (item) => item.status === 'pending' && inScope(scope, item.booking.facilityId),
  );
  return {
    pending: pending.length,
    bookingRequests: pending.filter((i) => i.type === 'booking_request').length,
    rescheduleRequests: pending.filter((i) => i.type === 'reschedule_request').length,
    facilities: catalogue
      .filter((f) => inScope(scope, f.id))
      .map((f) => ({
        id: f.id,
        name: f.name,
        pending: pending.filter((i) => i.booking.facilityId === f.id).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// --- handlers -------------------------------------------------------------------------------------

export interface ApprovalHandlerOptions {
  delayMs: number;
  catalogue: () => readonly FacilitySummary[];
  now?: () => DateTime;
  /** Makes every queue empty. */
  empty?: () => boolean;
  fail?: () => boolean;
}

export function createApprovalHandlers(
  root: string,
  { delayMs, catalogue, now = () => DateTime.now(), empty, fail }: ApprovalHandlerOptions,
) {
  const wait = () => (delayMs > 0 ? delay(delayMs) : Promise.resolve());
  const failure = () => problem(500, 'Mock failure', 'The approvals service is unavailable.');
  const scopeFor = (request: Request) => (empty?.() ? [] : scopeOf(approverOf(request)));
  const notFound = () => problem(404, 'Request not found');

  /** The work item, if it exists and is the caller's to see. */
  const findItem = (id: string, type: WorkItemType | undefined, scope: readonly string[] | 'all') =>
    allWorkItems().find(
      (item) =>
        item.id === id &&
        (type === undefined || item.type === type) &&
        inScope(scope, item.booking.facilityId),
    );

  const detailOf = (item: Item, scope: readonly string[] | 'all') =>
    toDetail(item, allWorkItems(), catalogue(), scope, now());

  const alreadyDecided = (item: Item) => {
    const record = decisionRecord(item);
    const by = record?.decidedBy ? ` by ${record.decidedBy}` : '';
    return problem(
      409,
      'Already decided',
      `This request was ${record?.outcome ?? 'decided'}${by}.`,
      {
        type: ALREADY_DECIDED_PROBLEM_TYPE,
        decision: record
          ? { outcome: record.outcome, decidedBy: record.decidedBy, decidedAt: record.decidedAt }
          : undefined,
      },
    );
  };

  /** Writes a decision onto the booking and records who made it. */
  const apply = (
    item: Item,
    outcome: 'approved' | 'rejected',
    decidedBy: string,
    { note, reason }: { note: string | null; reason: string | null },
  ) => {
    const at = instant(now());
    const booking = item.booking;
    const historyOf = (
      type: StoredBooking['history'][number]['type'],
      text: string | null,
    ): StoredBooking['history'] => [
      ...booking.history,
      { id: `h-${booking.history.length + 1}`, type, at, actor: 'municipality', note: text },
    ];

    if (item.type === 'booking_request') {
      bookingStore.update({
        ...booking,
        status: outcome,
        decidedAt: at,
        updatedAt: at,
        holdExpiresAt: null,
        rejectionReason: outcome === 'rejected' ? reason : booking.rejectionReason,
        history: historyOf(outcome, outcome === 'rejected' ? reason : null),
      });
    } else {
      const move = booking.rescheduleRequest;
      if (!move) return;
      bookingStore.update({
        ...booking,
        startsAt: outcome === 'approved' ? move.proposedStartsAt : booking.startsAt,
        endsAt: outcome === 'approved' ? move.proposedEndsAt : booking.endsAt,
        rescheduleRequest: null,
        updatedAt: at,
        history: historyOf(
          outcome === 'approved' ? 'reschedule_approved' : 'reschedule_declined',
          outcome === 'rejected' ? reason : null,
        ),
      });
    }
    bookingStore.recordDecision({
      workItemId: item.id,
      type: item.type,
      bookingId: booking.id,
      outcome,
      decidedBy,
      decidedAt: at,
      internalNote: note,
      reason,
      reschedule:
        item.type === 'reschedule_request' && booking.rescheduleRequest
          ? {
              proposedStartsAt: booking.rescheduleRequest.proposedStartsAt,
              proposedEndsAt: booking.rescheduleRequest.proposedEndsAt,
              requestedAt: booking.rescheduleRequest.requestedAt,
              previousStartsAt: booking.startsAt,
              previousEndsAt: booking.endsAt,
            }
          : undefined,
    });
  };

  const decide =
    (type: WorkItemType, outcome: 'approved' | 'rejected') =>
    async ({ params, request }: { params: Record<string, unknown>; request: Request }) => {
      await wait();
      if (fail?.()) return failure();
      const approverId = approverOf(request);
      const scope = scopeFor(request);
      const id = String(params.id);
      let item = findItem(id, type, scope);
      if (!item) return notFound();

      // Another approver got there first: their decision lands, and this one loses.
      if (item.status === 'pending' && bookingStore.isContested(id)) {
        bookingStore.uncontest(id);
        apply(item, 'approved', RIVAL_APPROVER, { note: null, reason: null });
        item = findItem(id, type, scope) ?? item;
      }
      if (item.status !== 'pending') return alreadyDecided(item);

      const body = (await request.json().catch(() => ({}))) as { note?: unknown; reason?: unknown };
      const name = staffName(approverId);

      if (outcome === 'rejected') {
        if (typeof body.reason !== 'string' || body.reason.trim() === '') {
          return problem(422, 'Validation failed', 'A reason is required to reject a request.', {
            errors: { reason: ['Give a reason. It is sent to the applicant as written.'] },
          });
        }
        if (body.reason.length > MAX_NOTE) {
          return problem(422, 'Validation failed', 'The reason is too long.', {
            errors: { reason: [`Use ${MAX_NOTE} characters or fewer.`] },
          });
        }
        // Verbatim: stored exactly as written.
        apply(item, 'rejected', name, { note: null, reason: body.reason });
      } else {
        const competition = competitionFor(item, allWorkItems(), catalogue(), scope);
        if (competition.blockedBy.length > 0) {
          return problem(409, 'That is not allowed', blockedReason(competition) ?? undefined, {
            type: ACTION_NOT_ALLOWED_PROBLEM_TYPE,
          });
        }
        const note = typeof body.note === 'string' && body.note.trim() !== '' ? body.note : null;
        if (note && note.length > MAX_NOTE) {
          return problem(422, 'Validation failed', 'The note is too long.', {
            errors: { note: [`Use ${MAX_NOTE} characters or fewer.`] },
          });
        }
        apply(item, 'approved', name, { note, reason: null });
      }
      const decided = findItem(id, type, scope);
      return decided
        ? HttpResponse.json(detailOf(decided, scope))
        : problem(500, 'Mock failure', 'The decision was not recorded.');
    };

  return [
    http.get(`${root}/approvals/counts`, async ({ request }) => {
      await wait();
      if (fail?.()) return failure();
      return HttpResponse.json(countApprovals(scopeFor(request), catalogue()));
    }),

    http.get(`${root}/approvals`, async ({ request }) => {
      await wait();
      if (fail?.()) return failure();
      try {
        const params = parseApprovalParams(new URL(request.url).searchParams);
        return HttpResponse.json(listApprovals(scopeFor(request), params, catalogue()));
      } catch (error) {
        if (error instanceof BadQuery) return problem(400, 'Invalid query', error.message);
        throw error;
      }
    }),

    http.get(`${root}/approvals/:id`, async ({ params, request }) => {
      await wait();
      if (fail?.()) return failure();
      const scope = scopeFor(request);
      const item = findItem(String(params.id), undefined, scope);
      return item ? HttpResponse.json(detailOf(item, scope)) : notFound();
    }),

    http.get(`${root}/approvals/:id/documents/:documentId`, async ({ params, request }) => {
      await wait();
      const item = findItem(String(params.id), undefined, scopeFor(request));
      const document = item?.booking.documents.find((d) => d.id === params.documentId);
      if (!item || !document) return notFound();
      return new HttpResponse(`Mock contents of ${document.name}`, {
        headers: {
          'Content-Type': document.contentType,
          'Content-Disposition': `attachment; filename="${document.name}"`,
        },
      });
    }),

    http.post(`${root}/bookings/:id/approve`, decide('booking_request', 'approved')),
    http.post(`${root}/bookings/:id/reject`, decide('booking_request', 'rejected')),
    http.post(`${root}/reschedule-requests/:id/approve`, decide('reschedule_request', 'approved')),
    http.post(`${root}/reschedule-requests/:id/reject`, decide('reschedule_request', 'rejected')),
  ];
}
