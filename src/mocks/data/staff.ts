import { ROLES, type Role } from '@/shared/auth/roles';
import { MOCK_APPROVER_ID, MOCK_SYSADMIN_ID, userStore } from './userStore';

export { MOCK_APPROVER_ID };

/**
 * Who is calling, and what they may do, read from the directory administrators maintain. A user
 * the service has deactivated is nobody: they have no role.
 */
export const roleOfUser = (userId: string): Role => {
  const user = userStore.get(userId);
  return user && user.status === 'active' ? user.role : ROLES.applicant;
};
export const staffName = (userId: string) => userStore.get(userId)?.name ?? 'An approver';

/** Facility administrators: the people who can be designated to approve for a facility. */
export const approverCandidates = () =>
  userStore.facilityAdmins().map(({ id, name, email }) => ({ id, name, email }));

let defaultCaller = MOCK_APPROVER_ID;
/** Who calls when the token names nobody: the mock's role, so a dev session can reach its own screens. */
export function setDefaultCaller(role: Role | undefined) {
  defaultCaller = role === ROLES.systemAdmin ? MOCK_SYSADMIN_ID : MOCK_APPROVER_ID;
}

/** Who the caller is: a token of the form `user:<id>`, else the default mock caller. */
export function userIdOf(request: Request): string {
  const match = /^Bearer user:(.+)$/.exec(request.headers.get('Authorization') ?? '');
  return match?.[1] ?? defaultCaller;
}
