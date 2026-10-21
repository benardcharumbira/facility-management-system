import { ROLES, type Role } from '@/shared/auth/roles';

/** The approver the mock signs in as, unless a token of the form `user:<id>` says otherwise. */
export const MOCK_APPROVER_ID = 'mock-approver-1';

export interface StaffMember {
  name: string;
  email: string;
  role: Role;
}

/**
 * Municipal staff, PROVISIONAL and invented. Anyone not listed here is an applicant. The server
 * decides what a caller may do from this, never from the client.
 */
export const STAFF: Record<string, StaffMember> = {
  [MOCK_APPROVER_ID]: {
    name: 'Nomsa Dlamini',
    email: 'nomsa.dlamini@example.org',
    role: ROLES.facilityAdmin,
  },
  'approver-vaal': {
    name: 'Pieter van Wyk',
    email: 'pieter.vanwyk@example.org',
    role: ROLES.facilityAdmin,
  },
  'approver-empty': {
    name: 'Lerato Sithole',
    email: 'lerato.sithole@example.org',
    role: ROLES.facilityAdmin,
  },
  'approver-partial': {
    name: 'Kagiso Mahlangu',
    email: 'kagiso.mahlangu@example.org',
    role: ROLES.facilityAdmin,
  },
  'mock-sysadmin': {
    name: 'Sipho Nkosi',
    email: 'sipho.nkosi@example.org',
    role: ROLES.systemAdmin,
  },
};

export const roleOfUser = (userId: string): Role => STAFF[userId]?.role ?? ROLES.applicant;
export const staffName = (userId: string) => STAFF[userId]?.name ?? 'An approver';

/** Facility administrators: the people who can be designated to approve for a facility. */
export const approverCandidates = () =>
  Object.entries(STAFF)
    .filter(([, member]) => member.role === ROLES.facilityAdmin)
    .map(([id, member]) => ({ id, name: member.name, email: member.email }));

/** Who the caller is: a token of the form `user:<id>`, else the default mock approver. */
export function userIdOf(request: Request): string {
  const match = /^Bearer user:(.+)$/.exec(request.headers.get('Authorization') ?? '');
  return match?.[1] ?? MOCK_APPROVER_ID;
}
