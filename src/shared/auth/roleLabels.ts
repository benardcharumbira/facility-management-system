import { ROLES, type Role } from './roles';

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.applicant]: 'Applicant',
  [ROLES.internal]: 'Internal user',
  [ROLES.facilityAdmin]: 'Facility administrator',
  [ROLES.systemAdmin]: 'System administrator',
};
