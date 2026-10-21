import { z } from 'zod';
import {
  BOOKING_SORTS,
  type Booking,
  type BookingFields,
  type BookingListItem,
  type BookingListParams,
  type BookingOptions,
  type BookingsSummary,
} from '../contracts/bookings';
import {
  id,
  idName,
  instant,
  isoDate,
  int,
  nonNegativeInt,
  obj,
  paginated,
  pageParams,
} from './common';
import type { Assert, Same } from './same';

export const bookingStatus = z.enum(['draft', 'pending', 'approved', 'rejected', 'cancelled']);
export const bookingActor = z.enum(['applicant', 'municipality']);
export const bookingGroup = z.enum(['attention', 'upcoming', 'closed']);

export const bookingResourceRequest = obj({
  resourceId: id,
  quantity: int.min(1),
});

export const bookingFields = obj({
  facilityId: id,
  startsAt: instant,
  endsAt: instant,
  eventTypeId: z.string().nullable(),
  description: z.string(),
  attendeeCount: nonNegativeInt.nullable(),
  seatingArrangementId: z.string().nullable(),
  resources: z.array(bookingResourceRequest),
  acceptedTermsVersion: z.string().nullable(),
});

export const createBookingRequest = bookingFields.pick({
  facilityId: true,
  startsAt: true,
  endsAt: true,
});
export const updateBookingRequest = bookingFields.partial();

export const bookingDocument = obj({
  id,
  name: z.string(),
  sizeBytes: nonNegativeInt,
  contentType: z.string(),
  uploadedAt: instant,
});

export const actionAvailability = obj({
  allowed: z.boolean(),
  blockedReason: z.string().nullable(),
});

export const bookingHistoryEntry = obj({
  id,
  type: z.enum([
    'created',
    'submitted',
    'approved',
    'rejected',
    'cancelled',
    'reschedule_requested',
    'reschedule_approved',
    'reschedule_declined',
  ]),
  at: instant,
  actor: bookingActor.nullable(),
  note: z.string().nullable(),
});

export const rescheduleRequest = obj({
  id,
  proposedStartsAt: instant,
  proposedEndsAt: instant,
  requestedAt: instant,
  status: z.literal('pending'),
});

export const bookingFacility = obj({ id, name: z.string(), timeZone: z.string() });

export const booking = bookingFields.extend({
  id,
  reference: z.string().meta({ example: 'MVL-2026-00417' }),
  status: bookingStatus,
  facility: bookingFacility,
  documents: z.array(bookingDocument),
  updatedAt: instant,
  submittedAt: instant.nullable(),
  holdExpiresAt: instant.nullable(),
  decidedAt: instant.nullable(),
  rejectionReason: z.string().nullable(),
  cancellation: obj({
    cancelledAt: instant,
    cancelledBy: bookingActor,
    reason: z.string().nullable(),
  }).nullable(),
  history: z.array(bookingHistoryEntry),
  rescheduleRequest: rescheduleRequest.nullable(),
  actions: obj({ cancel: actionAvailability, reschedule: actionAvailability }),
});

export const bookingListItem = obj({
  id,
  reference: z.string(),
  status: bookingStatus,
  group: bookingGroup,
  isPast: z.boolean(),
  facility: bookingFacility,
  startsAt: instant,
  endsAt: instant,
  eventTypeName: z.string().nullable(),
  description: z.string(),
  submittedAt: instant.nullable(),
  updatedAt: instant,
  holdExpiresAt: instant.nullable(),
  hasPendingReschedule: z.boolean(),
});

export const bookingList = paginated(bookingListItem);

export const bookingListQuery = z.strictObject({
  q: z.string().optional(),
  status: z.array(bookingStatus).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  facilityId: z.array(z.string()).optional(),
  sort: z.enum(BOOKING_SORTS).optional().meta({ default: 'attention' }),
  ...pageParams,
});

/** The summary follows the list's filters but not its page or sort. */
export const bookingSummaryQuery = bookingListQuery.omit({
  sort: true,
  page: true,
  pageSize: true,
});

export const bookingsSummary = obj({
  overall: nonNegativeInt,
  matching: obj({ attention: nonNegativeInt, upcoming: nonNegativeInt, closed: nonNegativeInt }),
  facilities: z.array(idName),
});

export const cancelBookingRequest = obj({ reason: z.string().optional() });
export const rescheduleBookingRequest = obj({ startsAt: instant, endsAt: instant });

export const bookingOptionItem = idName;
export const bookingResourceOption = idName.extend({
  category: z.enum(['venue', 'kitchen']),
  quantified: z.boolean(),
});

export const bookingOptions = obj({
  eventTypes: z.array(bookingOptionItem),
  seatingArrangements: z.array(bookingOptionItem),
  retiredEventTypes: z.array(bookingOptionItem),
  retiredSeatingArrangements: z.array(bookingOptionItem),
  resources: z.array(bookingResourceOption),
  retiredResources: z.array(bookingResourceOption),
  terms: obj({ version: z.string(), title: z.string(), paragraphs: z.array(z.string()) }),
  uploads: obj({
    maxFileSizeBytes: nonNegativeInt,
    maxFiles: nonNegativeInt,
    acceptedTypes: z.array(
      obj({ extension: z.string(), contentType: z.string(), label: z.string() }),
    ),
  }),
  expectedTurnaround: z.string().nullable(),
});

/** `multipart/form-data` with one part named `file`. */
export const uploadBody = z.object({ file: z.string().meta({ format: 'binary' }) });

export type _Checks = [
  Assert<Same<z.infer<typeof bookingFields>, BookingFields>>,
  Assert<Same<z.infer<typeof booking>, Booking>>,
  Assert<Same<z.infer<typeof bookingListItem>, BookingListItem>>,
  Assert<Same<z.infer<typeof bookingListQuery>, BookingListParams>>,
  Assert<Same<z.infer<typeof bookingsSummary>, BookingsSummary>>,
  Assert<Same<z.infer<typeof bookingOptions>, BookingOptions>>,
];
