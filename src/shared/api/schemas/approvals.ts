import { z } from 'zod';
import {
  APPROVAL_SORTS,
  type ApprovalCounts,
  type ApprovalDetail,
  type ApprovalListItem,
  type ApprovalListParams,
} from '../contracts/approvals';
import { actionAvailability, bookingDocument } from './bookings';
import { id, idName, instant, isoDate, nonNegativeInt, obj, paginated, pageParams } from './common';
import type { Assert, Same } from './same';

export const workItemType = z.enum(['booking_request', 'reschedule_request']);
export const approvalStatus = z.enum(['pending', 'approved', 'rejected']);

export const approvalWindow = obj({ startsAt: instant, endsAt: instant });

export const approvalListItem = obj({
  id: id.meta({
    description: 'A booking id for a booking request; a reschedule request id for a move.',
  }),
  type: workItemType,
  status: approvalStatus,
  bookingId: id,
  reference: z.string(),
  facility: obj({ id, name: z.string(), timeZone: z.string() }),
  startsAt: instant,
  endsAt: instant,
  currentWindow: approvalWindow.nullable(),
  applicantName: z.string(),
  eventTypeName: z.string().nullable(),
  raisedAt: instant,
  decidedAt: instant.nullable(),
  holdExpiresAt: instant.nullable(),
  turnaroundTargetHours: nonNegativeInt.nullable(),
  competingCount: nonNegativeInt,
  approvable: z.boolean(),
});

export const approvalList = paginated(approvalListItem);

export const approvalListQuery = z.strictObject({
  q: z.string().optional(),
  status: z
    .array(approvalStatus)
    .optional()
    .meta({ description: 'Defaults to pending when empty.' }),
  type: z.array(workItemType).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  facilityId: z.array(z.string()).optional(),
  sort: z.enum(APPROVAL_SORTS).optional().meta({ default: 'waiting' }),
  ...pageParams,
});

export const approvalCounts = obj({
  pending: nonNegativeInt,
  bookingRequests: nonNegativeInt,
  rescheduleRequests: nonNegativeInt,
  facilities: z.array(obj({ id, name: z.string(), pending: nonNegativeInt })),
});

export const competingRequest = obj({
  workItemId: id,
  workItemType,
  bookingId: id,
  reference: z.string(),
  applicantName: z.string(),
  startsAt: instant,
  endsAt: instant,
  overlap: approvalWindow,
  facility: idName,
  relationship: z.enum(['same_facility', 'parent', 'child']),
  submittedAt: instant,
  inYourQueue: z.boolean(),
});

export const decisionContext = obj({
  competingRequests: z.array(competingRequest),
  blockedBy: z.array(competingRequest),
  affectedFacilities: z.array(
    obj({ id, name: z.string(), relationship: z.enum(['parent', 'child']) }),
  ),
  holdExpiresAt: instant.nullable(),
  turnaroundTargetHours: nonNegativeInt.nullable(),
  applicantPreviousBookingsAtFacility: nonNegativeInt,
  capacity: obj({
    expectedAttendees: nonNegativeInt.nullable(),
    arrangement: z.string().nullable(),
    limit: nonNegativeInt.nullable(),
  }),
  capacityWarning: z.string().nullable(),
  resourceWarning: z.string().nullable(),
});

export const decisionRecord = obj({
  outcome: z.enum(['approved', 'rejected']),
  decidedBy: z.string().nullable(),
  decidedAt: instant,
  internalNote: z.string().nullable(),
  reason: z.string().nullable(),
});

export const approvalDetail = approvalListItem.extend({
  description: z.string(),
  attendeeCount: nonNegativeInt.nullable(),
  seatingArrangementName: z.string().nullable(),
  resources: z.array(
    obj({
      name: z.string(),
      category: z.enum(['venue', 'kitchen']),
      quantity: nonNegativeInt,
      quantified: z.boolean(),
    }),
  ),
  documents: z.array(bookingDocument),
  context: decisionContext,
  actions: obj({ approve: actionAvailability, reject: actionAvailability }),
  decision: decisionRecord.nullable(),
});

export const approveRequest = obj({ note: z.string().optional() });
export const rejectRequest = obj({ reason: z.string().min(1) });

export type _Checks = [
  Assert<Same<z.infer<typeof approvalListItem>, ApprovalListItem>>,
  Assert<Same<z.infer<typeof approvalDetail>, ApprovalDetail>>,
  Assert<Same<z.infer<typeof approvalListQuery>, ApprovalListParams>>,
  Assert<Same<z.infer<typeof approvalCounts>, ApprovalCounts>>,
];
