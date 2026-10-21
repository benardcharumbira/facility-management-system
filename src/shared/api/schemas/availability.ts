import { z } from 'zod';
import type { FacilityAvailability } from '../contracts/availability';
import { id, instant, isoDate, int, nonNegativeInt, obj, timeOfDay, timeZone } from './common';
import type { Assert, Same } from './same';

export const segmentStatus = z.enum(['booked', 'held', 'buffer', 'blocked_by_related', 'closure']);

export const relatedFacility = obj({
  id,
  name: z.string(),
  relationship: z
    .enum(['parent', 'child'])
    .meta({ description: 'What the related facility is, relative to the one asked about.' }),
});

export const availabilitySegment = obj({
  startsAt: instant,
  endsAt: instant,
  status: segmentStatus,
  relatedFacility: relatedFacility
    .nullable()
    .meta({ description: 'Present only for blocked_by_related.' }),
  reason: z.string().optional().meta({ description: 'Present only for closure.' }),
  continuesBefore: z.boolean().optional(),
  continuesAfter: z.boolean().optional(),
});

export const closedBy = z.enum(['schedule', 'holiday', 'blackout']);

export const availabilityDay = obj({
  date: isoDate,
  status: z.enum(['available', 'partially_booked', 'fully_booked', 'closed']),
  opensAt: timeOfDay.nullable(),
  closesAt: timeOfDay.nullable(),
  closedReason: z.string().nullable(),
  closedBy: closedBy.nullable().optional(),
  segments: z.array(availabilitySegment),
});

export const facilityAvailability = obj({
  facilityId: id,
  timeZone,
  minimumNoticeHours: nonNegativeInt,
  maximumHorizonDays: int.min(1),
  minimumDurationMinutes: nonNegativeInt,
  maximumBookingDays: int.min(1),
  days: z.array(availabilityDay),
});

export const availabilityQuery = z.strictObject({
  from: isoDate.meta({ description: 'First day, inclusive, in the facility time zone.' }),
  to: isoDate.meta({ description: 'Last day, inclusive. At most 62 days from `from`.' }),
});

export type _Checks = [Assert<Same<z.infer<typeof facilityAvailability>, FacilityAvailability>>];
