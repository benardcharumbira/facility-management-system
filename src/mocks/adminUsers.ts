/**
 * The server side behaviour the real user administration API must reproduce. In particular:
 *
 * - System administrators only, decided on the server from the session identity.
 * - Clerk owns the profile; nothing here writes it. The service owns the role, the designation of
 *   an approver against facilities, and the status of the account.
 * - A grant (a change to a higher role) is refused unless the request confirms it.
 * - At least one active system administrator always exists, and nobody removes their own system
 *   administrator role or deactivates themselves. The detail response says so in advance.
 * - Leaving the facility administrator role, or being deactivated, removes the designations. The
 *   impact check names the facilities this leaves with nobody and the pending requests with nobody
 *   to decide them, and decides nothing.
 * - Every change is recorded in the audit trail with the actor and the state before and after.
 */
import { DateTime } from 'luxon';
import { delay, http, HttpResponse } from 'msw';
import {
  isGrant,
  USER_AUDIENCES,
  USER_SORTS,
  USER_STATUSES,
  ROLE_RANK,
  type AdminUser,
  type AdminUserList,
  type AdminUserListParams,
  type AdminUserRow,
  type ProposedUserChange,
  type UserAudience,
  type UserGuardCode,
  type UserProtections,
  type UserSort,
  type UserStatus,
} from '@/shared/api';
import { isRole, ROLES, type Role } from '@/shared/auth/roles';
import { invalid, problem, requireSystemAdmin } from './adminGuard';
import { auditStore } from './data/auditStore';
import { designationsOf, setDesignations } from './data/designations';
import { facilityStore } from './data/facilityStore';
import { userImpact } from './data/userImpact';
import { userStore, type StoredUser } from './data/userStore';
import { userIdOf } from './data/staff';

class BadQuery extends Error {}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const designatedCount = (u: StoredUser) =>
  u.role === ROLES.facilityAdmin ? designationsOf(u.id).length : null;

const toRow = (u: StoredUser): AdminUserRow => {
  const designated = designatedCount(u);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    lastSignInAt: u.lastSignInAt,
    designatedFacilities: designated,
    approverWithoutFacilities: designated === 0 && u.status === 'active',
  };
};

export function parseUserListParams(search: URLSearchParams): AdminUserListParams {
  const integer = (name: string) => {
    const raw = search.get(name);
    if (raw === null) return undefined;
    if (!/^\d+$/.test(raw)) throw new BadQuery(`"${name}" must be a non-negative integer.`);
    return Number(raw);
  };
  const roles = search.getAll('role');
  if (roles.some((r) => !isRole(r))) throw new BadQuery('"role" is not a known role.');
  const statuses = search.getAll('status');
  if (statuses.some((s) => !USER_STATUSES.includes(s as UserStatus))) {
    throw new BadQuery(`"status" must be one of: ${USER_STATUSES.join(', ')}.`);
  }
  const audience = search.get('audience');
  if (audience !== null && !USER_AUDIENCES.includes(audience as UserAudience)) {
    throw new BadQuery(`"audience" must be one of: ${USER_AUDIENCES.join(', ')}.`);
  }
  const sort = search.get('sort');
  if (sort !== null && !USER_SORTS.includes(sort as UserSort)) {
    throw new BadQuery(`"sort" must be one of: ${USER_SORTS.join(', ')}.`);
  }
  return {
    q: search.get('q') ?? undefined,
    role: roles as Role[],
    status: statuses as UserStatus[],
    audience: (audience as UserAudience | null) ?? undefined,
    approverWithoutFacilities: search.get('approverWithoutFacilities') === 'true' || undefined,
    sort: (sort as UserSort | null) ?? undefined,
    page: integer('page'),
    pageSize: integer('pageSize'),
  };
}

export function listUsers(params: AdminUserListParams): AdminUserList {
  const words = (params.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const all = userStore.all().map((u) => ({ user: u, row: toRow(u) }));
  const sort = params.sort ?? 'name';
  const byName = (a: AdminUserRow, b: AdminUserRow) => a.name.localeCompare(b.name);
  const rows = all
    .filter(({ row }) => {
      const haystack = `${row.name} ${row.email}`.toLowerCase();
      if (!words.every((w) => haystack.includes(w))) return false;
      if (params.role?.length && !params.role.includes(row.role)) return false;
      if (params.status?.length && !params.status.includes(row.status)) return false;
      if (params.audience === 'staff' && row.role === ROLES.applicant) return false;
      if (params.audience === 'applicants' && row.role !== ROLES.applicant) return false;
      if (params.approverWithoutFacilities && !row.approverWithoutFacilities) return false;
      return true;
    })
    .map(({ row }) => row)
    .sort((a, b) => {
      switch (sort) {
        case 'role':
          return ROLE_RANK[b.role] - ROLE_RANK[a.role] || byName(a, b);
        case 'status':
          return a.status.localeCompare(b.status) || byName(a, b);
        case '-lastSignIn':
          return (b.lastSignInAt ?? '').localeCompare(a.lastSignInAt ?? '') || byName(a, b);
        default:
          return byName(a, b) || a.id.localeCompare(b.id);
      }
    });

  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, params.page ?? 1), totalPages);
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalItems: rows.length,
    totalPages,
    counts: {
      staff: all.filter(({ row }) => row.role !== ROLES.applicant).length,
      applicants: all.filter(({ row }) => row.role === ROLES.applicant).length,
      approversWithoutFacilities: all.filter(({ row }) => row.approverWithoutFacilities).length,
    },
  };
}

/** What the caller may not do to this user, with the reason in words and the code the server answers with. */
export function protectionsFor(
  user: StoredUser,
  callerId: string,
): UserProtections & { roleCode: UserGuardCode | null; deactivationCode: UserGuardCode | null } {
  const isSelf = user.id === callerId;
  const isLast =
    user.role === ROLES.systemAdmin &&
    user.status === 'active' &&
    userStore.activeSystemAdmins().length === 1;
  const last =
    'You are the only active system administrator. Make someone else one first, so the service is never left without.';

  let role: string | null = null;
  let roleCode: UserGuardCode | null = null;
  if (user.role === ROLES.systemAdmin) {
    if (isLast) {
      role = isSelf
        ? last
        : 'This is the only active system administrator. Make someone else one first.';
      roleCode = 'last_system_administrator';
    } else if (isSelf) {
      role =
        'You cannot remove your own system administrator role, because it is how people lock themselves out. Ask another system administrator to do it.';
      roleCode = 'own_system_administrator_role';
    }
  }

  let deactivation: string | null = null;
  let deactivationCode: UserGuardCode | null = null;
  if (user.status === 'active') {
    if (isLast) {
      deactivation = isSelf
        ? last
        : 'This is the only active system administrator. Make someone else one first.';
      deactivationCode = 'last_system_administrator';
    } else if (isSelf) {
      deactivation =
        'You cannot deactivate your own account. Ask another system administrator to do it.';
      deactivationCode = 'self';
    }
  }
  return { role, deactivation, roleCode, deactivationCode };
}

function toDetail(user: StoredUser, callerId: string, now: DateTime): AdminUser {
  const { role, deactivation } = protectionsFor(user, callerId);
  const [first = '', ...rest] = user.name.split(' ');
  const status = (f: { archived: boolean; status: 'active' | 'unavailable' }) =>
    f.archived ? ('archived' as const) : f.status;
  return {
    ...toRow(user),
    profile: {
      firstName: first,
      lastName: rest.join(' '),
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
    },
    facilities: designationsOf(user.id).map((f) => ({ id: f.id, name: f.name, status: status(f) })),
    assignableFacilities: facilityStore
      .all()
      .filter((f) => !f.archived)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => ({ id: f.id, name: f.name, status: status(f) })),
    protections: { role, deactivation },
    futureBookings: facilityStore.liveBookings(now).filter((l) => l.ownerId === user.id).length,
  };
}

export interface AdminUserHandlerOptions {
  delayMs: number;
  now?: () => DateTime;
  fail?: () => boolean;
  ready?: () => void;
}

export function createAdminUserHandlers(
  root: string,
  { delayMs, now = () => DateTime.now(), fail, ready }: AdminUserHandlerOptions,
) {
  const wait = () => (delayMs > 0 ? delay(delayMs) : Promise.resolve());

  const sysadmin =
    (
      handle: (context: {
        request: Request;
        params: Record<string, unknown>;
      }) => Response | Promise<Response>,
    ) =>
    async ({ request, params }: { request: Request; params: Record<string, unknown> }) => {
      await wait();
      ready?.();
      const refused = requireSystemAdmin(request, 'users');
      if (refused) return refused;
      if (fail?.()) return problem(500, 'Mock failure', 'The users service is unavailable.');
      return handle({ request, params });
    };

  const withUser = (handle: (user: StoredUser, request: Request) => Response | Promise<Response>) =>
    sysadmin(({ request, params }) => {
      const user = userStore.get(String(params.id));
      return user ? handle(user, request) : problem(404, 'User not found');
    });

  const stamp = () => now().toUTC().toISO({ suppressMilliseconds: true }) ?? '';
  const detail = (user: StoredUser, request: Request) =>
    HttpResponse.json(toDetail(userStore.get(user.id) ?? user, userIdOf(request), now()));

  const proposedChange = (value: unknown): ProposedUserChange | null => {
    const body = value as Partial<ProposedUserChange> | null;
    if (!body || typeof body !== 'object') return null;
    if (body.kind === 'deactivate') return { kind: 'deactivate' };
    if (body.kind === 'role' && isRole(body.role)) return { kind: 'role', role: body.role };
    if (
      body.kind === 'facilities' &&
      Array.isArray(body.facilityIds) &&
      body.facilityIds.every((id) => typeof id === 'string')
    ) {
      return { kind: 'facilities', facilityIds: body.facilityIds };
    }
    return null;
  };

  return [
    http.get(
      `${root}/admin/users`,
      sysadmin(({ request }) => {
        try {
          return HttpResponse.json(
            listUsers(parseUserListParams(new URL(request.url).searchParams)),
          );
        } catch (error) {
          if (error instanceof BadQuery) return problem(400, 'Invalid query', error.message);
          throw error;
        }
      }),
    ),

    http.get(
      `${root}/admin/users/:id`,
      withUser((user, request) => detail(user, request)),
    ),

    http.post(
      `${root}/admin/users/:id/roles/impact`,
      withUser(async (user, request) => {
        const change = proposedChange(await request.json().catch(() => null));
        if (!change) return invalid({ kind: ['Say what is about to change.'] });
        if (change.kind === 'facilities') {
          const known = new Set(
            facilityStore
              .all()
              .filter((f) => !f.archived)
              .map((f) => f.id),
          );
          if (change.facilityIds.some((id) => !known.has(id))) {
            return invalid({ facilityIds: ['Choose from the facilities that exist.'] });
          }
        }
        return HttpResponse.json(userImpact(user, change, now()));
      }),
    ),

    http.put(
      `${root}/admin/users/:id/roles`,
      withUser(async (user, request) => {
        const body = (await request.json().catch(() => ({}))) as {
          role?: unknown;
          confirmGrant?: unknown;
        };
        if (!isRole(body.role)) return invalid({ role: ['Choose a role.'] });
        const role = body.role;
        if (role === user.role) return detail(user, request);

        const caller = userIdOf(request);
        const { role: blocked, roleCode } = protectionsFor(user, caller);
        if (blocked) {
          return problem(409, 'That is not allowed', blocked, { code: roleCode });
        }
        if (isGrant(user.role, role) && body.confirmGrant !== true) {
          return invalid({
            confirmGrant: ['Confirm what this role permits before granting it.'],
          });
        }

        const designated = designationsOf(user.id).map((f) => f.id);
        if (user.role === ROLES.facilityAdmin && role !== ROLES.facilityAdmin) {
          setDesignations(user.id, [], caller, now(), 'Left the facility administrator role');
        }
        userStore.set({ ...user, role });
        auditStore.record({
          occurredAt: stamp(),
          actor: caller,
          action: 'user.role_changed',
          entityType: 'user',
          entityId: user.id,
          entityLabel: user.name,
          summary: `${user.name}'s role changed from ${user.role} to ${role}.`,
          before: { role: user.role },
          after: {
            role,
            ...(user.role === ROLES.facilityAdmin && role !== ROLES.facilityAdmin
              ? { designationsRemoved: designated.length }
              : {}),
          },
        });
        return detail(user, request);
      }),
    ),

    http.put(
      `${root}/admin/users/:id/facilities`,
      withUser(async (user, request) => {
        const body = (await request.json().catch(() => ({}))) as { facilityIds?: unknown };
        const ids = Array.isArray(body.facilityIds)
          ? [...new Set(body.facilityIds.map(String))]
          : null;
        if (user.role !== ROLES.facilityAdmin || user.status !== 'active') {
          return invalid({
            facilityIds: [
              'Only an active facility administrator can be designated for facilities.',
            ],
          });
        }
        const known = new Set(
          facilityStore
            .all()
            .filter((f) => !f.archived)
            .map((f) => f.id),
        );
        if (!ids || ids.some((id) => !known.has(id))) {
          return invalid({ facilityIds: ['Choose from the facilities that exist.'] });
        }
        setDesignations(user.id, ids, userIdOf(request), now());
        return detail(user, request);
      }),
    ),

    http.post(
      `${root}/admin/users/:id/deactivate`,
      withUser((user, request) => {
        if (user.status === 'deactivated') return detail(user, request);
        const caller = userIdOf(request);
        const { deactivation, deactivationCode } = protectionsFor(user, caller);
        if (deactivation) {
          return problem(409, 'That is not allowed', deactivation, { code: deactivationCode });
        }
        const designated = designationsOf(user.id).map((f) => f.id);
        setDesignations(user.id, [], caller, now(), 'Account deactivated');
        userStore.set({ ...user, status: 'deactivated' });
        auditStore.record({
          occurredAt: stamp(),
          actor: caller,
          action: 'user.deactivated',
          entityType: 'user',
          entityId: user.id,
          entityLabel: user.name,
          summary: `${user.name}'s account was deactivated.`,
          before: { status: 'active' },
          after: { status: 'deactivated', designationsRemoved: designated.length },
        });
        return detail(user, request);
      }),
    ),

    http.post(
      `${root}/admin/users/:id/reactivate`,
      withUser((user, request) => {
        if (user.status === 'active') return detail(user, request);
        userStore.set({ ...user, status: 'active' });
        auditStore.record({
          occurredAt: stamp(),
          actor: userIdOf(request),
          action: 'user.reactivated',
          entityType: 'user',
          entityId: user.id,
          entityLabel: user.name,
          summary: `${user.name}'s account was reactivated.`,
          before: { status: 'deactivated' },
          after: { status: 'active' },
        });
        return detail(user, request);
      }),
    ),
  ];
}
