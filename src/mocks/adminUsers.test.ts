import { beforeEach, describe, expect, it } from 'vitest';
import { sendsInvalidRequests } from '@/test/contract';
import {
  createApiClient,
  isApiProblem,
  type AdminFacility,
  type AdminUser,
  type AdminUserList,
  type ApiProblem,
  type AuditList,
  type UserImpactResult,
} from '@/shared/api';
import { FIXED_NOW } from '@/test/clock';
import { seedAudit } from './data/auditSeeds';
import { seedFacilityAdmin, seedUnroutedRequests } from './data/facilityAdminSeeds';
import { TEST_API_BASE_URL } from './server';

const as = (token: string | null) =>
  createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => token });
const sysadmin = as('user:mock-sysadmin');
const facilityAdmin = as('user:mock-approver-1');

beforeEach(() => {
  seedFacilityAdmin(FIXED_NOW);
  seedUnroutedRequests(FIXED_NOW);
  seedAudit(FIXED_NOW);
});

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected a failure');
    },
    (error: unknown) => {
      if (!isApiProblem(error)) throw error;
      return error as ApiProblem;
    },
  );

const user = (id: string, client = sysadmin) => client.get<AdminUser>(`/admin/users/${id}`);
const setRole = (id: string, role: string, confirmGrant?: boolean, client = sysadmin) =>
  client.put<AdminUser>(`/admin/users/${id}/roles`, { body: { role, confirmGrant } });
const impact = (id: string, body: object) =>
  sysadmin.post<UserImpactResult>(`/admin/users/${id}/roles/impact`, { body });
const designate = (id: string, facilityIds: string[], client = sysadmin) =>
  client.put<AdminUser>(`/admin/users/${id}/facilities`, { body: { facilityIds } });
const approversOf = async (facilityId: string) =>
  (await sysadmin.get<AdminFacility>(`/admin/facilities/${facilityId}`)).approvers.map((a) => a.id);

describe('who may use it', () => {
  it('answers a facility administrator 403 on every user endpoint', async () => {
    for (const run of [
      () => facilityAdmin.get('/admin/users'),
      () => facilityAdmin.get('/admin/users/approver-vaal'),
      () => setRole('approver-vaal', 'applicant', undefined, facilityAdmin),
      () => designate('approver-vaal', [], facilityAdmin),
      () =>
        facilityAdmin.post('/admin/users/approver-vaal/roles/impact', {
          body: { kind: 'deactivate' },
        }),
      () => facilityAdmin.post('/admin/users/approver-vaal/deactivate'),
    ]) {
      expect((await failure(run())).status).toBe(403);
    }
  });

  it('answers an applicant 403', async () => {
    expect((await failure(as('user:applicant-001').get('/admin/users'))).status).toBe(403);
  });
});

describe('the list', () => {
  it('holds a few staff beside a much larger applicant list', async () => {
    const list = await sysadmin.get<AdminUserList>('/admin/users', { query: { pageSize: 100 } });
    // Eight named staff, and the internal users among the applicants.
    expect(list.counts.staff).toBe(14);
    expect(list.counts.applicants).toBeGreaterThan(200);
  });

  it('narrows to the staff, which is what an administrator usually came for', async () => {
    const list = await sysadmin.get<AdminUserList>('/admin/users', {
      query: { audience: 'staff', pageSize: 100 },
    });
    expect(list.totalItems).toBe(14);
    expect(list.items.every((u) => u.role !== 'applicant')).toBe(true);
  });

  it('searches name and email, and filters by role and status', async () => {
    const byName = await sysadmin.get<AdminUserList>('/admin/users', { query: { q: 'nomsa' } });
    expect(byName.items.map((u) => u.id)).toEqual(['mock-approver-1']);
    const byEmail = await sysadmin.get<AdminUserList>('/admin/users', {
      query: { q: 'sipho.nkosi@' },
    });
    expect(byEmail.items.map((u) => u.id)).toEqual(['mock-sysadmin']);
    const admins = await sysadmin.get<AdminUserList>('/admin/users', {
      query: { role: 'system_admin' },
    });
    expect(admins.items.map((u) => u.id).sort()).toEqual(['mock-sysadmin', 'sysadmin-two']);
    const off = await sysadmin.get<AdminUserList>('/admin/users', {
      query: { status: 'deactivated', pageSize: 100 },
    });
    expect(off.totalItems).toBeGreaterThan(0);
    expect(off.items.every((u) => u.status === 'deactivated')).toBe(true);
  });

  it('pages with the standard envelope', async () => {
    const first = await sysadmin.get<AdminUserList>('/admin/users', {
      query: { pageSize: 25, audience: 'applicants' },
    });
    expect(first.items).toHaveLength(25);
    expect(first.totalPages).toBeGreaterThan(5);
    const second = await sysadmin.get<AdminUserList>('/admin/users', {
      query: { pageSize: 25, page: 2, audience: 'applicants' },
    });
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
  });

  it('flags a facility administrator designated against nothing, and counts the facilities of the rest', async () => {
    const list = await sysadmin.get<AdminUserList>('/admin/users', {
      query: { audience: 'staff', pageSize: 100 },
    });
    const idle = list.items.find((u) => u.id === 'approver-idle');
    expect(idle).toMatchObject({ designatedFacilities: 0, approverWithoutFacilities: true });
    expect(list.items.find((u) => u.id === 'mock-approver-1')?.designatedFacilities).toBe(6);
    expect(list.items.find((u) => u.id === 'mock-sysadmin')?.designatedFacilities).toBeNull();
    const flagged = await sysadmin.get<AdminUserList>('/admin/users', {
      query: { approverWithoutFacilities: true },
    });
    expect(flagged.items.map((u) => u.id)).toEqual(['approver-idle']);
    expect(flagged.counts.approversWithoutFacilities).toBe(1);
  });

  it('reports when somebody last signed in, where Clerk knows', async () => {
    expect((await user('approver-idle')).lastSignInAt).toBeNull();
    expect((await user('mock-approver-1')).lastSignInAt).toBe('2026-11-02T06:12:00Z');
  });
});

describe('granting a role', () => {
  it('is refused unless the grant is confirmed', async () => {
    const refused = await failure(setRole('staff-internal-1', 'facility_admin'));
    expect(refused.status).toBe(422);
    expect(refused.errors?.confirmGrant).toBeDefined();
    expect((await user('staff-internal-1')).role).toBe('internal');
  });

  it('is made once confirmed, starts with nothing designated, and is recorded', async () => {
    const granted = await setRole('staff-internal-1', 'facility_admin', true);
    expect(granted).toMatchObject({
      role: 'facility_admin',
      designatedFacilities: 0,
      approverWithoutFacilities: true,
    });
    const trail = await sysadmin.get<AuditList>('/admin/audit', {
      query: { entityType: 'user', entityId: 'staff-internal-1' },
    });
    expect(trail.items[0]).toMatchObject({
      action: 'user.role_changed',
      actor: { id: 'mock-sysadmin' },
      before: { role: 'internal' },
      after: { role: 'facility_admin' },
    });
  });

  it('needs no confirmation to go down', async () => {
    expect((await setRole('staff-internal-1', 'applicant')).role).toBe('applicant');
  });

  it('turns a new facility administrator into someone who can approve and be designated', async () => {
    await setRole('staff-internal-1', 'facility_admin', true);
    const candidates = await sysadmin.get<Array<{ id: string }>>('/admin/approver-candidates');
    expect(candidates.map((c) => c.id)).toContain('staff-internal-1');
  });
});

describe('what removing a role strands', () => {
  it('names the facilities left with nobody, and the pending requests with nobody to decide them', async () => {
    // Pieter is the only approver of the two Vaal Marina rooms.
    const result = await impact('approver-vaal', { kind: 'role', role: 'applicant' });
    expect(result.facilitiesLeftWithoutApprover.map((f) => f.id).sort()).toEqual([
      'vaal-marina-board-room',
      'vaal-marina-hall',
    ]);
    expect(result.designationsRemoved).toHaveLength(2);
    expect(result.unroutedPendingRequests).toBe(3);
    expect(result.unroutedPendingRequests).toBe(result.affectedBookings.length);
    expect(result.totalAffected).toBe(result.unroutedPendingRequests);
    expect(result.affectedBookings.every((b) => b.reason === 'no_approver')).toBe(true);
    expect(result.affectedBookings.every((b) => b.status === 'pending')).toBe(true);
  });

  it('names Sicelo Hall when its only approver goes', async () => {
    const result = await impact('approver-empty', { kind: 'deactivate' });
    expect(result.facilitiesLeftWithoutApprover.map((f) => f.name)).toEqual(['Sicelo Hall']);
  });

  it('strands nothing when another approver remains', async () => {
    // Kagiso shares the committee room with Nomsa.
    const result = await impact('approver-partial', { kind: 'role', role: 'internal' });
    expect(result.designationsRemoved.map((f) => f.id)).toEqual(['city-hall-committee-room']);
    expect(result.facilitiesLeftWithoutApprover).toEqual([]);
    expect(result).toMatchObject({ unroutedPendingRequests: 0, totalAffected: 0 });
  });

  it('strands nothing for someone with no designations', async () => {
    const result = await impact('approver-idle', { kind: 'deactivate' });
    expect(result).toMatchObject({
      designationsRemoved: [],
      facilitiesLeftWithoutApprover: [],
      totalAffected: 0,
    });
  });

  it('strands nothing when a role changes but the facility administrator role is kept or gained', async () => {
    expect(
      (await impact('approver-vaal', { kind: 'role', role: 'facility_admin' })).designationsRemoved,
    ).toEqual([]);
    expect(
      (await impact('mock-approver-1', { kind: 'role', role: 'system_admin' })).designationsRemoved,
    ).toHaveLength(6);
  });

  it('checks a designation edit the same way', async () => {
    const result = await impact('approver-vaal', {
      kind: 'facilities',
      facilityIds: ['vaal-marina-hall'],
    });
    expect(result.facilitiesLeftWithoutApprover.map((f) => f.id)).toEqual([
      'vaal-marina-board-room',
    ]);
  });

  it('removes the designations when the role is removed, and the facilities then show no approver', async () => {
    await setRole('approver-vaal', 'applicant');
    expect(await approversOf('vaal-marina-hall')).toEqual([]);
    const list = await sysadmin.get<{ withoutApprover: number }>('/admin/facilities', {
      query: { status: ['active', 'unavailable'] },
    });
    expect(list.withoutApprover).toBeGreaterThanOrEqual(2);
  });

  it('rejects a change it cannot understand', async () => {
    sendsInvalidRequests();
    expect((await failure(impact('approver-vaal', { kind: 'nonsense' }))).status).toBe(422);
  });
});

describe('deactivation', () => {
  it('removes the designations, keeps the person, and can be undone', async () => {
    const off = await sysadmin.post<AdminUser>('/admin/users/approver-vaal/deactivate');
    expect(off).toMatchObject({ status: 'deactivated', role: 'facility_admin', facilities: [] });
    expect(await approversOf('vaal-marina-hall')).toEqual([]);

    const on = await sysadmin.post<AdminUser>('/admin/users/approver-vaal/reactivate');
    expect(on.status).toBe('active');
    // Not restored: that is a decision to make again.
    expect(on.facilities).toEqual([]);
  });

  it('leaves a deactivated administrator with no access', async () => {
    await sysadmin.post('/admin/users/sysadmin-two/deactivate');
    expect((await failure(as('user:sysadmin-two').get('/admin/users'))).status).toBe(403);
  });

  it('keeps the account in the directory rather than deleting it', async () => {
    await sysadmin.post('/admin/users/approver-vaal/deactivate');
    expect((await user('approver-vaal')).status).toBe('deactivated');
  });
});

describe('guard rails', () => {
  it('says in advance what cannot be done to yourself', async () => {
    const self = await user('mock-sysadmin');
    expect(self.protections.role).toMatch(/cannot remove your own system administrator role/);
    expect(self.protections.deactivation).toMatch(/cannot deactivate your own account/);
  });

  it('refuses to let anyone remove their own administrator role', async () => {
    const refused = await failure(setRole('mock-sysadmin', 'facility_admin'));
    expect(refused.status).toBe(409);
    expect((refused as unknown as { body?: unknown }).body ?? refused.detail).toBeDefined();
    expect((await user('mock-sysadmin')).role).toBe('system_admin');
  });

  it('allows another administrator to remove it', async () => {
    expect((await user('sysadmin-two')).protections.role).toBeNull();
    expect((await setRole('sysadmin-two', 'facility_admin')).role).toBe('facility_admin');
  });

  it('protects the last active system administrator from removal and deactivation', async () => {
    await sysadmin.post('/admin/users/sysadmin-two/deactivate');
    const last = await user('mock-sysadmin');
    expect(last.protections.role).toMatch(/only active system administrator/);
    expect(last.protections.deactivation).toMatch(/only active system administrator/);
    expect((await failure(setRole('mock-sysadmin', 'internal'))).status).toBe(409);
    expect((await failure(sysadmin.post('/admin/users/mock-sysadmin/deactivate'))).status).toBe(
      409,
    );
    expect((await user('mock-sysadmin')).status).toBe('active');
  });

  it('does not count a deactivated administrator as one', async () => {
    await sysadmin.post('/admin/users/sysadmin-two/deactivate');
    // Zodwa is not active, so reactivating is how a second one comes back.
    await sysadmin.post('/admin/users/sysadmin-two/reactivate');
    expect((await user('mock-sysadmin')).protections.role).toMatch(/cannot remove your own/);
  });
});

describe('designation, from either side', () => {
  it('shows a designation made on the user in the facility, and records it', async () => {
    const result = await designate('approver-idle', ['lakeside-hall', 'rothdene-hall']);
    expect(result.facilities.map((f) => f.id)).toEqual(['lakeside-hall', 'rothdene-hall']);
    expect(await approversOf('rothdene-hall')).toContain('approver-idle');
    expect((await user('approver-idle')).approverWithoutFacilities).toBe(false);
  });

  it('shows a designation made on the facility on the user', async () => {
    await sysadmin.put('/admin/facilities/sicelo-hall/approvers', {
      body: { userIds: ['approver-empty', 'approver-idle'] },
    });
    expect((await user('approver-idle')).facilities.map((f) => f.id)).toEqual(['sicelo-hall']);
    const trail = await sysadmin.get<AuditList>('/admin/audit', {
      query: { entityId: 'approver-idle', action: 'user.facilities_changed' },
    });
    expect(trail.items[0]?.after).toEqual({ facilities: ['Sicelo Hall'] });
  });

  it('shows a removal made on the facility on the user', async () => {
    await sysadmin.put('/admin/facilities/city-hall-committee-room/approvers', {
      body: { userIds: ['mock-approver-1'] },
    });
    expect((await user('approver-partial')).facilities).toEqual([]);
  });

  it('designates only active facility administrators, only against facilities that exist', async () => {
    expect((await failure(designate('mock-sysadmin', ['rothdene-hall']))).status).toBe(422);
    expect((await failure(designate('approver-idle', ['nowhere']))).status).toBe(422);
  });
});

describe('the clerk profile', () => {
  it('is returned for display and has no endpoint that writes it', async () => {
    sendsInvalidRequests();
    const detail = await user('mock-approver-1');
    expect(detail.profile).toMatchObject({
      firstName: 'Nomsa',
      lastName: 'Dlamini',
      email: 'nomsa.dlamini@example.org',
    });
    for (const method of ['patch', 'put'] as const) {
      // MSW has no handler for it, so the request never reaches an endpoint that could write.
      const attempt = await failure(
        sysadmin[method]('/admin/users/mock-approver-1', { body: { email: 'x@example.org' } }),
      );
      expect(attempt.kind).toBe('network');
    }
  });
});
