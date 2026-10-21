import { HttpResponse } from 'msw';
import { problemTypeFor } from '@/shared/api/contracts/problem-types';
import { ROLES } from '@/shared/auth/roles';
import { roleOfUser, userIdOf } from './data/staff';

/** An RFC 7807 problem document, as the real API sends them. */
export function problem(
  status: number,
  title: string,
  detail?: string,
  extra: Record<string, unknown> = {},
) {
  return HttpResponse.json(
    { type: problemTypeFor(status), title, status, detail, ...extra },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export type Errors = Record<string, string[]>;

export const invalid = (errors: Errors) =>
  problem(422, 'Validation failed', 'One or more fields are invalid.', { errors });

export const addError = (errors: Errors, field: string, message: string) =>
  (errors[field] ??= []).push(message);

/**
 * Administration is for system administrators and facility administrators, decided on the server
 * from the session identity. Anyone else is refused, whatever the screen shows.
 */
export function requireAdmin(request: Request, what: string): Response | null {
  const role = roleOfUser(userIdOf(request));
  return role === ROLES.facilityAdmin || role === ROLES.systemAdmin
    ? null
    : problem(403, 'Not allowed', `Only administrators can manage ${what}.`);
}

/**
 * Users, reference data and the audit trail are for system administrators alone. A facility
 * administrator is refused, whatever the screen shows.
 */
export function requireSystemAdmin(request: Request, what: string): Response | null {
  return roleOfUser(userIdOf(request)) === ROLES.systemAdmin
    ? null
    : problem(403, 'Not allowed', `Only system administrators can manage ${what}.`);
}
