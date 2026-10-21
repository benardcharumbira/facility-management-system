import { beforeEach, describe, expect, it } from 'vitest';
import {
  createApiClient,
  isApiProblem,
  type AdminFacility,
  type ApiProblem,
  type AuditList,
  type Booking,
  type BookingOptions,
  type PublishedTerms,
  type ReferenceEntry,
  type ReferenceImpactResult,
  type TermsVersion,
} from '@/shared/api';
import { FIXED_NOW } from '@/test/clock';
import { seedAudit } from './data/auditSeeds';
import { seedApprovals } from './data/approvalSeeds';
import { seedFacilityAdmin } from './data/facilityAdminSeeds';
import { TEST_API_BASE_URL } from './server';

const as = (token: string | null) =>
  createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => token });
const sysadmin = as('user:mock-sysadmin');
const facilityAdmin = as('user:mock-approver-1');
const applicant = as(null);
const approver = as('user:mock-approver-1');

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

const seating = () => sysadmin.get<ReferenceEntry[]>('/admin/seating-arrangements');
const eventTypes = () => sysadmin.get<ReferenceEntry[]>('/admin/event-types');
const options = () => applicant.get<BookingOptions>('/booking-options');
const capacityOf = async (facilityId: string) =>
  (await sysadmin.get<AdminFacility>(`/admin/facilities/${facilityId}`)).capacity;

describe('who may use it', () => {
  it('refuses a facility administrator on every reference data endpoint', async () => {
    for (const run of [
      () => facilityAdmin.get('/admin/seating-arrangements'),
      () => facilityAdmin.post('/admin/seating-arrangements', { body: { name: 'Pods' } }),
      () => facilityAdmin.patch('/admin/event-types/meeting', { body: { name: 'Gathering' } }),
      () => facilityAdmin.post('/admin/event-types/meeting/archive'),
      () => facilityAdmin.get('/admin/terms'),
      () => facilityAdmin.post('/admin/terms/terms-2026-2/publish'),
    ]) {
      expect((await failure(run())).status).toBe(403);
    }
  });
});

describe('seating arrangements', () => {
  it('seeds a sensible set, in display order', async () => {
    expect((await seating()).map((s) => s.name)).toEqual([
      'Cinema',
      'Banquet',
      'School room',
      'U-shape',
      'Boardroom',
      'Open floor',
    ]);
  });

  it('adds one, at the end unless an order is given, and offers it on the booking form', async () => {
    const created = await sysadmin.post<ReferenceEntry>('/admin/seating-arrangements', {
      body: { name: 'Cabaret' },
    });
    expect(created).toMatchObject({ name: 'Cabaret', displayOrder: 70, status: 'active' });
    expect((await options()).seatingArrangements.map((s) => s.name).at(-1)).toBe('Cabaret');

    await sysadmin.patch(`/admin/seating-arrangements/${created.id}`, {
      body: { displayOrder: 5 },
    });
    expect((await options()).seatingArrangements[0]?.name).toBe('Cabaret');
  });

  it('refuses a missing, long or duplicate name', async () => {
    const empty = await failure(
      sysadmin.post('/admin/seating-arrangements', { body: { name: ' ' } }),
    );
    expect(empty.errors.name).toBeDefined();
    const duplicate = await failure(
      sysadmin.post('/admin/seating-arrangements', { body: { name: 'banquet' } }),
    );
    expect(duplicate.errors.name?.[0]).toMatch(/already one called/);
    const order = await failure(
      sysadmin.post('/admin/seating-arrangements', { body: { name: 'Pods', displayOrder: -1 } }),
    );
    expect(order.errors.displayOrder).toBeDefined();
  });

  it('says where each is used', async () => {
    const cinema = (await seating()).find((s) => s.id === 'cinema');
    expect(cinema?.usage.facilities).toBeGreaterThan(3);
    expect(cinema?.usage.bookings).toBeGreaterThan(0);
  });

  it('runs an impact check on archiving one that facilities hold capacity figures against', async () => {
    const result = await sysadmin.post<ReferenceImpactResult>(
      '/admin/seating-arrangements/banquet/impact',
    );
    expect(result.facilitiesAffected.length).toBeGreaterThan(3);
    expect(result.facilitiesAffected.find((f) => f.id === 'rothdene-hall')).toMatchObject({
      name: 'Rothdene Hall',
    });
    expect(result.affectedBookings.length).toBeGreaterThan(0);
    expect(result.affectedBookings.every((b) => b.reason === 'arrangement_archived')).toBe(true);
    expect(result.totalAffected).toBe(result.affectedBookings.length);
  });

  it('archives rather than deletes: gone from the form, still named on old bookings, still in the list', async () => {
    await sysadmin.post('/admin/seating-arrangements/banquet/archive');
    const offered = await options();
    expect(offered.seatingArrangements.map((s) => s.id)).not.toContain('banquet');
    expect(offered.retiredSeatingArrangements).toEqual([{ id: 'banquet', name: 'Banquet' }]);
    expect((await seating()).find((s) => s.id === 'banquet')?.status).toBe('archived');

    // An approver still reads the arrangement a past request chose.
    const queue = await approver.get<{ items: Array<{ id: string }> }>('/approvals', {
      query: { pageSize: 50 },
    });
    const names = await Promise.all(
      queue.items.map(
        async (i) =>
          (await approver.get<{ seatingArrangementName: string | null }>(`/approvals/${i.id}`))
            .seatingArrangementName,
      ),
    );
    expect(names).toContain('Banquet');
  });

  it('refuses to submit a request with an archived arrangement', async () => {
    await sysadmin.post('/admin/seating-arrangements/cinema/archive');
    const draft = await applicant.post<Booking>('/bookings', {
      body: {
        facilityId: 'city-hall',
        startsAt: '2026-11-24T07:00:00Z',
        endsAt: '2026-11-24T10:00:00Z',
      },
    });
    await applicant.patch(`/bookings/${draft.id}`, {
      body: {
        eventTypeId: 'meeting',
        description: 'A meeting',
        attendeeCount: 20,
        seatingArrangementId: 'cinema',
        resources: [],
        acceptedTermsVersion: '2026-1',
      },
    });
    const refused = await failure(applicant.post(`/bookings/${draft.id}/submit`));
    expect(refused.errors.seatingArrangementId).toBeDefined();
  });

  it('can be restored', async () => {
    await sysadmin.post('/admin/seating-arrangements/banquet/archive');
    await sysadmin.post('/admin/seating-arrangements/banquet/restore');
    expect((await options()).seatingArrangements.map((s) => s.id)).toContain('banquet');
  });

  it('cannot be renamed while archived', async () => {
    await sysadmin.post('/admin/seating-arrangements/banquet/archive');
    expect(
      (
        await failure(
          sysadmin.patch('/admin/seating-arrangements/banquet', { body: { name: 'Feast' } }),
        )
      ).status,
    ).toBe(409);
  });

  it('carries the capacity figures along when renamed', async () => {
    const before = await capacityOf('rothdene-hall');
    expect(before.byArrangement.map((c) => c.arrangement)).toContain('Cinema');
    await sysadmin.patch('/admin/seating-arrangements/cinema', { body: { name: 'Theatre' } });
    const after = await capacityOf('rothdene-hall');
    expect(after.byArrangement.map((c) => c.arrangement)).toContain('Theatre');
    expect(after.byArrangement.map((c) => c.arrangement)).not.toContain('Cinema');
  });

  it('is not offered to the capacity editor once archived, though a figure already there stays', async () => {
    await sysadmin.post('/admin/seating-arrangements/banquet/archive');
    const capacity = await capacityOf('rothdene-hall');
    // Keeping what is already recorded is allowed.
    await sysadmin.put('/admin/facilities/rothdene-hall/capacity', { body: capacity });
    // Adding it somewhere new is not.
    const other = await capacityOf('lakeside-hall');
    const refused = await failure(
      sysadmin.put('/admin/facilities/lakeside-hall/capacity', {
        body: { ...other, byArrangement: [{ arrangement: 'Pods', capacity: 10 }] },
      }),
    );
    expect(refused.status).toBe(422);
  });

  it('records each change in the audit trail', async () => {
    await sysadmin.post('/admin/seating-arrangements/banquet/archive');
    const trail = await sysadmin.get<AuditList>('/admin/audit', {
      query: { action: 'seating_arrangement.archived' },
    });
    expect(trail.items[0]).toMatchObject({
      actor: { id: 'mock-sysadmin' },
      entityLabel: 'Banquet',
      before: { archived: false },
      after: { archived: true },
    });
  });
});

describe('event types', () => {
  it('adds, renames and archives, with the same rules', async () => {
    const created = await sysadmin.post<ReferenceEntry>('/admin/event-types', {
      body: { name: 'Exhibition' },
    });
    expect((await options()).eventTypes.map((t) => t.name)).toContain('Exhibition');
    await sysadmin.patch(`/admin/event-types/${created.id}`, { body: { name: 'Expo' } });
    await sysadmin.post(`/admin/event-types/${created.id}/archive`);
    const offered = await options();
    expect(offered.eventTypes.map((t) => t.name)).not.toContain('Expo');
    expect(offered.retiredEventTypes.map((t) => t.name)).toEqual(['Expo']);
    expect((await eventTypes()).find((t) => t.id === created.id)?.status).toBe('archived');
  });

  it('keeps its name on bookings that used it', async () => {
    await sysadmin.post('/admin/event-types/wedding/archive');
    const mine = await approver.get<{ items: Array<{ id: string; eventTypeName: string | null }> }>(
      '/approvals',
      { query: { pageSize: 50 } },
    );
    expect(mine.items.some((i) => i.eventTypeName === 'Wedding')).toBe(true);
  });

  it('counts the bookings that used it, and has no capacity figures', async () => {
    const meeting = (await eventTypes()).find((t) => t.id === 'meeting');
    expect(meeting?.usage.bookings).toBeGreaterThan(0);
    expect(meeting?.usage.facilities).toBe(0);
  });
});

describe('terms and conditions', () => {
  const versions = () => sysadmin.get<TermsVersion[]>('/admin/terms');

  it('lists a superseded, a published and a draft version, newest first', async () => {
    const all = await versions();
    expect(all.map((v) => [v.version, v.status])).toEqual([
      ['2026-2', 'draft'],
      ['2026-1', 'published'],
      ['2025-1', 'superseded'],
    ]);
    expect(all.find((v) => v.version === '2026-1')?.bookings).toBeGreaterThan(0);
  });

  it('authors a draft, whose label is the next in the year', async () => {
    const created = await sysadmin.post<TermsVersion>('/admin/terms', {
      body: { title: 'Terms of hire', paragraphs: ['One.', '  ', 'Two.'] },
    });
    expect(created).toMatchObject({
      version: '2026-3',
      status: 'draft',
      paragraphs: ['One.', 'Two.'],
      createdBy: { id: 'mock-sysadmin' },
    });
  });

  it('refuses terms with no title or no words', async () => {
    const refused = await failure(
      sysadmin.post('/admin/terms', { body: { title: '', paragraphs: [] } }),
    );
    expect(refused.errors.title).toBeDefined();
    expect(refused.errors.paragraphs).toBeDefined();
  });

  it('edits a draft', async () => {
    const edited = await sysadmin.patch<TermsVersion>('/admin/terms/terms-2026-2', {
      body: { paragraphs: ['Rewritten.'] },
    });
    expect(edited.paragraphs).toEqual(['Rewritten.']);
    expect(edited.status).toBe('draft');
  });

  it('never edits a published or superseded version', async () => {
    for (const id of ['terms-2026-1', 'terms-2025-1']) {
      const refused = await failure(
        sysadmin.patch(`/admin/terms/${id}`, { body: { title: 'Changed' } }),
      );
      expect(refused.status).toBe(409);
      expect(refused.detail).toMatch(/publish a new version instead/);
    }
    expect((await versions()).find((v) => v.id === 'terms-2026-1')?.title).toBe(
      'Terms and conditions of hire',
    );
  });

  it('publishes a draft, superseding the previous version in the same step', async () => {
    const published = await sysadmin.post<TermsVersion>('/admin/terms/terms-2026-2/publish');
    expect(published).toMatchObject({ status: 'published', publishedBy: { id: 'mock-sysadmin' } });
    const all = await versions();
    expect(all.filter((v) => v.status === 'published').map((v) => v.version)).toEqual(['2026-2']);
    const old = all.find((v) => v.version === '2026-1');
    expect(old?.status).toBe('superseded');
    expect(old?.supersededAt).toBe(published.publishedAt);
  });

  it('cannot publish something that is not a draft', async () => {
    expect((await failure(sysadmin.post('/admin/terms/terms-2026-1/publish'))).status).toBe(409);
    expect((await failure(sysadmin.post('/admin/terms/terms-2025-1/publish'))).status).toBe(409);
  });

  it('is followed by the public terms and the booking form', async () => {
    expect((await applicant.get<PublishedTerms>('/terms/current')).version).toBe('2026-1');
    await sysadmin.post('/admin/terms/terms-2026-2/publish');
    const current = await applicant.get<PublishedTerms>('/terms/current');
    expect(current.version).toBe('2026-2');
    expect(current.paragraphs).toHaveLength(4);
    expect((await options()).terms.version).toBe('2026-2');
  });

  it('records the version current at submission, and refuses one that has since been replaced', async () => {
    const draft = await applicant.post<Booking>('/bookings', {
      body: {
        facilityId: 'city-hall',
        startsAt: '2026-11-24T07:00:00Z',
        endsAt: '2026-11-24T10:00:00Z',
      },
    });
    await applicant.patch(`/bookings/${draft.id}`, {
      body: {
        eventTypeId: 'meeting',
        description: 'A meeting',
        attendeeCount: 20,
        seatingArrangementId: 'cinema',
        resources: [],
        acceptedTermsVersion: '2026-1',
      },
    });
    // The draft was started against 2026-1; before it is submitted, 2026-2 is published.
    await sysadmin.post('/admin/terms/terms-2026-2/publish');
    const refused = await failure(applicant.post(`/bookings/${draft.id}/submit`));
    expect(refused.errors.termsAccepted?.[0]).toMatch(/updated while you were completing/);
    expect(refused.errors.termsAccepted?.[0]).toMatch(/2026-2/);

    await applicant.patch(`/bookings/${draft.id}`, { body: { acceptedTermsVersion: '2026-2' } });
    const submitted = await applicant.post<Booking>(`/bookings/${draft.id}/submit`);
    expect(submitted.acceptedTermsVersion).toBe('2026-2');
  });

  it('records publication in the audit trail', async () => {
    await sysadmin.post('/admin/terms/terms-2026-2/publish');
    const trail = await sysadmin.get<AuditList>('/admin/audit', {
      query: { action: 'terms.published', pageSize: 5 },
    });
    expect(trail.items[0]).toMatchObject({
      entityLabel: '2026-2',
      before: { currentVersion: '2026-1' },
      after: { currentVersion: '2026-2' },
    });
  });
});
