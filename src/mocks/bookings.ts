/**
 * The server side behaviour the real booking API must reproduce. In particular: drafts never
 * hold time; `submit` is the only call that checks availability and creates the hold; a lost
 * race is a 409 slot conflict problem document; validation failures are field level errors.
 *
 * Reviewers can force states: `?mock=conflict` on the page URL makes every submit a slot
 * conflict, a description containing `[invalid]` makes submit return a field error, and a file
 * whose name contains `fail` fails to upload.
 */
import { DateTime } from 'luxon';
import { HttpResponse, http, delay } from 'msw';
import {
  SLOT_CONFLICT_PROBLEM_TYPE,
  type Booking,
  type BookingDocument,
  type BookingFields,
  type BookingResourceRequest,
  type FacilitySummary,
  type SlotConflictExtensions,
} from '@/shared/api';
import { rulesOf, windowProblem } from '@/shared/utils/availability';
import { computeAvailability, MOCK_AVAILABILITY_RULES } from './availability';
import { FACILITY_TIME_ZONE, buildLedger } from './data/bookingLedger';
import { BOOKING_OPTIONS, TERMS_VERSION } from './data/bookingOptions';
import { bookingStore } from './data/bookingStore';

const MAX_DESCRIPTION = 1000;
const MAX_ATTENDEES = 5000;

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

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && DateTime.fromISO(value, { zone: 'utc' }).isValid;
}

/** Field level validation of a booking that is being submitted. */
export function validateForSubmit(booking: Booking): Record<string, string[]> {
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

export interface BookingHandlerOptions {
  delayMs: number;
  catalogue: () => readonly FacilitySummary[];
  now?: () => DateTime;
  /** Forces a slot conflict on every submit. */
  forceConflict?: () => boolean;
  fail?: () => boolean;
}

export function createBookingHandlers(
  root: string,
  { delayMs, catalogue, now = () => DateTime.now(), forceConflict, fail }: BookingHandlerOptions,
) {
  const wait = () => (delayMs > 0 ? delay(delayMs) : Promise.resolve());
  const stamp = () => now().toUTC().toISO({ suppressMilliseconds: true }) ?? '';
  let startedAt: DateTime | undefined;

  /** The availability engine, including requests that already hold time. */
  const availabilityFor = (facility: FacilitySummary, date: string) => {
    const current = now();
    startedAt ??= current;
    const ledger = buildLedger({ now: current, startedAt, catalogue: catalogue() });
    ledger.bookings.push(...bookingStore.holds());
    return computeAvailability({
      facility,
      catalogue: catalogue(),
      ledger,
      from: date,
      to: date,
      now: current,
    });
  };

  return [
    http.get(`${root}/booking-options`, async () => {
      await wait();
      if (fail?.()) return problem(500, 'Mock failure', 'The booking service is unavailable.');
      return HttpResponse.json(BOOKING_OPTIONS);
    }),

    http.post(`${root}/bookings`, async ({ request }) => {
      await wait();
      if (fail?.()) return problem(500, 'Mock failure', 'The booking service is unavailable.');
      const body = (await request.json()) as Partial<BookingFields>;
      const facility = catalogue().find((f) => f.id === body.facilityId);
      const errors: Record<string, string[]> = {};
      if (!facility) errors.facilityId = ['Choose a facility.'];
      if (!isInstant(body.startsAt)) errors.startsAt = ['Choose a start time.'];
      if (!isInstant(body.endsAt)) errors.endsAt = ['Choose an end time.'];
      if (!facility || Object.keys(errors).length > 0) return validationProblem(errors);

      const sequence = bookingStore.nextSequence();
      const booking: Booking = {
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
      };
      bookingStore.set(booking);
      return HttpResponse.json(booking, { status: 201 });
    }),

    http.get(`${root}/bookings/:id`, async ({ params }) => {
      await wait();
      if (fail?.()) return problem(500, 'Mock failure', 'The booking service is unavailable.');
      const booking = bookingStore.get(String(params.id));
      return booking ? HttpResponse.json(booking) : problem(404, 'Booking not found');
    }),

    // Updating a draft never holds or reserves time.
    http.patch(`${root}/bookings/:id`, async ({ params, request }) => {
      await wait();
      if (fail?.()) return problem(500, 'Mock failure', 'The booking service is unavailable.');
      const booking = bookingStore.get(String(params.id));
      if (!booking) return problem(404, 'Booking not found');
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
      const updated: Booking = {
        ...booking,
        ...body,
        facility: facility
          ? { id: facility.id, name: facility.name, timeZone: FACILITY_TIME_ZONE }
          : booking.facility,
        updatedAt: stamp(),
      };
      bookingStore.set(updated);
      return HttpResponse.json(updated);
    }),

    http.post(`${root}/bookings/:id/documents`, async ({ params, request }) => {
      await wait();
      const booking = bookingStore.get(String(params.id));
      if (!booking) return problem(404, 'Booking not found');
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
      bookingStore.set({
        ...booking,
        documents: [...booking.documents, document],
        updatedAt: stamp(),
      });
      return HttpResponse.json(document, { status: 201 });
    }),

    http.delete(`${root}/bookings/:id/documents/:documentId`, async ({ params }) => {
      await wait();
      const booking = bookingStore.get(String(params.id));
      if (!booking) return problem(404, 'Booking not found');
      bookingStore.set({
        ...booking,
        documents: booking.documents.filter((d) => d.id !== params.documentId),
        updatedAt: stamp(),
      });
      return new HttpResponse(null, { status: 204 });
    }),

    // The only call that checks availability and creates the hold.
    http.post(`${root}/bookings/:id/submit`, async ({ params }) => {
      await wait();
      if (fail?.()) return problem(500, 'Mock failure', 'The booking service is unavailable.');
      const booking = bookingStore.get(String(params.id));
      if (!booking) return problem(404, 'Booking not found');
      if (booking.status === 'pending') return HttpResponse.json(booking);

      const errors = validateForSubmit(booking);
      if (Object.keys(errors).length > 0) return validationProblem(errors);

      const facility = catalogue().find((f) => f.id === booking.facilityId);
      if (!facility) return problem(404, 'Facility not found');

      const window = {
        start: DateTime.fromISO(booking.startsAt, { zone: 'utc' }),
        end: DateTime.fromISO(booking.endsAt, { zone: 'utc' }),
      };
      const date = window.start.setZone(FACILITY_TIME_ZONE).toISODate() ?? '';
      const availability = availabilityFor(facility, date);
      const blocked = forceConflict?.()
        ? { message: 'Booked', segment: undefined }
        : windowProblem(window, availability.days[0], rulesOf(availability), now());

      if (blocked) {
        const segment = blocked.segment;
        const extensions: SlotConflictExtensions = {
          conflictingWindow: segment
            ? {
                startsAt:
                  DateTime.max(window.start, DateTime.fromISO(segment.startsAt, { zone: 'utc' }))
                    .toUTC()
                    .toISO({ suppressMilliseconds: true }) ?? '',
                endsAt:
                  DateTime.min(window.end, DateTime.fromISO(segment.endsAt, { zone: 'utc' }))
                    .toUTC()
                    .toISO({ suppressMilliseconds: true }) ?? '',
              }
            : { startsAt: booking.startsAt, endsAt: booking.endsAt },
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
      }

      const submitted: Booking = {
        ...booking,
        status: 'pending',
        submittedAt: stamp(),
        updatedAt: stamp(),
      };
      bookingStore.set(submitted);
      return HttpResponse.json(submitted);
    }),
  ];
}

export { MOCK_AVAILABILITY_RULES };
