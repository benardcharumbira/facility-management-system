import { BOOKING_ROLES, ROLES, type Role } from '@/shared/auth';

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
  account: '/account',
  terms: '/terms',
  privacy: '/privacy',
  accessibility: '/accessibility',
  help: '/help',
  contact: '/contact',
  adminReference: '/admin/reference',
  adminAudit: '/admin/audit',
} as const;

/** Who may use each segment of the route tree. Used by both the router and the navigation. */
export const ACCESS = {
  bookers: BOOKING_ROLES,
  facilityAdmins: [ROLES.facilityAdmin],
  /** A facility administrator sees the requests for their facilities; a system administrator sees all. */
  approvers: [ROLES.facilityAdmin, ROLES.systemAdmin],
  /** Who maintains the estate of facilities: both kinds of administrator. */
  estateAdmins: [ROLES.facilityAdmin, ROLES.systemAdmin],
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

/**
 * Whether people who have not signed in may browse the facilities. It is an open decision, and
 * today they may not, so the landing page's one action is to sign in. If browsing is opened up,
 * set this to true and the action becomes "Browse venues". (The facility routes must also move out
 * from behind sign in; that is a separate change to the router.)
 */
export const ANONYMOUS_BROWSING = false;

export const LANDING_ACTION = ANONYMOUS_BROWSING
  ? { label: 'Browse venues', to: PATHS.facilities }
  : { label: 'Sign in to book a venue', to: PATHS.signIn };
