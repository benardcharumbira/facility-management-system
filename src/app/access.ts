import { ROLES, type Role } from '@/shared/auth';

export const PATHS = {
  signIn: '/sign-in',
  signUp: '/sign-up',
  home: '/',
  facilities: '/facilities',
  bookings: '/bookings',
  newBooking: '/bookings/new',
  bookingDetail: '/bookings/:id',
  approvals: '/approvals',
  adminFacilities: '/admin/facilities',
  adminResources: '/admin/resources',
  adminUsers: '/admin/users',
} as const;

/** Who may use each segment of the route tree. Used by both the router and the navigation. */
export const ACCESS = {
  bookers: [ROLES.applicant, ROLES.internal],
  facilityAdmins: [ROLES.facilityAdmin],
  systemAdmins: [ROLES.systemAdmin],
} as const satisfies Record<string, readonly Role[]>;

const ROLE_HOME: Record<Role, string> = {
  [ROLES.applicant]: PATHS.bookings,
  [ROLES.internal]: PATHS.bookings,
  [ROLES.facilityAdmin]: PATHS.approvals,
  [ROLES.systemAdmin]: PATHS.adminUsers,
};

export function homePathForRole(role: Role): string {
  return ROLE_HOME[role];
}
