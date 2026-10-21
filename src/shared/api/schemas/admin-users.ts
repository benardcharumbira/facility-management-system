import { z } from 'zod';
import {
  USER_AUDIENCES,
  USER_SORTS,
  type AdminUser,
  type AdminUserList,
  type AdminUserListParams,
  type ProposedUserChange,
  type UserImpactResult,
} from '../contracts/admin-users';
import { adminFacilityStatus, impactResult } from './admin-facilities';
import { role } from './public';
import { id, idName, instant, nonNegativeInt, obj, paginated, pageParams } from './common';
import type { Assert, Same } from './same';

export const userStatus = z.enum(['active', 'deactivated']);

export const adminUserRow = obj({
  id,
  name: z.string(),
  email: z.string(),
  role,
  status: userStatus,
  lastSignInAt: instant.nullable(),
  designatedFacilities: nonNegativeInt.nullable(),
  approverWithoutFacilities: z.boolean(),
});

export const adminUserList = paginated(adminUserRow).extend({
  counts: obj({
    staff: nonNegativeInt,
    applicants: nonNegativeInt,
    approversWithoutFacilities: nonNegativeInt,
  }),
});

export const adminUserListQuery = z.strictObject({
  q: z.string().optional(),
  role: z.array(role).optional(),
  status: z.array(userStatus).optional(),
  audience: z.enum(USER_AUDIENCES).optional().meta({ default: 'all' }),
  approverWithoutFacilities: z.boolean().optional(),
  sort: z.enum(USER_SORTS).optional().meta({ default: 'name' }),
  ...pageParams,
});

const designatedFacility = obj({ id, name: z.string(), status: adminFacilityStatus });

export const adminUser = adminUserRow.extend({
  profile: obj({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    createdAt: instant,
    lastSignInAt: instant.nullable(),
  }),
  facilities: z.array(designatedFacility),
  assignableFacilities: z.array(designatedFacility),
  protections: obj({ role: z.string().nullable(), deactivation: z.string().nullable() }),
  futureBookings: nonNegativeInt,
});

export const changeRoleRequest = obj({
  role,
  confirmGrant: z
    .boolean()
    .optional()
    .meta({ description: 'Required when the change raises privilege.' }),
});
export const setDesignationsRequest = obj({ facilityIds: z.array(z.string()) });

export const proposedUserChange = z.discriminatedUnion('kind', [
  obj({ kind: z.literal('role'), role }),
  obj({ kind: z.literal('deactivate') }),
  obj({ kind: z.literal('facilities'), facilityIds: z.array(z.string()) }),
]);

export const userImpactResult = impactResult.extend({
  facilitiesLeftWithoutApprover: z.array(idName),
  unroutedPendingRequests: nonNegativeInt,
  designationsRemoved: z.array(idName),
});

export type _Checks = [
  Assert<Same<z.infer<typeof adminUser>, AdminUser>>,
  Assert<Same<z.infer<typeof adminUserList>, AdminUserList>>,
  Assert<Same<z.infer<typeof adminUserListQuery>, AdminUserListParams>>,
  Assert<Same<z.infer<typeof proposedUserChange>, ProposedUserChange>>,
  Assert<Same<z.infer<typeof userImpactResult>, UserImpactResult>>,
];
