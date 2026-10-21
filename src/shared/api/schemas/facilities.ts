import { z } from 'zod';
import {
  FACILITY_SORTS,
  FACILITY_STATUS_FILTERS,
  type FacilityDetail,
  type FacilityFilterOptions,
  type FacilityListParams,
  type FacilitySummary,
} from '../contracts/facilities';
import { id, idName, int, nonNegativeInt, obj, paginated, pageParams, timeOfDay } from './common';
import type { Assert, Same } from './same';

export const facilityStatus = z.enum(['active', 'unavailable']);

export const facilitySummary = obj({
  id,
  name: z.string(),
  code: z.string(),
  type: idName,
  parentFacility: idName.nullable().meta({ description: 'Set on a space inside a larger venue.' }),
  capacity: nonNegativeInt.nullable().meta({ description: 'Null where capacity does not apply.' }),
  locality: z.string(),
  shortDescription: z.string(),
  primaryImageUrl: z.string().nullable(),
  amenities: z.array(idName),
  status: facilityStatus,
  provisionalFields: z
    .array(z.string())
    .optional()
    .meta({ description: 'MOCK ONLY. The real API never sends it.' }),
});

export const facilityList = paginated(facilitySummary);

export const facilityListQuery = z.strictObject({
  q: z
    .string()
    .optional()
    .meta({
      description:
        'Every whitespace separated word must match name, code, short description or locality.',
    }),
  type: z.array(z.string()).optional().meta({ description: 'Repeated. Values are OR.' }),
  locality: z.array(z.string()).optional().meta({ description: 'Repeated. Values are OR.' }),
  minCapacity: nonNegativeInt.optional(),
  maxCapacity: nonNegativeInt.optional(),
  amenities: z
    .array(z.string())
    .optional()
    .meta({ description: 'Repeated. Values are AND: all must be present.' }),
  status: z.enum(FACILITY_STATUS_FILTERS).optional().meta({ default: 'active' }),
  sort: z.enum(FACILITY_SORTS).optional().meta({ default: 'name' }),
  ...pageParams,
});

export const filterOption = obj({ id, name: z.string(), count: nonNegativeInt });

export const facilityFilterOptions = obj({
  types: z.array(filterOption),
  localities: z.array(filterOption),
  amenities: z.array(idName),
  capacity: obj({ min: nonNegativeInt, max: nonNegativeInt }),
});

export const operatingDay = obj({
  dayOfWeek: int.min(1).max(7).meta({ description: '1 Monday to 7 Sunday.' }),
  opensAt: timeOfDay.nullable(),
  closesAt: timeOfDay.nullable(),
});

export const capacityByArrangement = obj({ arrangement: z.string(), capacity: nonNegativeInt });

export const facilityResource = obj({
  id,
  name: z.string(),
  category: z.enum(['venue', 'kitchen']),
  quantity: nonNegativeInt.nullable(),
  quantified: z.boolean(),
});

export const facilityDetail = facilitySummary.extend({
  description: z.string(),
  images: z.array(obj({ url: z.string(), caption: z.string().nullable() })),
  capacityByArrangement: z.array(capacityByArrangement).nullable(),
  resources: z.array(facilityResource),
  operatingSchedule: z.array(operatingDay),
  childFacilities: z.array(
    obj({ id, name: z.string(), type: z.string(), capacity: nonNegativeInt.nullable() }),
  ),
  siblingFacilities: z.array(obj({ id, name: z.string(), type: z.string() })),
  managedBy: z.string(),
  bookingNotes: z.string().nullable(),
  provisionalFields: z.array(z.string()),
});

// The schemas and the interfaces agree, or this file does not compile.
export type _Checks = [
  Assert<Same<z.infer<typeof facilitySummary>, FacilitySummary>>,
  Assert<Same<z.infer<typeof facilityDetail>, FacilityDetail>>,
  Assert<Same<z.infer<typeof facilityFilterOptions>, FacilityFilterOptions>>,
  Assert<Same<z.infer<typeof facilityListQuery>, FacilityListParams>>,
];
