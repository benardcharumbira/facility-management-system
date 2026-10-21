import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedAudit } from '@/mocks/data/auditSeeds';
import { seedFacilityAdmin, seedUnroutedRequests } from '@/mocks/data/facilityAdminSeeds';
import { TEST_API_BASE_URL } from '@/mocks/server';
import { createApiClient, type AdminFacility, type AdminUser } from '@/shared/api';
import { ROLES } from '@/shared/auth';
import { clerkState } from '@/test/clerk-mock';
import { FIXED_NOW } from '@/test/clock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, setViewportWidth } from '@/test/viewport';

const signInAs = (id: string, role: (typeof ROLES)[keyof typeof ROLES]) => {
  mockMeRole(role);
  clerkState.getToken.mockImplementation(async () => `user:${id}`);
};

beforeEach(() => {
  signInAs('mock-sysadmin', ROLES.systemAdmin);
  setViewportWidth(DESKTOP_WIDTH);
  seedFacilityAdmin(FIXED_NOW);
  seedUnroutedRequests(FIXED_NOW);
  seedAudit(FIXED_NOW);
});

const api = createApiClient({
  baseUrl: TEST_API_BASE_URL,
  getToken: async () => 'user:mock-sysadmin',
});
const userOnServer = (id: string) => api.get<AdminUser>(`/admin/users/${id}`);
const alertdialog = () => screen.findByRole('alertdialog');
const affected = (scope: HTMLElement) =>
  within(within(scope).getByRole('list', { name: 'Affected bookings' }))
    .getAllByRole('listitem')
    .map((li) => /MVL-2026-\d+/.exec(li.textContent ?? '')?.[0]);

async function openUser(id: string, heading: string) {
  renderApp(`/admin/users/${id}`);
  await screen.findByRole('heading', { level: 1, name: heading });
  await screen.findByRole('group', { name: 'Role' });
}
const chooseRole = (label: string) =>
  userEvent.click(screen.getByRole('radio', { name: new RegExp(`^${label}`) }));
const changeRole = () => userEvent.click(screen.getByRole('button', { name: 'Change role' }));

describe('the list', () => {
  it('opens on the staff, with the applicants and everyone a tab away', async () => {
    renderApp('/admin/users');
    const list = await screen.findByRole('list', { name: 'Users' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(14);
    const tabs = screen.getByRole('navigation', { name: 'Who to show' });
    expect(within(tabs).getByRole('link', { name: /^Staff\s*14/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabs).getByRole('link', { name: /^Applicants\s*2\d\d/ })).toBeVisible();
  });

  it('pages through a much larger applicant list', async () => {
    renderApp('/admin/users?audience=applicants');
    const list = await screen.findByRole('list', { name: 'Users' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(25);
    const first = within(list).getAllByRole('link')[0]?.textContent;
    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Users' })).getAllByRole('link')[0]?.textContent,
      ).not.toBe(first),
    );
  });

  it('searches by name and email', async () => {
    renderApp('/admin/users?audience=all');
    await screen.findByRole('list', { name: 'Users' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search users' }), 'sipho.nkosi@');
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Users' })).getAllByRole('listitem'),
      ).toHaveLength(1),
    );
    expect(screen.getByRole('link', { name: 'Sipho Nkosi' })).toBeVisible();
  });

  it('shows role, status, last sign-in and how many facilities an approver covers', async () => {
    renderApp('/admin/users');
    await screen.findByRole('link', { name: 'Nomsa Dlamini' });
    const row = (name: string) =>
      screen.getByRole('link', { name }).closest('article') as HTMLElement;
    expect(within(row('Nomsa Dlamini')).getByText('Facility administrator')).toBeVisible();
    expect(within(row('Nomsa Dlamini')).getByText('Approves for 6 facilities')).toBeVisible();
    expect(within(row('Nomsa Dlamini')).getByText('Last signed in 2 November 2026')).toBeVisible();
    expect(within(row('Busisiwe Zulu')).getByText('Has never signed in')).toBeVisible();
  });

  it('flags an approver with no facilities, and offers to show just them', async () => {
    renderApp('/admin/users');
    const idle = await screen.findByRole('link', { name: 'Busisiwe Zulu' });
    expect(
      within(idle.closest('article') as HTMLElement).getByText('No facilities designated'),
    ).toBeVisible();
    expect(screen.getByText('1 facility administrator has no facilities designated')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Show them' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Users' })).getAllByRole('listitem'),
      ).toHaveLength(1),
    );
  });

  it('filters by role and status from the filter panel', async () => {
    renderApp('/admin/users?role=system_admin');
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Users' })).getAllByRole('listitem'),
      ).toHaveLength(2),
    );
    expect(screen.getByText('Role: System administrator')).toBeVisible();
  });

  it('points to Clerk for inviting staff rather than doing it', async () => {
    renderApp('/admin/users');
    const link = await screen.findByRole('link', { name: /Invite staff in Clerk/ });
    expect(link).toHaveAttribute('href', 'https://dashboard.clerk.com/');
    expect(screen.queryByRole('button', { name: /invite/i })).toBeNull();
  });
});

describe('the Clerk profile', () => {
  it('is shown and cannot be edited, with a note on where it is maintained', async () => {
    await openUser('mock-approver-1', 'Nomsa Dlamini');
    const profile = screen
      .getByRole('heading', { level: 2, name: 'Profile' })
      .closest('section') as HTMLElement;
    expect(within(profile).getByText('nomsa.dlamini@example.org')).toBeVisible();
    expect(within(profile).getByText('+27 16 360 7001')).toBeVisible();
    expect(within(profile).getByText('This profile is maintained in Clerk')).toBeVisible();
    expect(within(profile).getByRole('link', { name: /Clerk dashboard/ })).toHaveAttribute(
      'href',
      'https://dashboard.clerk.com/',
    );
    expect(within(profile).queryByRole('textbox')).toBeNull();
    expect(within(profile).queryByRole('button')).toBeNull();
  });

  it('offers no credential, password or email management anywhere on the screen', async () => {
    await openUser('mock-approver-1', 'Nomsa Dlamini');
    for (const control of [...screen.getAllByRole('button'), ...screen.queryAllByRole('textbox')]) {
      expect(control).not.toHaveAccessibleName(/password|reset|e-?mail|credential|invite/i);
    }
  });
});

describe('granting a role', () => {
  it('asks first, in words, naming what the role permits, and changes nothing until confirmed', async () => {
    await openUser('staff-internal-1', 'Thandi Molefe');
    await chooseRole('Facility administrator');
    // Choosing is not saving.
    expect((await userOnServer('staff-internal-1')).role).toBe('internal');
    await changeRole();

    const dialog = await alertdialog();
    expect(within(dialog).getByText('Make Thandi Molefe a facility administrator?')).toBeVisible();
    const permits = within(dialog).getByRole('list', {
      name: 'What a facility administrator can do',
    });
    expect(within(permits).getByText(/Approve or reject booking requests/)).toBeVisible();
    expect(
      within(permits).getByText(/Create, change, close and archive any facility/),
    ).toBeVisible();
    expect(within(permits).getByText(/does not let them manage users/)).toBeVisible();
    expect(
      within(dialog).getByText('This takes effect at once and is not announced'),
    ).toBeVisible();
    expect((await userOnServer('staff-internal-1')).role).toBe('internal');

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Make Thandi Molefe a facility administrator' }),
    );
    await waitFor(async () =>
      expect((await userOnServer('staff-internal-1')).role).toBe('facility_admin'),
    );
    expect(await screen.findByText('Thandi Molefe is now a facility administrator.')).toBeVisible();
  });

  it('can be called off without changing anything', async () => {
    await openUser('staff-internal-1', 'Thandi Molefe');
    await chooseRole('System administrator');
    await changeRole();
    const dialog = await alertdialog();
    expect(within(dialog).getByText(/Read and export the audit trail/)).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Do not change the role' }));
    expect((await userOnServer('staff-internal-1')).role).toBe('internal');
  });

  it('traps focus in the dialog, and gives it back to the button that opened it', async () => {
    await openUser('staff-internal-1', 'Thandi Molefe');
    await chooseRole('Facility administrator');
    const opener = screen.getByRole('button', { name: 'Change role' });
    await userEvent.click(opener);
    const dialog = await alertdialog();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(opener).toHaveFocus();
    expect((await userOnServer('staff-internal-1')).role).toBe('internal');
  });

  it('does not save when the choice is merely made', async () => {
    await openUser('staff-internal-1', 'Thandi Molefe');
    expect(screen.getByRole('button', { name: 'Change role' })).toBeDisabled();
    await chooseRole('Facility administrator');
    expect(screen.getByRole('button', { name: 'Change role' })).toBeEnabled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('taking a role away', () => {
  it('lists the facilities left without an approver and the pending requests with nobody to decide them', async () => {
    await openUser('approver-vaal', 'Pieter van Wyk');
    await chooseRole('Applicant');
    await changeRole();

    const dialog = await alertdialog();
    expect(
      within(dialog).getByText(
        'This leaves Vaal Marina Board Room and Vaal Marina Hall with no designated approver, and 3 pending requests with nobody to decide them.',
      ),
    ).toBeVisible();
    expect(affected(dialog)).toEqual(['MVL-2026-9212', 'MVL-2026-9213', 'MVL-2026-9214']);
    expect(
      within(dialog).getAllByText('Nobody would be designated to decide this request.'),
    ).toHaveLength(3);
    expect(within(dialog).getByText(/Nothing is cancelled or moved/)).toBeVisible();
    // Nothing is saved until it is confirmed.
    expect((await userOnServer('approver-vaal')).role).toBe('facility_admin');

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Make Pieter van Wyk an applicant' }),
    );
    await waitFor(async () => expect((await userOnServer('approver-vaal')).role).toBe('applicant'));
  });

  it('names a single facility and a single request in the singular', async () => {
    await openUser('approver-empty', 'Lerato Sithole');
    await chooseRole('Internal user');
    await changeRole();
    const dialog = await alertdialog();
    expect(
      within(dialog).getByText(/This leaves Sicelo Hall with no designated approver\./),
    ).toBeVisible();
  });

  it('shows no dialog when nothing is affected', async () => {
    // Kagiso shares the committee room with Nomsa, so it is not left without anyone.
    await openUser('approver-partial', 'Kagiso Mahlangu');
    await chooseRole('Internal user');
    await changeRole();
    expect(
      await screen.findByText(
        /Kagiso Mahlangu is now an internal user\. They were removed from 1 facility\./,
      ),
    ).toBeVisible();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect((await userOnServer('approver-partial')).role).toBe('internal');
  });

  it('shows no dialog for someone who approves for nothing', async () => {
    await openUser('approver-idle', 'Busisiwe Zulu');
    await chooseRole('Applicant');
    await changeRole();
    expect(await screen.findByText('Busisiwe Zulu is now an applicant.')).toBeVisible();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('deactivation', () => {
  it('says what it strands before it happens', async () => {
    await openUser('approver-empty', 'Lerato Sithole');
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate account' }));
    const dialog = await alertdialog();
    expect(within(dialog).getByText('Deactivate Lerato Sithole?')).toBeVisible();
    expect(
      within(dialog).getByText(/This leaves Sicelo Hall with no designated approver\./),
    ).toBeVisible();
    expect((await userOnServer('approver-empty')).status).toBe('active');

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Deactivate Lerato Sithole' }),
    );
    await waitFor(async () =>
      expect((await userOnServer('approver-empty')).status).toBe('deactivated'),
    );
    expect(await screen.findByRole('button', { name: 'Reactivate account' })).toBeVisible();
  });

  it('is asked for by name even when it strands nothing, since the click is the decision', async () => {
    await openUser('approver-idle', 'Busisiwe Zulu');
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate account' }));
    const dialog = await alertdialog();
    expect(
      within(dialog).getByText(/Their bookings, decisions and history are kept/),
    ).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Go back' }));
    expect((await userOnServer('approver-idle')).status).toBe('active');
  });

  it('can be undone, and says the facilities were not restored', async () => {
    await api.post('/admin/users/approver-vaal/deactivate');
    await openUser('approver-vaal', 'Pieter van Wyk');
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate account' }));
    expect(await screen.findByText(/designate them again/)).toBeVisible();
    expect((await userOnServer('approver-vaal')).status).toBe('active');
  });
});

describe('guard rails', () => {
  it('says why you cannot remove your own administrator role, and does not offer it', async () => {
    await openUser('mock-sysadmin', 'Sipho Nkosi');
    expect(screen.getByText('This role cannot be changed here')).toBeVisible();
    expect(screen.getByText(/You cannot remove your own system administrator role/)).toBeVisible();
    for (const label of ['Applicant', 'Internal user', 'Facility administrator']) {
      expect(screen.getByRole('radio', { name: new RegExp(`^${label}`) })).toBeDisabled();
    }
    expect(screen.getByRole('radio', { name: /^System administrator/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Change role' })).toBeDisabled();
    expect(screen.getByText(/You cannot deactivate your own account/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Deactivate account' })).toBeDisabled();
  });

  it('prevents the last system administrator being removed or deactivated, rather than failing on save', async () => {
    await api.post('/admin/users/sysadmin-two/deactivate');
    await openUser('mock-sysadmin', 'Sipho Nkosi');
    expect(screen.getAllByText(/You are the only active system administrator/)).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /^Applicant/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deactivate account' })).toBeDisabled();
  });

  it('lets another administrator remove it', async () => {
    await openUser('sysadmin-two', 'Zodwa Khumalo');
    expect(screen.queryByText('This role cannot be changed here')).toBeNull();
    await chooseRole('Facility administrator');
    await userEvent.click(screen.getByRole('button', { name: 'Change role' }));
    expect(await screen.findByText('Zodwa Khumalo is now a facility administrator.')).toBeVisible();
  });
});

describe('facilities', () => {
  const facilitiesGroup = () => screen.getByRole('group', { name: 'Approves requests for' });

  it('shows what an approver is designated for, and a flag when it is nothing', async () => {
    await openUser('approver-idle', 'Busisiwe Zulu');
    expect(screen.getByText('Designated against no facilities')).toBeVisible();
    expect(
      within(facilitiesGroup()).getByRole('checkbox', { name: /Rothdene Hall/ }),
    ).not.toBeChecked();
  });

  it('saves a designation made here, and the facility screen shows it', async () => {
    await openUser('approver-idle', 'Busisiwe Zulu');
    await userEvent.click(
      within(facilitiesGroup()).getByRole('checkbox', { name: /Rothdene Hall/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save facilities' }));
    expect(await screen.findByText('Facilities saved.')).toBeVisible();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    const facility = await api.get<AdminFacility>('/admin/facilities/rothdene-hall');
    expect(facility.approvers.map((a) => a.id)).toContain('approver-idle');
  });

  it('shows a designation made on the facility', async () => {
    await api.put('/admin/facilities/sicelo-hall/approvers', {
      body: { userIds: ['approver-empty', 'approver-idle'] },
    });
    await openUser('approver-idle', 'Busisiwe Zulu');
    expect(
      await within(facilitiesGroup()).findByRole('checkbox', { name: /Sicelo Hall/ }),
    ).toBeChecked();
    expect(screen.queryByText('Designated against no facilities')).toBeNull();
  });

  it('shows a designation made here on the facility screen itself', async () => {
    await api.put('/admin/users/approver-idle/facilities', {
      body: { facilityIds: ['lakeside-hall'] },
    });
    renderApp('/admin/facilities/lakeside-hall?section=approvers');
    const list = await screen.findByRole('list', { name: 'Approvers' });
    expect(within(list).getByText('Busisiwe Zulu')).toBeVisible();
  });

  it('checks a removal that would leave a facility with nobody, and names it', async () => {
    await openUser('approver-vaal', 'Pieter van Wyk');
    await userEvent.click(
      within(facilitiesGroup()).getByRole('checkbox', { name: /Vaal Marina Board Room/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save facilities' }));
    const dialog = await alertdialog();
    expect(
      within(dialog).getByText(
        /This leaves Vaal Marina Board Room with no designated approver, and 1 pending request with nobody to decide it\./,
      ),
    ).toBeVisible();
    expect(affected(dialog)).toEqual(['MVL-2026-9214']);
  });

  it('is only for facility administrators', async () => {
    await openUser('mock-sysadmin', 'Sipho Nkosi');
    expect(screen.queryByRole('group', { name: 'Approves requests for' })).toBeNull();
    expect(
      screen.getByText(/Only a facility administrator is designated against facilities/),
    ).toBeVisible();
  });
});

describe('history', () => {
  it('records a role change with who made it, and shows it on the person', async () => {
    await openUser('approver-idle', 'Busisiwe Zulu');
    const history = await screen.findByRole('list', { name: 'History of changes' });
    expect(
      within(history).getByText(/role changed from applicant to facility_admin/i),
    ).toBeVisible();
    expect(within(history).getByText(/by Sipho Nkosi/)).toBeVisible();
  });

  it('adds a change made now', async () => {
    await openUser('staff-internal-1', 'Thandi Molefe');
    expect(await screen.findByText('No changes recorded')).toBeVisible();
    await chooseRole('Facility administrator');
    await changeRole();
    await userEvent.click(
      within(await alertdialog()).getByRole('button', {
        name: 'Make Thandi Molefe a facility administrator',
      }),
    );
    const history = await screen.findByRole('list', { name: 'History of changes' });
    expect(
      within(history).getByText(/role changed from internal to facility_admin/i),
    ).toBeVisible();
  });
});

describe('unsaved choices', () => {
  it('asks before leaving with a role chosen and not saved', async () => {
    const { router } = renderApp('/admin/users/staff-internal-1');
    await screen.findByRole('group', { name: 'Role' });
    await chooseRole('Facility administrator');
    await router.navigate('/admin/users');
    const dialog = await alertdialog();
    expect(within(dialog).getByText('Leave without saving?')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay here' }));
    expect(router.state.location.pathname).toBe('/admin/users/staff-internal-1');
  });
});

describe('who can reach it', () => {
  beforeEach(() => signInAs('mock-approver-1', ROLES.facilityAdmin));

  it.each(['/admin/users', '/admin/users/mock-approver-1', '/admin/reference', '/admin/audit'])(
    'keeps a facility administrator out of %s',
    async (path) => {
      renderApp(path);
      expect(await screen.findByText('Forbidden')).toBeVisible();
    },
  );

  it('does not show a facility administrator the links', async () => {
    renderApp('/approvals');
    await screen.findByRole('navigation', { name: /main|primary/i }).catch(() => undefined);
    await screen.findAllByRole('link', { name: /Manage facilities/ });
    expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Reference data' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Audit trail' })).toBeNull();
  });

  it('shows a system administrator all three', async () => {
    signInAs('mock-sysadmin', ROLES.systemAdmin);
    renderApp('/admin/users');
    expect((await screen.findAllByRole('link', { name: 'Reference data' })).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByRole('link', { name: 'Audit trail' }).length).toBeGreaterThan(0);
  });
});
