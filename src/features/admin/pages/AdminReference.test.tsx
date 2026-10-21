import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedApprovals } from '@/mocks/data/approvalSeeds';
import { seedAudit } from '@/mocks/data/auditSeeds';
import { seedFacilityAdmin } from '@/mocks/data/facilityAdminSeeds';
import { TEST_API_BASE_URL } from '@/mocks/server';
import {
  createApiClient,
  type BookingOptions,
  type PublishedTerms,
  type ReferenceEntry,
  type TermsVersion,
} from '@/shared/api';
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
const alertdialog = () => screen.findByRole('alertdialog');
const entry = (list: HTMLElement, name: string) =>
  within(list).getByRole('heading', { level: 3, name }).closest('article') as HTMLElement;

describe('seating arrangements', () => {
  async function open() {
    renderApp('/admin/reference');
    return screen.findByRole('list', { name: 'Seating arrangements' });
  }

  it('lists the seeded set in display order, with where each is used', async () => {
    const list = await open();
    const names = within(list)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(names).toEqual([
      'Cinema',
      'Banquet',
      'School room',
      'U-shape',
      'Boardroom',
      'Open floor',
    ]);
    expect(
      within(entry(list, 'Banquet')).getByText(/facilities hold a capacity for it/),
    ).toBeVisible();
    expect(within(entry(list, 'Open floor')).getByText(/used by 0 bookings/)).toBeVisible();
  });

  it('adds one, and the booking form then offers it', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Add a seating arrangement' }));
    const form = screen.getByRole('form', { name: 'Add a seating arrangement' });
    await userEvent.type(within(form).getByLabelText(/Name/), 'Cabaret');
    await userEvent.click(within(form).getByRole('button', { name: 'Add seating arrangement' }));
    expect(await screen.findByText('Cabaret added.')).toBeVisible();
    expect(
      (await api.get<BookingOptions>('/booking-options')).seatingArrangements.map((s) => s.name),
    ).toContain('Cabaret');
  });

  it('explains a name that is already taken', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Add a seating arrangement' }));
    const form = screen.getByRole('form', { name: 'Add a seating arrangement' });
    await userEvent.type(within(form).getByLabelText(/Name/), 'banquet');
    await userEvent.click(within(form).getByRole('button', { name: 'Add seating arrangement' }));
    expect(await within(form).findByText('There is already one called banquet.')).toBeVisible();
  });

  it('renames one and changes its place in the order', async () => {
    const list = await open();
    await userEvent.click(
      within(entry(list, 'Open floor')).getByRole('button', { name: 'Edit Open floor' }),
    );
    const form = screen.getByRole('form', { name: 'Edit Open floor' });
    await userEvent.clear(within(form).getByLabelText(/Name/));
    await userEvent.type(within(form).getByLabelText(/Name/), 'Standing');
    await userEvent.clear(within(form).getByLabelText('Display order'));
    await userEvent.type(within(form).getByLabelText('Display order'), '5');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Standing saved.')).toBeVisible();
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Seating arrangements' })).getAllByRole('heading', {
          level: 3,
        })[0],
      ).toHaveTextContent('Standing'),
    );
  });

  it('runs an impact check on archiving one with capacity figures against it, and names them', async () => {
    const list = await open();
    await userEvent.click(
      within(entry(list, 'Banquet')).getByRole('button', { name: 'Archive Banquet' }),
    );
    const dialog = await alertdialog();
    expect(within(dialog).getByText('Archive Banquet?')).toBeVisible();
    expect(
      within(dialog).getByText(
        /facilities hold a capacity figure for it, which will no longer be offered/,
      ),
    ).toBeVisible();
    const figures = within(dialog).getByRole('list', { name: 'Facilities with a figure' });
    expect(within(figures).getByText(/Rothdene Hall: \d+ people/)).toBeVisible();
    // The bookings that chose it are named, and left alone.
    expect(within(dialog).getByRole('list', { name: 'Affected bookings' })).toBeVisible();
    expect(within(dialog).getAllByText(/The booking is left as it is/).length).toBeGreaterThan(0);
    expect(
      (await api.get<ReferenceEntry[]>('/admin/seating-arrangements')).find(
        (s) => s.id === 'banquet',
      )?.status,
    ).toBe('active');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(async () =>
      expect(
        (await api.get<ReferenceEntry[]>('/admin/seating-arrangements')).find(
          (s) => s.id === 'banquet',
        )?.status,
      ).toBe('archived'),
    );
    const options = await api.get<BookingOptions>('/booking-options');
    expect(options.seatingArrangements.map((s) => s.id)).not.toContain('banquet');
    expect(options.retiredSeatingArrangements.map((s) => s.name)).toEqual(['Banquet']);
  });

  it('archives one nothing uses without naming anything, and can restore it', async () => {
    const list = await open();
    await userEvent.click(
      within(entry(list, 'Open floor')).getByRole('button', { name: 'Archive Open floor' }),
    );
    const dialog = await alertdialog();
    expect(within(dialog).queryByRole('list', { name: 'Facilities with a figure' })).toBeNull();
    expect(within(dialog).getByText('No upcoming bookings are affected.')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));

    const archived = await screen.findByRole('button', { name: 'Restore Open floor' });
    expect(
      within(
        entry(screen.getByRole('list', { name: 'Seating arrangements' }), 'Open floor'),
      ).getByText('Archived'),
    ).toBeVisible();
    await userEvent.click(archived);
    expect(await screen.findByText('Open floor restored.')).toBeVisible();
  });
});

describe('event types', () => {
  it('has its own section, and notes the question about what an event type should affect', async () => {
    renderApp('/admin/reference?section=event-types');
    const list = await screen.findByRole('list', { name: 'Event types' });
    expect(within(list).getAllByRole('heading', { level: 3 })).toHaveLength(9);
    expect(screen.getByText(/affects nothing beyond reporting/)).toBeVisible();
    expect(screen.getByText(/open question for the client/)).toBeVisible();
  });

  it('archives one, which leaves the form and keeps its name on old bookings', async () => {
    renderApp('/admin/reference?section=event-types');
    const list = await screen.findByRole('list', { name: 'Event types' });
    await userEvent.click(
      within(entry(list, 'Wedding')).getByRole('button', { name: 'Archive Wedding' }),
    );
    const dialog = await alertdialog();
    expect(within(dialog).getByText(/Bookings that chose it keep it/)).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
    expect(await screen.findByText('Wedding archived.')).toBeVisible();
    const options = await api.get<BookingOptions>('/booking-options');
    expect(options.eventTypes.map((t) => t.name)).not.toContain('Wedding');
    expect(options.retiredEventTypes.map((t) => t.name)).toContain('Wedding');
  });
});

describe('terms and conditions', () => {
  async function open() {
    renderApp('/admin/reference?section=terms');
    return screen.findByRole('list', { name: 'Versions of the terms' });
  }
  const version = (list: HTMLElement, label: string) =>
    within(list)
      .getByRole('heading', { level: 3, name: new RegExp(`^Version ${label}`) })
      .closest('article') as HTMLElement;

  it('lists a draft, the published version and a superseded one, with their dates and use', async () => {
    const list = await open();
    expect(within(version(list, '2026-2')).getByText('Draft')).toBeVisible();
    expect(within(version(list, '2026-1')).getByText('Published')).toBeVisible();
    expect(within(version(list, '2025-1')).getByText('Superseded')).toBeVisible();
    expect(within(version(list, '2026-1')).getByText(/published 1 February 2026/)).toBeVisible();
    expect(within(version(list, '2026-1')).getByText(/Accepted on \d+ bookings/)).toBeVisible();
  });

  it('offers editing and publishing only on a draft', async () => {
    const list = await open();
    expect(
      within(version(list, '2026-2')).getByRole('button', { name: 'Edit version 2026-2' }),
    ).toBeVisible();
    expect(
      within(version(list, '2026-2')).getByRole('button', { name: 'Publish version 2026-2' }),
    ).toBeVisible();
    for (const label of ['2026-1', '2025-1']) {
      expect(
        within(version(list, label)).queryByRole('button', { name: /Edit|Publish/ }),
      ).toBeNull();
    }
  });

  it('shows a published version, says it cannot be edited, and offers a new draft from it', async () => {
    const list = await open();
    await userEvent.click(
      within(version(list, '2026-1')).getByRole('button', { name: 'View version 2026-1' }),
    );
    expect(await screen.findByText('This version cannot be edited')).toBeVisible();
    expect(screen.getByText(/Applicants accepted these exact words/)).toBeVisible();
    expect(screen.getByRole('article', { name: 'How applicants read these terms' })).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Start a new draft from this version' }),
    ).toBeVisible();
  });

  it('refuses an edit to a published version on the server as well', async () => {
    await expect(
      api.patch('/admin/terms/terms-2026-1', { body: { title: 'Changed' } }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it('edits a draft, with a preview of what applicants will read', async () => {
    const list = await open();
    await userEvent.click(
      within(version(list, '2026-2')).getByRole('button', { name: 'Edit version 2026-2' }),
    );
    const form = await screen.findByRole('form', { name: 'Terms and conditions draft' });
    const words = within(form).getByLabelText(/The terms/);
    await userEvent.clear(words);
    await userEvent.type(words, 'First paragraph.{Enter}{Enter}Second paragraph.');
    await userEvent.click(within(form).getByRole('button', { name: 'Preview' }));
    const preview = within(form).getByRole('article', { name: 'How applicants read these terms' });
    expect(within(preview).getByText('First paragraph.')).toBeVisible();
    expect(within(preview).getByText('Second paragraph.')).toBeVisible();
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft 2026-2 saved.')).toBeVisible();
    const saved = (await api.get<TermsVersion[]>('/admin/terms')).find(
      (t) => t.version === '2026-2',
    );
    expect(saved?.paragraphs).toEqual(['First paragraph.', 'Second paragraph.']);
  });

  it('starts a new draft from the published words', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Start a new draft' }));
    const form = await screen.findByRole('form', { name: 'Terms and conditions draft' });
    expect((within(form).getByLabelText(/The terms/) as HTMLTextAreaElement).value).toContain(
      'A booking request is not a confirmed booking.',
    );
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft 2026-3 saved.')).toBeVisible();
  });

  it('says what publishing does, including the rule for requests in flight', async () => {
    const list = await open();
    await userEvent.click(
      within(version(list, '2026-2')).getByRole('button', { name: 'Publish version 2026-2' }),
    );
    const dialog = await alertdialog();
    expect(within(dialog).getByText('Publish version 2026-2?')).toBeVisible();
    expect(within(dialog).getByText(/version 2026-1 is superseded/)).toBeVisible();
    expect(
      within(dialog).getByText(
        /records the version that is current at the moment it is submitted, not the one that was current when its draft was started/,
      ),
    ).toBeVisible();
    expect(within(dialog).getByText(/Once published, these words cannot be edited/)).toBeVisible();
    // Not yet.
    expect((await api.get<PublishedTerms>('/public/terms')).version).toBe('2026-1');
  });

  it('publishes, supersedes the previous version, and the public terms follow', async () => {
    const list = await open();
    await userEvent.click(
      within(version(list, '2026-2')).getByRole('button', { name: 'Publish version 2026-2' }),
    );
    await userEvent.click(
      within(await alertdialog()).getByRole('button', { name: 'Publish version 2026-2' }),
    );
    expect(await screen.findByText('Version 2026-2 is now the current terms.')).toBeVisible();
    expect((await api.get<PublishedTerms>('/public/terms')).version).toBe('2026-2');
    expect((await api.get<BookingOptions>('/booking-options')).terms.version).toBe('2026-2');
    const all = await api.get<TermsVersion[]>('/admin/terms');
    expect(all.find((t) => t.version === '2026-1')?.status).toBe('superseded');
    // The new version is now one that cannot be edited.
    expect(await screen.findByText('This version cannot be edited')).toBeVisible();
  });

  it('asks before leaving a draft that has not been saved', async () => {
    const { router } = renderApp('/admin/reference?section=terms');
    const list = await screen.findByRole('list', { name: 'Versions of the terms' });
    await userEvent.click(
      within(version(list, '2026-2')).getByRole('button', { name: 'Edit version 2026-2' }),
    );
    const words = await screen.findByLabelText(/The terms/);
    await userEvent.type(words, ' More.');
    await userEvent.click(screen.getByRole('link', { name: 'Event types' }));
    const dialog = await alertdialog();
    expect(within(dialog).getByText('Leave without saving?')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay here' }));
    expect(router.state.location.search).toBe('?section=terms');
  });
});

describe('who can reach it', () => {
  it('keeps the sections in the URL', async () => {
    renderApp('/admin/reference?section=terms');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Terms and conditions' }),
    ).toBeVisible();
    expect(
      within(screen.getByRole('navigation', { name: 'Reference data sections' })).getByRole(
        'link',
        {
          name: 'Terms and conditions',
        },
      ),
    ).toHaveAttribute('aria-current', 'page');
  });
});
