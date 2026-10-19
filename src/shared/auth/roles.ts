export const ROLES = {
  applicant: 'applicant',
  internal: 'internal',
  facilityAdmin: 'facility_admin',
  systemAdmin: 'system_admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export function isRole(value: unknown): value is Role {
  return Object.values<unknown>(ROLES).includes(value);
}

/** Roles that make booking requests. Others can browse facilities but not request a booking. */
export const BOOKING_ROLES: readonly Role[] = [ROLES.applicant, ROLES.internal];
