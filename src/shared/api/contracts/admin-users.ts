/**
 * Contract for user administration. This file is the specification handed to the backend: the MSW
 * handlers implement it and the client is written against it.
 *
 * ```
 * GET    /api/admin/users                    all users, applicants and staff (filters, sort, envelope)
 * GET    /api/admin/users/{id}
 * PUT    /api/admin/users/{id}/roles         one role per user; a grant needs `confirmGrant`
 * POST   /api/admin/users/{id}/roles/impact  preview a role change, a deactivation or a designation edit
 * PUT    /api/admin/users/{id}/facilities    the facilities an approver is designated against
 * POST   /api/admin/users/{id}/deactivate
 * POST   /api/admin/users/{id}/reactivate
 * ```
 *
 * **Who owns what.** Clerk owns credentials, verification, sessions and the canonical profile (name,
 * email, contact details). This service owns the role, the designation of an approver against
 * facilities, and the status of the account within the service. `profile` is therefore returned
 * for display and is never written here: there is no endpoint that changes it.
 *
 * **One role per user** (the slice 1 model): applicant, internal user, facility administrator or
 * system administrator. A role change replaces the role.
 *
 * **System administrators only**, enforced on the server from the session identity. Everyone else,
 * facility administrators included, is answered 403.
 *
 * **Granting is explicit.** A change that raises privilege (see {@link ROLE_RANK}) is refused with
 * 422 unless the request carries `confirmGrant: true`, which the client sends only after showing
 * what the role permits.
 *
 * **Revoking strands work.** Removing the facility administrator role, deactivating a user, or
 * editing their designations can leave a facility with nobody designated, and pending requests
 * with nobody to decide them. `roles/impact` names both, and decides nothing. Where it reports
 * nothing the client makes the change without a dialog.
 *
 * **Designation.** Only a facility administrator can be designated. The same relationship is edited
 * from the facility side (`PUT /api/admin/facilities/{id}/approvers`); both write one record.
 * Leaving the facility administrator role, or being deactivated, removes the designations, and
 * reactivating does not restore them.
 *
 * **Guard rails.** At least one active system administrator always exists, and nobody can remove
 * their own system administrator role or deactivate themselves. Both are refused with 409 and a
 * `code`; the detail response says in advance which actions are blocked (`protections`) so the
 * interface can prevent rather than fail on save.
 *
 * **Deactivation, not deletion.** A deactivated user cannot sign in to the service, and remains in
 * bookings, approvals and the audit trail.
 */
import type { Paginated } from '@/shared/types/pagination';
import type { Role } from '@/shared/auth/roles';
import type { AdminFacilityStatus, ImpactResult } from './admin-facilities';

export type UserStatus = 'active' | 'deactivated';
export const USER_STATUSES: readonly UserStatus[] = ['active', 'deactivated'];

/** Higher outranks lower. A change to a higher rank is a grant. */
export const ROLE_RANK: Record<Role, number> = {
  applicant: 0,
  internal: 1,
  facility_admin: 2,
  system_admin: 3,
};

export const isGrant = (from: Role, to: Role) => ROLE_RANK[to] > ROLE_RANK[from];

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  /** From Clerk. Null if they have never signed in. */
  lastSignInAt: string | null;
  /** For a facility administrator, the facilities they are designated against; otherwise null. */
  designatedFacilities: number | null;
  /** A facility administrator designated against nothing: harmless, but pointless. */
  approverWithoutFacilities: boolean;
}

export const USER_SORTS = ['name', 'role', 'status', '-lastSignIn'] as const;
export type UserSort = (typeof USER_SORTS)[number];

/** Whom the list shows: those who hold an internal role, everyone else, or all. */
export type UserAudience = 'staff' | 'applicants' | 'all';
export const USER_AUDIENCES: readonly UserAudience[] = ['staff', 'applicants', 'all'];

/**
 * `GET /api/admin/users`. All optional. `q` matches name and email (every word). `audience`
 * defaults to `all`; "staff" means any role other than applicant. Groups combine with AND, values
 * within a group with OR. Default sort is `name`.
 */
export interface AdminUserListParams {
  q?: string;
  role?: Role[];
  status?: UserStatus[];
  audience?: UserAudience;
  /** Only facility administrators designated against nothing. */
  approverWithoutFacilities?: boolean;
  sort?: UserSort;
  page?: number;
  pageSize?: number;
}

export interface AdminUserList extends Paginated<AdminUserRow> {
  /** Unfiltered, so the audience switch can show how many are behind it. */
  counts: { staff: number; applicants: number; approversWithoutFacilities: number };
}

/** The Clerk profile, read only. */
export interface ClerkProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface DesignatedFacility {
  id: string;
  name: string;
  status: AdminFacilityStatus;
}

/** What the interface must not offer, and why, in words. Null when allowed. */
export interface UserProtections {
  role: string | null;
  deactivation: string | null;
}

export interface AdminUser extends AdminUserRow {
  profile: ClerkProfile;
  /** Where they are designated. Empty unless they are a facility administrator. */
  facilities: DesignatedFacility[];
  /** Every facility that is not archived, for the designation picker. */
  assignableFacilities: DesignatedFacility[];
  protections: UserProtections;
  /** Approved and pending bookings they own that have not ended. */
  futureBookings: number;
}

export interface ChangeRoleRequest {
  role: Role;
  /** Required when the change raises privilege. */
  confirmGrant?: boolean;
}

export interface SetDesignationsRequest {
  facilityIds: string[];
}

/** What is about to be done to a user. */
export type ProposedUserChange =
  | { kind: 'role'; role: Role }
  | { kind: 'deactivate' }
  | { kind: 'facilities'; facilityIds: string[] };

/**
 * The slice 9 impact result, extended to name the facilities left with nobody designated. The
 * `affectedBookings` are the pending requests that would be left with nobody to decide them
 * (reason `no_approver`).
 */
export interface UserImpactResult extends ImpactResult {
  facilitiesLeftWithoutApprover: Array<{ id: string; name: string }>;
  unroutedPendingRequests: number;
  /** The designations that would be removed, whether or not a facility is left without anyone. */
  designationsRemoved: Array<{ id: string; name: string }>;
}

export type UserGuardCode = 'last_system_administrator' | 'own_system_administrator_role' | 'self';
