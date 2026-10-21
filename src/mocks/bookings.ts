/**
 * The server side behaviour the real booking API must reproduce. In particular: drafts never
 * hold time; `submit` is the only call that checks availability and creates the hold; a lost
 * race is a 409 slot conflict problem document; validation failures are field level errors;
 * every call acts for the caller and someone else's booking is simply not found.
 *
 * Reviewers can force states: `?mock=conflict` on the page URL makes every submit a slot
 * conflict, `?mock=empty` gives an applicant with no bookings, a description containing
 * `[invalid]` makes submit return a field error, and a file whose name contains `fail` fails to
 * upload.
 */
import { DateTime } from 'luxon';
import { HttpResponse, http, delay } from 'msw';
import {
  ACTION_NOT_ALLOWED_PROBLEM_TYPE,
  BOOKING_SORTS,
  BOOKING_STATUSES,
  SLOT_CONFLICT_PROBLEM_TYPE,
  type ActionAvailability,
  type Booking,
  type BookingDocument,
  type BookingFields,
  type BookingGroup,
  type BookingHistoryEntry,
  type BookingListItem,
  type BookingListParams,
  type BookingResourceRequest,
  type BookingsSummary,
  type BookingSort,
  type BookingStatus,
  type FacilitySummary,
  type SlotConflictExtensions,
} from '@/shared/api';
import { rulesOf, windowProblem } from '@/shared/utils/availability';
import { bufferOf, computeAvailability, MOCK_AVAILABILITY_RULES } from './availability';
import { FACILITY_TIME_ZONE, buildLedger } from './data/bookingLedger';
import type { FacilitySettings } from './data/facilityStore';
import { BOOKING_OPTIONS, TERMS_VERSION } from './data/bookingOptions';
import { HOLD_HOURS, MOCK_USER_ID, bookingStore, type StoredBooking } from './data/bookingStore';

const MAX_DESCRIPTION = 1000;
const MAX_ATTENDEES = 5000;
/** Cancelling or moving an approved booking must happen at least this long before it starts. */
export const CHANGE_NOTICE_HOURS = 72;

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

const validationProblem = (errors: Record<string, string[]>) =>
  problem(422, 'Validation failed', 'One or more fields are invalid.', { errors });

const notFound = () => problem(404, 'Booking not found');

/** Who is calling: a token of the form `user:<id>`, else the default mock applicant. */
export function callerOf(request: Request): string {
  const match = /^Bearer user:(.+)$/.exec(request.headers.get('Authorization') ?? '');
  return match?.[1] ?? MOCK_USER_ID;
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && DateTime.fromISO(value, { zone: 'utc' }).isValid;
}

const instant = (value: DateTime) => value.toUTC().toISO({ suppressMilliseconds: true }) ?? '';

/** Field level validation of a booking that is being submitted. */
export function validateForSubmit(booking: StoredBooking): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const add = (field: string, message: string) => (errors[field] ??= []).push(message);

  if (!BOOKING_OPTIONS.eventTypes.some((t) => t.id === booking.eventTypeId)) {
    add('eventTypeId', 'Choose the type of meeting or event.');
  }
  const description = booking.description.trim();
  if (description === '') add('description', 'Describe the event.');
  else if (description.length > MAX_DESCRIPTION) {
    add('description', `Use ${MAX_DESCRIPTION} characters or fewer.`);
  } else if (description.includes('[invalid]')) {
    add('description', 'The description contains text the server rejected.');
  }
  if (booking.attendeeCount === null || booking.attendeeCount < 1) {
    add('attendeeCount', 'Enter the number of people expected.');
  } else if (booking.attendeeCount > MAX_ATTENDEES) {
    add('attendeeCount', `No venue holds more than ${MAX_ATTENDEES} people.`);
  }
  if (!BOOKING_OPTIONS.seatingArrangements.some((s) => s.id === booking.seatingArrangementId)) {
    add('seatingArrangement', 'Choose a seating arrangement.');
    add('seatingArrangementId', 'Choose a seating arrangement.');
  }
  const known = new Set(BOOKING_OPTIONS.resources.map((r) => r.id));
  if (booking.resources.some((r) => !known.has(r.resourceId) || r.quantity < 1)) {
    add('resources', 'One or more requested resources are not valid.');
  }
  if (booking.acceptedTermsVersion !== TERMS_VERSION) {
    add('termsAccepted', 'Accept the current terms and conditions.');
  }
  return errors;
}

function validResources(value: unknown): value is BookingResourceRequest[] {
  return (
    Array.isArray(value) &&
    value.every(
      (r) =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as BookingResourceRequest).resourceId === 'string' &&
        Number.isInteger((r as BookingResourceRequest).quantity) &&
        (r as BookingResourceRequest).quantity >= 1,
    )
  );
}

// --- rules ------------------------------------------------------------------------------------

/** What the caller may do with a booking, now. Never offered if it would fail. */
export function actionsFor(
  booking: StoredBooking,
  now: DateTime,
): { cancel: ActionAvailability; reschedule: ActionAvailability } {
  const none: ActionAvailability = { allowed: false, blockedReason: null };
  const hoursToStart = DateTime.fromISO(booking.startsAt, { zone: 'utc' }).diff(now, 'hours').hours;
  const tooClose = hoursToStart < CHANGE_NOTICE_HOURS;

  if (booking.status === 'pending') {
    return { cancel: { allowed: true, blockedReason: null }, reschedule: none };
  }
  if (booking.status !== 'approved') return { cancel: none, reschedule: none };

  return {
    cancel: tooClose
      ? {
          allowed: false,
          blockedReason: `This booking starts in less than ${CHANGE_NOTICE_HOURS} hours, so it can no longer be cancelled online. Please contact the municipality.`,
        }
      : { allowed: true, blockedReason: null },
    reschedule: booking.rescheduleRequest
      ? {
          allowed: false,
          blockedReason: 'A change of date has already been requested for this booking.',
        }
      : tooClose
        ? {
            allowed: false,
            blockedReason: `A change of date must be requested at least ${CHANGE_NOTICE_HOURS} hours before the event.`,
          }
        : { allowed: true, blockedReason: null },
  };
}

const present = (booking: StoredBooking, now: DateTime): Booking => ({
  ...booking,
  actions: actionsFor(booking, now),
});

export function groupOf(
  booking: StoredBooking,
  now: DateTime,
): { group: BookingGroup; isPast: boolean } {
  const isPast = DateTime.fromISO(booking.endsAt, { zone: 'utc' }) < now;
  if (isPast) return { group: 'closed', isPast };
  if (booking.status === 'draft' || booking.status === 'pending')
    return { group: 'attention', isPast };
  if (booking.status === 'approved') return { group: 'upcoming', isPast };
  return { group: 'closed', isPast };
}

function toListItem(booking: StoredBooking, now: DateTime): BookingListItem {
  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    ...groupOf(booking, now),
    facility: booking.facility,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    eventTypeName:
      BOOKING_OPTIONS.eventTypes.find((t) => t.id === booking.eventTypeId)?.name ?? null,
    description: booking.description,
    submittedAt: booking.submittedAt,
    updatedAt: booking.updatedAt,
    holdExpiresAt: booking.holdExpiresAt,
    hasPendingReschedule: booking.rescheduleRequest !== null,
  };
}

const GROUP_RANK: Record<BookingGroup, number> = { attention: 0, upcoming: 1, closed: 2 };
const STATUS_RANK: Record<BookingStatus, number> = {
  draft: 0,
  pending: 1,
  approved: 2,
  rejected: 3,
  cancelled: 4,
};

function comparator(sort: BookingSort, now: DateTime) {
  const byStart = (a: BookingListItem, b: BookingListItem) => a.startsAt.localeCompare(b.startsAt);
  const bySubmitted = (a: BookingListItem, b: BookingListItem) =>
    (a.submittedAt ?? '9999').localeCompare(b.submittedAt ?? '9999');
  void now;
  switch (sort) {
    case 'eventDate':
      return byStart;
    case '-eventDate':
      return (a: BookingListItem, b: BookingListItem) => byStart(b, a);
    case 'submitted':
      return bySubmitted;
    case '-submitted':
      return (a: BookingListItem, b: BookingListItem) => bySubmitted(b, a);
    case 'status':
      return (a: BookingListItem, b: BookingListItem) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] || byStart(a, b);
    case 'attention':
      return (a: BookingListItem, b: BookingListItem) =>
        GROUP_RANK[a.group] - GROUP_RANK[b.group] ||
        // Within what needs attention, drafts come before pending requests.
        (a.group === 'attention' ? STATUS_RANK[a.status] - STATUS_RANK[b.status] : 0) ||
        // Closed items read newest first; the rest soonest first.
        (a.group === 'closed' ? byStart(b, a) : byStart(a, b));
  }
}

class BadQuery extends Error {}

export function parseListParams(search: URLSearchParams): BookingListParams {
  const integer = (name: string) => {
    const raw = search.get(name);
    if (raw === null) return undefined;
    if (!/^\d+$/.test(raw)) throw new BadQuery(`"${name}" must be a non-negative integer.`);
    return Number(raw);
  };
  const statuses = search.getAll('status');
  for (const status of statuses) {
    if (!BOOKING_STATUSES.includes(status as BookingStatus)) {
      throw new BadQuery(`"status" must be one of: ${BOOKING_STATUSES.join(', ')}.`);
    }
  }
  const sort = search.get('sort');
  if (sort !== null && !BOOKING_SORTS.includes(sort as BookingSort)) {
    throw new BadQuery(`"sort" must be one of: ${BOOKING_SORTS.join(', ')}.`);
  }
  for (const name of ['from', 'to']) {
    const value = search.get(name);
    if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadQuery(`"${name}" must be an ISO date (YYYY-MM-DD).`);
    }
  }
  return {
    q: search.get('q') ?? undefined,
    status: statuses as BookingStatus[],
    from: search.get('from') ?? undefined,
    to: search.get('to') ?? undefined,
    facilityId: search.getAll('facilityId'),
    sort: (sort as BookingSort | null) ?? undefined,
    page: integer('page'),
    pageSize: integer('pageSize'),
  };
}

function filterBookings(bookings: StoredBooking[], params: BookingListParams): StoredBooking[] {
  const words = (params.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return bookings.filter((b) => {
    if (params.status?.length && !params.status.includes(b.status)) return false;
    if (params.facilityId?.length && !params.facilityId.includes(b.facilityId)) return false;
    const date =
      DateTime.fromISO(b.startsAt, { zone: 'utc' }).setZone(b.facility.timeZone).toISODate() ?? '';
    if (params.from && date < params.from) return false;
    if (params.to && date > params.to) return false;
    if (words.length > 0) {
      const haystack = [b.reference, b.facility.name, b.description].join(' ').toLowerCase();
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  });
}

/** The booking's summary list, for tests and handlers alike. */
export function listBookings(
  owned: StoredBooking[],
  params: BookingListParams,
  now: DateTime,
): {
  items: BookingListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
} {
  const items = filterBookings(owned, params)
    .map((b) => toListItem(b, now))
    .sort(comparator(params.sort ?? 'attention', now));
  const size = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * size;
  return {
    items: items.slice(start, start + size),
    page,
    pageSize: size,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / size),
  };
}

export interface BookingHandlerOptions {
  delayMs: number;
  catalogue: () => readonly FacilitySummary[];
  now?: () => DateTime;
  /** Forces a slot conflict on every submit. */
  forceConflict?: () => boolean;
  /** Makes the caller look like an applicant with no bookings. */
  empty?: () => boolean;
  fail?: () => boolean;
  /** Each facility's own rules from administration. */
  settings?: (facilityId: string) => FacilitySettings | undefined;
}

export function createBookingHandlers(
  root: string,
  {
    delayMs,
    catalogue,
    now = () => DateTime.now(),
    forceConflict,
    empty,
    fail,
    settings,
  }: BookingHandlerOptions,
) {
  const wait = () => (delayMs > 0 ? delay(delayMs) : Promise.resolve());
  const stamp = () => instant(now());
  let startedAt: DateTime | undefined;
  const failure = () => problem(500, 'Mock failure', 'The booking service is unavailable.');
  const owned = (caller: string) => (empty?.() ? [] : bookingStore.ownedBy(caller));
  const history = (
    booking: StoredBooking,
    type: BookingHistoryEntry['type'],
    actor: BookingHistoryEntry['actor'],
    note: string | null = null,
  ): BookingHistoryEntry[] => [
    ...booking.history,
    { id: `h-${booking.history.length + 1}`, type, at: stamp(), actor, note },
  ];

  /** The availability engine, including requests that already hold time. */
  const availabilityFor = (facility: FacilitySummary, date: string, excludeId?: string) => {
    const current = now();
    startedAt ??= current;
    const ledger = buildLedger({
      now: current,
      startedAt,
      catalogue: catalogue(),
      bufferOf: bufferOf(settings),
    });
    ledger.bookings.push(...bookingStore.holds(excludeId, bufferOf(settings)));
    return computeAvailability({
      facility,
      catalogue: catalogue(),
      ledger,
      from: date,
      to: date,
      now: current,
      settings,
    });
  };

  /** A window the engine says is not free, as a 409 slot conflict. */
  const conflictFor = (
    window: { start: DateTime; end: DateTime },
    blocked: NonNullable<ReturnType<typeof windowProblem>>,
  ) => {
    const segment = blocked.segment;
    const extensions: SlotConflictExtensions = {
      conflictingWindow: segment
        ? {
            startsAt: instant(
              DateTime.max(window.start, DateTime.fromISO(segment.startsAt, { zone: 'utc' })),
            ),
            endsAt: instant(
              DateTime.min(window.end, DateTime.fromISO(segment.endsAt, { zone: 'utc' })),
            ),
          }
        : { startsAt: instant(window.start), endsAt: instant(window.end) },
      ...(segment?.relatedFacility ? { relatedFacility: segment.relatedFacility } : {}),
      reason: segment?.relatedFacility
        ? `${segment.relatedFacility.name} is booked`
        : segment?.status === 'held'
          ? 'Held by another request'
          : blocked.message,
    };
    return problem(409, 'That time is no longer available', blocked.message, {
      type: SLOT_CONFLICT_PROBLEM_TYPE,
      ...extensions,
    });
  };

  const notAllowed = (reason: string) =>
    problem(409, 'That is not allowed', reason, { type: ACTION_NOT_ALLOWED_PROBLEM_TYPE });

  return [
    http.get(`${root}/booking-options`, async () => {
      await wait();
      if (fail?.()) return failure();
      return HttpResponse.json(BOOKING_OPTIONS);
    }),

    // The caller's own bookings. The caller comes from the token, never from a parameter.
    http.get(`${root}/bookings`, async ({ request }) => {
      await wait();
      if (fail?.()) return failure();
      try {
        const params = parseListParams(new URL(request.url).searchParams);
        const result = listBookings(owned(callerOf(request)), params, now());
        return HttpResponse.json(result);
      } catch (error) {
        if (error instanceof BadQuery) return problem(400, 'Invalid query', error.message);
        throw error;
      }
    }),

    http.get(`${root}/bookings/summary`, async ({ request }) => {
      await wait();
      if (fail?.()) return failure();
      try {
        const all = owned(callerOf(request));
        const params = parseListParams(new URL(request.url).searchParams);
        const counts: Record<BookingGroup, number> = { attention: 0, upcoming: 0, closed: 0 };
        for (const b of filterBookings(all, params)) counts[groupOf(b, now()).group] += 1;
        const facilities = [...new Map(all.map((b) => [b.facility.id, b.facility.name]))]
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const body: BookingsSummary = { overall: all.length, matching: counts, facilities };
        return HttpResponse.json(body);
      } catch (error) {
        if (error instanceof BadQuery) return problem(400, 'Invalid query', error.message);
        throw error;
      }
    }),

    http.post(`${root}/bookings`, async ({ request }) => {
      await wait();
      if (fail?.()) return failure();
      const body = (await request.json()) as Partial<BookingFields>;
      const facility = catalogue().find((f) => f.id === body.facilityId);
      const errors: Record<string, string[]> = {};
      if (!facility) errors.facilityId = ['Choose a facility.'];
      if (!isInstant(body.startsAt)) errors.startsAt = ['Choose a start time.'];
      if (!isInstant(body.endsAt)) errors.endsAt = ['Choose an end time.'];
      if (!facility || Object.keys(errors).length > 0) return validationProblem(errors);

      const sequence = bookingStore.nextSequence();
      const booking: StoredBooking = {
        id: `bk-${sequence}`,
        reference: `MVL-${now().year}-${String(sequence).padStart(5, '0')}`,
        status: 'draft',
        facilityId: facility.id,
        startsAt: body.startsAt as string,
        endsAt: body.endsAt as string,
        eventTypeId: null,
        description: '',
        attendeeCount: null,
        seatingArrangementId: null,
        resources: [],
        acceptedTermsVersion: null,
        facility: { id: facility.id, name: facility.name, timeZone: FACILITY_TIME_ZONE },
        documents: [],
        updatedAt: stamp(),
        submittedAt: null,
        holdExpiresAt: null,
        decidedAt: null,
        rejectionReason: null,
        cancellation: null,
        history: [],
        rescheduleRequest: null,
      };
      booking.history = history(booking, 'created', 'applicant');
      bookingStore.set(booking, callerOf(request));
      return HttpResponse.json(present(booking, now()), { status: 201 });
    }),

    http.get(`${root}/bookings/:id`, async ({ params, request }) => {
      await wait();
      if (fail?.()) return failure();
      const booking = owned(callerOf(request)).find((b) => b.id === params.id);
      return booking ? HttpResponse.json(present(booking, now())) : notFound();
    }),

    // Updating a draft never holds or reserves time.
    http.patch(`${root}/bookings/:id`, async ({ params, request }) => {
      await wait();
      if (fail?.()) return failure();
      const booking = bookingStore.get(String(params.id), callerOf(request));
      if (!booking) return notFound();
      if (booking.status !== 'draft') {
        return problem(409, 'Booking is not a draft', 'Only a draft can be changed.');
      }
      const body = (await request.json()) as Partial<BookingFields>;
      const errors: Record<string, string[]> = {};
      if (body.resources !== undefined && !validResources(body.resources)) {
        errors.resources = ['Each resource needs an id and a whole number quantity of at least 1.'];
      }
      if (body.facilityId !== undefined && !catalogue().some((f) => f.id === body.facilityId)) {
        errors.facilityId = ['Choose a facility.'];
      }
      if (Object.keys(errors).length > 0) return validationProblem(errors);

      const facility = catalogue().find((f) => f.id === (body.facilityId ?? booking.facilityId));
      const updated: StoredBooking = {
        ...booking,
        ...body,
        facility: facility
          ? { id: facility.id, name: facility.name, timeZone: FACILITY_TIME_ZONE }
          : booking.facility,
        updatedAt: stamp(),
      };
      bookingStore.update(updated);
      return HttpResponse.json(present(updated, now()));
    }),

    http.delete(`${root}/bookings/:id`, async ({ params, request }) => {
      await wait();
      if (fail?.()) return failure();
      const booking = bookingStore.get(String(params.id), callerOf(request));
      if (!booking) return notFound();
      if (booking.status !== 'draft') return notAllowed('Only a draft can be deleted.');
      bookingStore.remove(booking.id);
      return new HttpResponse(null, { status: 204 });
    }),

    http.post(`${root}/bookings/:id/documents`, async ({ params, request }) => {
      await wait();
      const booking = bookingStore.get(String(params.id), callerOf(request));
      if (!booking) return notFound();
      const form = await request.formData();
      const entry = form.get('file');
      // Duck typed: the server's File and the test environment's are different classes.
      if (entry === null || typeof entry === 'string') {
        return validationProblem({ file: ['Choose a file to upload.'] });
      }
      const file = entry as { name: string; size: number };

      const { uploads } = BOOKING_OPTIONS;
      const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
      const accepted = uploads.acceptedTypes.find((t) => t.extension === extension);
      if (!accepted) {
        return validationProblem({ file: [`${file.name} is not an accepted file type.`] });
      }
      if (file.size > uploads.maxFileSizeBytes) {
        return validationProblem({ file: [`${file.name} is larger than the size limit.`] });
      }
      if (booking.documents.length >= uploads.maxFiles) {
        return validationProblem({ file: [`You can attach at most ${uploads.maxFiles} files.`] });
      }
      if (file.name.toLowerCase().includes('fail')) {
        return problem(500, 'Upload failed', 'The file could not be stored. Please try again.');
      }
      const document: BookingDocument = {
        id: `doc-${booking.documents.length + 1}-${file.name}`,
        name: file.name,
        sizeBytes: file.size,
        contentType: accepted.contentType,
        uploadedAt: stamp(),
      };
      bookingStore.update({
        ...booking,
        documents: [...booking.documents, document],
        updatedAt: stamp(),
      });
      return HttpResponse.json(document, { status: 201 });
    }),

    http.get(`${root}/bookings/:id/documents/:documentId`, async ({ params, request }) => {
      await wait();
      const booking = bookingStore.get(String(params.id), callerOf(request));
      const document = booking?.documents.find((d) => d.id === params.documentId);
      if (!booking || !document) return notFound();
      return new HttpResponse(`Mock contents of ${document.name}`, {
        headers: {
          'Content-Type': document.contentType,
          'Content-Disposition': `attachment; filename="${document.name}"`,
        },
      });
    }),

    http.delete(`${root}/bookings/:id/documents/:documentId`, async ({ params, request }) => {
      await wait();
      const booking = bookingStore.get(String(params.id), callerOf(request));
      if (!booking) return notFound();
      bookingStore.update({
        ...booking,
        documents: booking.documents.filter((d) => d.id !== params.documentId),
        updatedAt: stamp(),
      });
      return new HttpResponse(null, { status: 204 });
    }),

    // The only call that checks availability and creates the hold.
    http.post(`${root}/bookings/:id/submit`, async ({ params, request }) => {
      await wait();
      if (fail?.()) return failure();
      const booking = bookingStore.get(String(params.id), callerOf(request));
      if (!booking) return notFound();
      if (booking.status !== 'draft') return HttpResponse.json(present(booking, now()));

      const errors = validateForSubmit(booking);
      if (Object.keys(errors).length > 0) return validationProblem(errors);

      const facility = catalogue().find((f) => f.id === booking.facilityId);
      if (!facility) return problem(404, 'Facility not found');

      const window = {
        start: DateTime.fromISO(booking.startsAt, { zone: 'utc' }),
        end: DateTime.fromISO(booking.endsAt, { zone: 'utc' }),
      };
      const date = window.start.setZone(FACILITY_TIME_ZONE).toISODate() ?? '';
      const availability = availabilityFor(facility, date, booking.id);
      const blocked = forceConflict?.()
        ? { message: 'Booked', segment: undefined }
        : windowProblem(window, availability.days[0], rulesOf(availability), now());
      if (blocked) return conflictFor(window, blocked);

      const submittedAt = stamp();
      const submitted: StoredBooking = {
        ...booking,
        status: 'pending',
        submittedAt,
        updatedAt: submittedAt,
        holdExpiresAt: instant(now().plus({ hours: HOLD_HOURS })),
      };
      submitted.history = history(submitted, 'submitted', 'applicant');
      bookingStore.update(submitted);
      return HttpResponse.json(present(submitted, now()));
    }),

    http.post(`${root}/bookings/:id/cancel`, async ({ params, request }) => {
      await wait();
      if (fail?.()) return failure();
      const booking = bookingStore.get(String(params.id), callerOf(request));
      if (!booking) return notFound();
      const { cancel } = actionsFor(booking, now());
      if (!cancel.allowed) {
        return notAllowed(cancel.blockedReason ?? 'This booking cannot be cancelled.');
      }
      const body = (await request.json().catch(() => ({}))) as { reason?: string };
      const reason = body.reason?.trim() || null;
      const cancelled: StoredBooking = {
        ...booking,
        status: 'cancelled',
        holdExpiresAt: null,
        rescheduleRequest: null,
        updatedAt: stamp(),
        cancellation: { cancelledAt: stamp(), cancelledBy: 'applicant', reason },
      };
      cancelled.history = history(cancelled, 'cancelled', 'applicant', reason);
      bookingStore.update(cancelled);
      return HttpResponse.json(present(cancelled, now()));
    }),

    // A request, not a change: the booking stays approved on its original window.
    http.post(`${root}/bookings/:id/reschedule`, async ({ params, request }) => {
      await wait();
      if (fail?.()) return failure();
      const booking = bookingStore.get(String(params.id), callerOf(request));
      if (!booking) return notFound();
      const { reschedule } = actionsFor(booking, now());
      if (!reschedule.allowed) {
        return notAllowed(reschedule.blockedReason ?? 'This booking cannot be rescheduled.');
      }
      const body = (await request.json()) as { startsAt?: unknown; endsAt?: unknown };
      if (!isInstant(body.startsAt) || !isInstant(body.endsAt)) {
        return validationProblem({ startsAt: ['Choose a start and an end time.'] });
      }
      const window = {
        start: DateTime.fromISO(body.startsAt, { zone: 'utc' }),
        end: DateTime.fromISO(body.endsAt, { zone: 'utc' }),
      };
      const facility = catalogue().find((f) => f.id === booking.facilityId);
      if (!facility) return problem(404, 'Facility not found');
      const date = window.start.setZone(FACILITY_TIME_ZONE).toISODate() ?? '';
      // The booking's own time does not count against its own move.
      const availability = availabilityFor(facility, date, booking.id);
      const blocked = windowProblem(window, availability.days[0], rulesOf(availability), now());
      if (blocked) return conflictFor(window, blocked);

      const moved: StoredBooking = {
        ...booking,
        updatedAt: stamp(),
        rescheduleRequest: {
          id: `rs-${bookingStore.nextSequence()}`,
          proposedStartsAt: body.startsAt,
          proposedEndsAt: body.endsAt,
          requestedAt: stamp(),
          status: 'pending',
        },
      };
      moved.history = history(moved, 'reschedule_requested', 'applicant');
      bookingStore.update(moved);
      return HttpResponse.json(present(moved, now()));
    }),
  ];
}

export { MOCK_AVAILABILITY_RULES };
