import { beforeEach, describe, expect, it } from 'vitest';
import {
  createApiClient,
  isApiProblem,
  type ApiProblem,
  type AuditExportRecord,
  type AuditList,
  type Booking,
} from '@/shared/api';
import { FIXED_NOW } from '@/test/clock';
import { seedApprovals } from './data/approvalSeeds';
import { seedAudit } from './data/auditSeeds';
import { toCsv } from './adminAudit';
import { seedFacilityAdmin } from './data/facilityAdminSeeds';
import { TEST_API_BASE_URL } from './server';

const as = (token: string | null) =>
  createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => token });
const sysadmin = as('user:mock-sysadmin');
const facilityAdmin = as('user:mock-approver-1');
const applicant = as(null);

beforeEach(() => {
  seedFacilityAdmin(FIXED_NOW);
  seedApprovals(FIXED_NOW);
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

const audit = (query: Record<string, string | string[] | number> = {}) =>
  sysadmin.get<AuditList>('/admin/audit', { query });
const exportCsv = async (query: Record<string, string>) => {
  const blob = await sysadmin.download(`/admin/audit/export?${new URLSearchParams(query)}`);
  return blob.text();
};

describe('who may use it', () => {
  it('refuses a facility administrator, for the list and the export alike', async () => {
    expect((await failure(facilityAdmin.get('/admin/audit'))).status).toBe(403);
    expect(
      (
        await failure(
          facilityAdmin.get('/admin/audit/export', {
            query: { from: '2026-10-01', to: '2026-10-31' },
          }),
        )
      ).status,
    ).toBe(403);
  });

  it('refuses an applicant', async () => {
    expect((await failure(applicant.get('/admin/audit'))).status).toBe(403);
  });
});

describe('the query', () => {
  it('is large enough to page, newest first, in the standard envelope', async () => {
    const first = await audit({ pageSize: 25 });
    expect(first.totalItems).toBeGreaterThan(300);
    expect(first.totalPages).toBeGreaterThan(10);
    expect(first.items).toHaveLength(25);
    const times = first.items.map((e) => e.occurredAt);
    expect(times).toEqual([...times].sort().reverse());

    const second = await audit({ pageSize: 25, page: 2 });
    expect(second.page).toBe(2);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    expect(second.items[0]?.occurredAt <= (first.items.at(-1)?.occurredAt ?? '')).toBe(true);
  });

  it('finds what happened to one booking by its reference', async () => {
    const result = await audit({ reference: 'MVL-2026-00417' });
    expect(result.items.map((e) => e.action).reverse()).toEqual([
      'booking.created',
      'booking.submitted',
      'booking.approved',
      'booking.reschedule_requested',
      'booking.reschedule_approved',
    ]);
    expect(result.items.every((e) => e.entityLabel === 'MVL-2026-00417')).toBe(true);
  });

  it('matches a reference in part and without regard to case', async () => {
    expect((await audit({ reference: 'mvl-2026-00417' })).totalItems).toBe(5);
    expect((await audit({ reference: '00417' })).totalItems).toBe(5);
  });

  it('filters by date range, inclusive at both ends, in the facility time zone', async () => {
    const all = await audit({ pageSize: 100 });
    const day = all.items[0]?.occurredAt.slice(0, 10) ?? '';
    const one = await audit({ from: day, to: day, pageSize: 100 });
    expect(one.totalItems).toBeGreaterThan(0);
    expect(one.totalItems).toBeLessThan(all.totalItems);
    const none = await audit({ from: '2020-01-01', to: '2020-01-31' });
    expect(none.totalItems).toBe(0);
  });

  it('filters by actor, entity type, entity and action', async () => {
    const byActor = await audit({ actor: 'pieter van wyk' });
    expect(byActor.totalItems).toBeGreaterThan(0);
    expect(byActor.items.every((e) => e.actor?.name === 'Pieter van Wyk')).toBe(true);

    const users = await audit({ entityType: 'user' });
    expect(users.items.every((e) => e.entityType === 'user')).toBe(true);

    const one = await audit({ entityType: 'user', entityId: 'approver-idle' });
    expect(one.items.map((e) => e.action)).toEqual(['user.role_changed']);

    const approvals = await audit({
      action: ['booking.approved', 'booking.rejected'],
      pageSize: 100,
    });
    expect(
      approvals.items.every((e) => ['booking.approved', 'booking.rejected'].includes(e.action)),
    ).toBe(true);
  });

  it('gives every entry its before and after state', async () => {
    const [approved] = (await audit({ reference: '00417', action: 'booking.approved' })).items;
    expect(approved).toMatchObject({
      actor: { id: 'mock-approver-1' },
      before: { status: 'pending' },
      after: { status: 'approved' },
    });
    const [created] = (await audit({ reference: '00417', action: 'booking.created' })).items;
    expect(created?.before).toBeNull();
  });

  it('records what applicants and approvers do from now on', async () => {
    const draft = await applicant.post<Booking>('/bookings', {
      body: {
        facilityId: 'city-hall',
        startsAt: '2026-11-24T07:00:00Z',
        endsAt: '2026-11-24T10:00:00Z',
      },
    });
    const trail = await audit({ entityId: draft.id });
    expect(trail.items[0]).toMatchObject({
      action: 'booking.created',
      actor: { id: 'mock-user-1', name: 'Mock User' },
      entityLabel: draft.reference,
      after: { status: 'draft' },
    });
  });

  it('records an approver’s decision against their own name', async () => {
    const queue = await facilityAdmin.get<{
      items: Array<{ id: string; reference: string; status: string }>;
    }>('/approvals', { query: { status: 'pending', pageSize: 5 } });
    const target = queue.items.find((i) => i.status === 'pending');
    if (!target) throw new Error('no pending request');
    await facilityAdmin.post(`/bookings/${target.id}/reject`, {
      body: { reason: 'Not available.' },
    });
    const trail = await audit({ reference: target.reference, action: 'booking.rejected' });
    expect(trail.items[0]).toMatchObject({
      actor: { id: 'mock-approver-1' },
      before: { status: 'pending' },
      after: { status: 'rejected', reason: 'Not available.' },
    });
  });

  it('rejects an impossible query', async () => {
    expect((await failure(audit({ from: 'yesterday' }))).status).toBe(422);
    expect((await failure(audit({ from: '2026-10-31', to: '2026-10-01' }))).status).toBe(422);
    expect((await failure(audit({ entityType: 'nonsense' }))).status).toBe(400);
  });
});

describe('the export', () => {
  const range = { from: '2026-08-01', to: '2026-11-02' };

  it('will not export everything: it needs both ends of a date range', async () => {
    for (const query of [{}, { from: '2026-10-01' }, { to: '2026-10-31' }]) {
      const refused = await failure(
        sysadmin.download(`/admin/audit/export?${new URLSearchParams(query)}`),
      );
      expect(refused.status).toBe(422);
    }
  });

  it('gives the filtered rows as CSV', async () => {
    const csv = await exportCsv({ ...range, reference: '00417' });
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe(
      'When (UTC),Actor,Actor id,Action,Entity type,Entity,Entity id,Summary,Before,After',
    );
    expect(lines).toHaveLength(6);
    expect(lines.slice(1).every((l) => l.includes('MVL-2026-00417'))).toBe(true);
  });

  it('is itself an audit event: who, the filters, and how many rows', async () => {
    await exportCsv({ ...range, reference: '00417' });
    const [event] = (await audit({ action: 'audit.exported' })).items;
    expect(event).toMatchObject({
      actor: { id: 'mock-sysadmin', name: 'Sipho Nkosi' },
      entityType: 'audit',
    });
    const after = event?.after as unknown as AuditExportRecord;
    expect(after.rowCount).toBe(5);
    expect(after.filters).toEqual({ ...range, reference: '00417' });
  });

  it('leaves a trace even for an export that finds nothing', async () => {
    await exportCsv({ from: '2020-01-01', to: '2020-01-02' });
    const [event] = (await audit({ action: 'audit.exported' })).items;
    expect((event?.after as unknown as AuditExportRecord).rowCount).toBe(0);
  });

  it('does not record an export that was refused', async () => {
    await failure(sysadmin.download('/admin/audit/export'));
    expect((await audit({ action: 'audit.exported' })).totalItems).toBe(0);
  });

  it('neutralises cells a spreadsheet would run as a formula', () => {
    const csv = toCsv([
      {
        id: 'au-x',
        occurredAt: '2026-11-02T08:00:00Z',
        actor: { id: 'u', name: '=HYPERLINK("http://example.org")' },
        action: 'user.role_changed',
        entityType: 'user',
        entityId: 'u',
        entityLabel: '+1',
        summary: 'Said, "hello"',
        before: null,
        after: null,
      },
    ]);
    const row = csv.split('\r\n')[1] ?? '';
    expect(row).toContain('"\'=HYPERLINK(""http://example.org"")"');
    expect(row).toContain(",'+1,");
    expect(row).toContain('"Said, ""hello"""');
  });
});
