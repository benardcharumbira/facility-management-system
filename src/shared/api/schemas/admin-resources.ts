import { z } from 'zod';
import {
  MAX_ALLOCATION,
  RESOURCE_SORTS,
  type AdminResource,
  type AdminResourceListParams,
  type AllocationMatrix,
  type FacilityAllocations,
  type ResourceImpactResult,
  type ResourceProposedChange,
} from '../contracts/admin-resources';
import { adminFacilityStatus, impactResult } from './admin-facilities';
import { id, nonNegativeInt, obj, paginated, pageParams } from './common';
import type { Assert, Same } from './same';

export const resourceCategory = z.enum(['venue', 'kitchen']);
export const resourceStatus = z.enum(['active', 'archived']);

/** A whole number for a counted resource, available or not for one that is not counted. */
export const allocationValue = z.union([z.number().int().min(0).max(MAX_ALLOCATION), z.boolean()]);

export const adminResourceRow = obj({
  id,
  name: z.string(),
  category: resourceCategory,
  quantified: z.boolean(),
  description: z.string().nullable(),
  status: resourceStatus,
  facilitiesHolding: nonNegativeInt,
});
export const adminResourceList = paginated(adminResourceRow);

export const adminResourceListQuery = z.strictObject({
  q: z.string().optional(),
  category: z.array(resourceCategory).optional(),
  status: z
    .array(resourceStatus)
    .optional()
    .meta({ description: 'Archived are left out unless asked for.' }),
  sort: z.enum(RESOURCE_SORTS).optional().meta({ default: 'category' }),
  ...pageParams,
});

export const adminResource = adminResourceRow.extend({
  futureBookings: nonNegativeInt,
  holders: z.array(obj({ facility: obj({ id, name: z.string() }), value: allocationValue })),
});

export const createResourceRequest = obj({
  name: z.string(),
  category: resourceCategory,
  quantified: z.boolean(),
  description: z.string().nullable(),
});
export const updateResourceRequest = createResourceRequest.partial();

export const resourceProposedChange = z.discriminatedUnion('kind', [
  obj({ kind: z.literal('details') }),
  obj({ kind: z.literal('quantified'), quantified: z.boolean() }),
  obj({ kind: z.literal('archive') }),
]);

export const resourceImpactResult = impactResult.extend({
  allocationsAffected: nonNegativeInt,
  facilitiesAffected: nonNegativeInt,
});

export const allocationChange = obj({ facilityId: id, resourceId: id, value: allocationValue });

export const allocationQuery = z.strictObject({
  facilityId: z.array(z.string()).optional(),
  category: z.array(resourceCategory).optional(),
});

export const allocationMatrix = obj({
  facilities: z.array(obj({ id, name: z.string(), status: adminFacilityStatus })),
  resources: z.array(
    obj({ id, name: z.string(), category: resourceCategory, quantified: z.boolean() }),
  ),
  allocations: z.array(allocationChange),
});

export const batchAllocationRequest = obj({ changes: z.array(allocationChange) });
export const batchSaved = obj({ applied: nonNegativeInt });

export const facilityAllocations = obj({
  facility: obj({ id, name: z.string() }),
  resources: z.array(
    obj({
      id,
      name: z.string(),
      category: resourceCategory,
      quantified: z.boolean(),
      value: allocationValue,
    }),
  ),
});
export const setFacilityAllocationsRequest = obj({
  values: z.array(obj({ resourceId: id, value: allocationValue })),
});

export type _Checks = [
  Assert<Same<z.infer<typeof adminResource>, AdminResource>>,
  Assert<Same<z.infer<typeof adminResourceListQuery>, AdminResourceListParams>>,
  Assert<Same<z.infer<typeof resourceProposedChange>, ResourceProposedChange>>,
  Assert<Same<z.infer<typeof resourceImpactResult>, ResourceImpactResult>>,
  Assert<Same<z.infer<typeof allocationMatrix>, AllocationMatrix>>,
  Assert<Same<z.infer<typeof facilityAllocations>, FacilityAllocations>>,
];
