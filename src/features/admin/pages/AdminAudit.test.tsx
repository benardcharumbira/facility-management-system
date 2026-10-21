import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedApprovals } from '@/mocks/data/approvalSeeds';
import { seedAudit } from '@/mocks/data/auditSeeds';
import { seedFacilityAdmin } from '@/mocks/data/facilityAdminSeeds';
import { TEST_API_BASE_URL } from '@/mocks/server';
import { createApiClient, type AuditExportRecord, type AuditList } from '@/shared/api';
import { ROLES } from '@/shared/auth';
import { clerkState } from '@/test/clerk-mock';
import { FIXED_NOW } from '@/test/clock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, setViewportWidth } from '@/test/viewport';

beforeEach(() => {
  mockMeRole(ROLES.systemAdmin);
  clerkState.getToken.mockImplementation(async () => 'user:mock-sysadmin');
  setViewportWidth(DESKTOP_WIDTH);
  seedFacilityAdmin(FIXED_NOW);
  seedApprovals(FIXED_NOW);
  seedAudit(FIXED_NOW);
});

const api = createApiClient({
  baseUrl: TEST_API_BASE_URL,
  getToken: async () => 'user:mock-sysadmin',
});
const entries = () =>
  within(screen.getByRole('list', { name: 'Audit entries' })).getAllByRole('listitem');
const count = () => screen.getByRole('status');
const filters = () => screen.getByRole('form', { name: 'Filter the audit trail' });

async function open(search = '') {
  renderApp(`/admin/audit${search}`);
  await screen.findByRole('list', { name: 'Audit entries' });
}

describe('the query', () => {
  it('shows the newest first, in pages', async () => {
    await open();
    expect(entries()).toHaveLength(25);
    expect(count()).toHaveTextContent(/\d{3} entries/);
    const first = entries()[0]?.textContent;
    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    await waitFor(() => expect(entries()[0]?.textContent).not.toBe(first));
    expect(entries()).toHaveLength(25);
  });

  it('answers what happened to one booking, by its reference', async () => {
    await open();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Booking reference' }), '00417');
    await waitFor(() => expect(entries()).toHaveLength(5));
    expect(count()).toHaveTextContent('5 entries');
    const texts = entries().map((li) => li.textContent ?? '');
    expect(texts.every((t) => t.includes('MVL-2026-00417'))).toBe(true);
    expect(texts[0]).toMatch(/Move approved/);
    expect(texts.at(-1)).toMatch(/Booking started/);
  });

  it('can be linked: the reference is in the URL', async () => {
    await open('?reference=00417');
    await waitFor(() => expect(entries()).toHaveLength(5));
  });

  it('filters by action and by who did it, applied together', async () => {
    await open();
    await userEvent.selectOptions(within(filters()).getByLabelText('Action'), 'Booking rejected');
    await userEvent.type(within(filters()).getByLabelText('Done by'), 'vaal');
    await userEvent.click(within(filters()).getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(count()).not.toHaveTextContent(/\d{3} entries/));
    for (const li of entries()) {
      expect(li).toHaveTextContent('Booking rejected');
      expect(li).toHaveTextContent('By Pieter van Wyk');
    }
  });

  it('filters by a date range, inclusive at both ends', async () => {
    await open();
    await userEvent.type(within(filters()).getByLabelText('From'), '2020-01-01');
    await userEvent.type(within(filters()).getByLabelText('To'), '2020-01-31');
    await userEvent.click(within(filters()).getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findByText('Nothing matches')).toBeVisible();
  });

  it('will not apply a range that ends before it starts', async () => {
    await open();
    await userEvent.type(within(filters()).getByLabelText('From'), '2026-10-31');
    await userEvent.type(within(filters()).getByLabelText('To'), '2026-10-01');
    expect(within(filters()).getByText('The last day cannot be before the first.')).toBeVisible();
    expect(within(filters()).getByRole('button', { name: 'Apply filters' })).toBeDisabled();
  });

  it('clears the filters', async () => {
    await open('?reference=00417');
    await waitFor(() => expect(entries()).toHaveLength(5));
    await userEvent.click(within(filters()).getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(entries()).toHaveLength(25));
  });
});

describe('before and after', () => {
  it('expands an entry to show the state before and after', async () => {
    await open('?reference=00417&action=booking.approved');
    await waitFor(() => expect(entries()).toHaveLength(1));
    const entry = entries()[0] as HTMLElement;
    expect(within(entry).queryByRole('table')).toBeNull();
    await userEvent.click(within(entry).getByRole('button'));
    const table = await within(entry).findByRole('table', { name: 'State before and after' });
    const status = within(table).getByRole('row', { name: /Status/ });
    expect(within(status).getByText('pending')).toBeVisible();
    expect(within(status).getByText('approved')).toBeVisible();
    expect(within(status).getByText('(changed)')).toBeVisible();
    expect(within(entry).getByText(/mock-approver-1/)).toBeVisible();
  });

  it('says so when there was nothing before', async () => {
    await open('?reference=00417&action=booking.created');
    await waitFor(() => expect(entries()).toHaveLength(1));
    await userEvent.click(within(entries()[0] as HTMLElement).getByRole('button'));
    expect(
      await screen.findByText(/There was nothing before: this entry created it/),
    ).toBeVisible();
  });
});

describe('the export', () => {
  afterEach(() => vi.restoreAllMocks());

  const stubDownload = () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    return createObjectURL;
  };

  it('needs a date range, and says so', async () => {
    await open();
    const button = screen.getByRole('button', { name: 'Export as CSV' });
    expect(button).toBeDisabled();
    expect(
      screen.getByText('Choose a first and last day to export. There is no export of everything.'),
    ).toBeVisible();
    // One end is not enough.
    await userEvent.type(within(filters()).getByLabelText('From'), '2026-08-01');
    await userEvent.click(within(filters()).getByRole('button', { name: 'Apply filters' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Export as CSV' })).toBeDisabled(),
    );
  });

  it('exports the current result set, and the export is itself recorded', async () => {
    const createObjectURL = stubDownload();
    await open('?reference=00417&from=2026-08-01&to=2026-11-02');
    await waitFor(() => expect(entries()).toHaveLength(5));
    await userEvent.click(screen.getByRole('button', { name: 'Export as CSV' }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const [blob] = createObjectURL.mock.calls[0] as unknown as [Blob];
    const lines = (await blob.text()).trim().split('\r\n');
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain('When (UTC),Actor');
    expect(
      await screen.findByText('Exported 5 entries. The export is recorded in the audit trail.'),
    ).toBeVisible();

    const trail = await api.get<AuditList>('/admin/audit', { query: { action: 'audit.exported' } });
    expect(trail.items).toHaveLength(1);
    expect(trail.items[0]).toMatchObject({ actor: { id: 'mock-sysadmin' } });
    expect((trail.items[0]?.after as unknown as AuditExportRecord).rowCount).toBe(5);
    expect((trail.items[0]?.after as unknown as AuditExportRecord).filters).toMatchObject({
      reference: '00417',
      from: '2026-08-01',
      to: '2026-11-02',
    });
  });

  it('shows the export in the trail afterwards', async () => {
    stubDownload();
    await open('?from=2026-10-01&to=2026-11-02&action=booking.approved');
    await waitFor(() => expect(count()).toHaveTextContent(/entr/));
    await userEvent.click(screen.getByRole('button', { name: 'Export as CSV' }));
    await screen.findByText(/The export is recorded in the audit trail/);
    const trail = await api.get<AuditList>('/admin/audit', { query: { action: 'audit.exported' } });
    expect(trail.totalItems).toBe(1);
  });
});

describe('who can see it', () => {
  it('tells a system administrator that it holds personal information', async () => {
    await open();
    expect(screen.getByText('This contains personal information')).toBeVisible();
  });

  it('is closed to a facility administrator', async () => {
    mockMeRole(ROLES.facilityAdmin);
    clerkState.getToken.mockImplementation(async () => 'user:mock-approver-1');
    renderApp('/admin/audit');
    expect(await screen.findByText('Forbidden')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Audit entries' })).toBeNull();
  });

  it('is refused by the server for a facility administrator even if the page is reached', async () => {
    const facilityAdmin = createApiClient({
      baseUrl: TEST_API_BASE_URL,
      getToken: async () => 'user:mock-approver-1',
    });
    await expect(facilityAdmin.get('/admin/audit')).rejects.toMatchObject({ status: 403 });
    await expect(
      facilityAdmin.download('/admin/audit/export?from=2026-10-01&to=2026-10-31'),
    ).rejects.toMatchObject({ status: 403 });
  });
});
