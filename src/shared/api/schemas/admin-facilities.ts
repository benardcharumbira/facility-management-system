import { z } from 'zod';
import {
  ADMIN_FACILITY_SORTS,
  type AdminBlackout,
  type AdminFacility,
  type AdminFacilityList,
  type AdminFacilityListParams,
  type FacilitySchedule,
  type FacilityType,
  type ImpactResult,
  type ProposedChange,
} from '../contracts/admin-facilities';
import { capacityByArrangement, operatingDay } from './facilities';
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

export const adminFacilityStatus = z.enum(['active', 'unavailable', 'archived']);

export const facilityType = obj({
  id,
  name: z.string(),
  capacityApplies: z.boolean(),
  facilityCount: nonNegativeInt,
});
export const createFacilityTypeRequest = obj({ name: z.string(), capacityApplies: z.boolean() });
export const updateFacilityTypeRequest = createFacilityTypeRequest.partial();

export const adminFacilityRow = obj({
  id,
  name: z.string(),
  code: z.string(),
  type: idName,
  locality: z.string(),
  status: adminFacilityStatus,
  parentFacility: idName.nullable(),
  childCount: nonNegativeInt,
  depth: nonNegativeInt,
  futureBookings: nonNegativeInt,
  blackoutActive: z.boolean(),
  approverCount: nonNegativeInt,
});

export const adminFacilityList = paginated(adminFacilityRow).extend({
  withoutApprover: nonNegativeInt,
  localities: z.array(z.string()),
});

export const adminFacilityListQuery = z.strictObject({
  q: z.string().optional(),
  type: z.array(z.string()).optional(),
  locality: z.array(z.string()).optional(),
  status: z
    .array(adminFacilityStatus)
    .optional()
    .meta({ description: 'Archived facilities are left out unless asked for.' }),
  structure: z.array(z.enum(['parent', 'child', 'standalone'])).optional(),
  sort: z.enum(ADMIN_FACILITY_SORTS).optional().meta({ default: 'hierarchy' }),
  ...pageParams,
});

export const adminFacilityImage = obj({
  id,
  url: z.string(),
  caption: z.string(),
  isPrimary: z.boolean(),
});

export const facilitySchedule = obj({
  days: z.array(operatingDay).length(7),
  setupMinutes: nonNegativeInt,
  teardownMinutes: nonNegativeInt,
  minimumNoticeHours: nonNegativeInt,
  maximumHorizonDays: int.min(1),
  maximumBookingDays: int.min(1).max(31),
});

export const facilityCapacity = obj({
  maximum: nonNegativeInt.nullable(),
  byArrangement: z.array(capacityByArrangement),
});

export const approver = obj({ id, name: z.string(), email: z.string() });

export const adminFacility = obj({
  id,
  name: z.string(),
  timeZone: z.string(),
  code: z.string(),
  type: obj({ id, name: z.string(), capacityApplies: z.boolean() }),
  locality: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  status: adminFacilityStatus,
  parentFacility: idName.nullable(),
  children: z.array(obj({ id, name: z.string(), status: adminFacilityStatus })),
  eligibleParents: z.array(idName),
  images: z.array(adminFacilityImage),
  schedule: facilitySchedule,
  capacity: facilityCapacity,
  approvers: z.array(approver),
  futureBookings: nonNegativeInt,
  provisionalFields: z.array(z.string()),
});

const detailsFields = {
  name: z.string(),
  code: z.string(),
  typeId: z.string(),
  locality: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  parentFacilityId: z.string().nullable(),
};
export const createFacilityRequest = obj(detailsFields);
export const updateFacilityRequest = obj({
  ...detailsFields,
  status: z.enum(['active', 'unavailable']),
}).partial();

export const adminBlackout = obj({
  id,
  startsAt: instant,
  endsAt: instant,
  allDay: z.boolean(),
  reason: z.string(),
  inheritedFrom: idName.nullable(),
  state: z.enum(['past', 'current', 'future']),
});
export const createBlackoutRequest = obj({
  startsAt: instant,
  endsAt: instant,
  allDay: z.boolean(),
  reason: z.string(),
});

export const updateImageRequest = obj({
  caption: z.string().optional(),
  isPrimary: z.literal(true).optional(),
  position: nonNegativeInt.optional(),
});
export const uploadImageBody = z.object({
  file: z.string().meta({ format: 'binary' }),
  caption: z.string(),
});

export const setApproversRequest = obj({ userIds: z.array(z.string()) });

export const proposedChange = z.discriminatedUnion('kind', [
  obj({ kind: z.literal('status'), status: z.enum(['active', 'unavailable']) }),
  obj({ kind: z.literal('hierarchy'), parentFacilityId: z.string().nullable() }),
  obj({ kind: z.literal('schedule'), schedule: facilitySchedule }),
  obj({ kind: z.literal('blackout'), blackout: createBlackoutRequest }),
  obj({ kind: z.literal('capacity'), capacity: facilityCapacity }),
  obj({ kind: z.literal('archive') }),
  obj({ kind: z.literal('details') }),
]);

export const impactReason = z.enum([
  'inside_blackout',
  'outside_operating_hours',
  'new_conflict',
  'over_capacity',
  'facility_unavailable',
  'resource_shortfall',
  'resource_withdrawn',
  'resource_archived',
  'no_approver',
  'arrangement_archived',
]);

export const impactedBooking = obj({
  bookingId: id,
  reference: z.string(),
  applicantName: z.string(),
  facility: obj({ id, name: z.string(), timeZone: z.string() }),
  startsAt: instant,
  endsAt: instant,
  status: z.string().meta({ description: '`approved` or `pending`.' }),
  reason: impactReason,
  resource: obj({
    id,
    name: z.string(),
    requested: nonNegativeInt,
    available: nonNegativeInt.nullable(),
  }).optional(),
  day: isoDate.optional(),
  conflictsWith: obj({ bookingId: id, reference: z.string(), facility: idName }).nullable(),
});

export const impactResult = obj({
  affectedBookings: z.array(impactedBooking),
  totalAffected: nonNegativeInt,
});

export type _Checks = [
  Assert<Same<z.infer<typeof facilityType>, FacilityType>>,
  Assert<Same<z.infer<typeof adminFacilityList>, AdminFacilityList>>,
  Assert<Same<z.infer<typeof adminFacilityListQuery>, AdminFacilityListParams>>,
  Assert<Same<z.infer<typeof adminFacility>, AdminFacility>>,
  Assert<Same<z.infer<typeof facilitySchedule>, FacilitySchedule>>,
  Assert<Same<z.infer<typeof adminBlackout>, AdminBlackout>>,
  Assert<Same<z.infer<typeof proposedChange>, ProposedChange>>,
  Assert<Same<z.infer<typeof impactResult>, ImpactResult>>,
];
