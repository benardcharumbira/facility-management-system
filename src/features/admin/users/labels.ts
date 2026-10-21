import { ROLES, type Role } from '@/shared/auth';
import type { UserStatus } from '@/shared/api';

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  deactivated: 'Deactivated',
};

/** What each role lets a person do, in words. This is what a grant is confirmed against. */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  [ROLES.applicant]: [
    'Browse facilities and check when they are free.',
    'Ask to book a facility, and see and change their own requests.',
  ],
  [ROLES.internal]: [
    'Everything an applicant can do.',
    'Is recorded as municipal staff. It does not let them approve requests or change anything in administration.',
  ],
  [ROLES.facilityAdmin]: [
    'Approve or reject booking requests for the facilities they are designated against, and read the requests, the applicants’ details and their documents.',
    'Create, change, close and archive any facility and any resource, not only their own facilities.',
    'It does not let them manage users, reference data or read the audit trail.',
  ],
  [ROLES.systemAdmin]: [
    'Everything a facility administrator can do, for every facility and every request, whether or not they are designated.',
    'Give and take away roles, including this one, and deactivate people.',
    'Change the seating arrangements, event types and terms and conditions that bookings depend on.',
    'Read and export the audit trail, which contains personal information.',
  ],
};

/** The one line shown beside each role when choosing. */
export const ROLE_SUMMARY: Record<Role, string> = {
  [ROLES.applicant]: 'Makes booking requests for their own events.',
  [ROLES.internal]: 'Municipal staff who book venues. Cannot approve or administer.',
  [ROLES.facilityAdmin]: 'Approves requests for their facilities and maintains the estate.',
  [ROLES.systemAdmin]: 'Full access, including users, reference data and the audit trail.',
};

/** Clerk owns identity. These are where it is looked after, not rebuilt here. */
export const CLERK_DASHBOARD_URL = 'https://dashboard.clerk.com/';

/** "an applicant", "a facility administrator". */
export const withArticle = (label: string) =>
  `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label.toLowerCase()}`;
