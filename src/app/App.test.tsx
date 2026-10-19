import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { clerkState, signOutUser } from '@/test/clerk-mock';
import { mockMeRole, renderApp } from '@/test/render';
import { ROLES } from '@/shared/auth';

describe('application shell', () => {
  it('renders the shell with the signed in user and role-driven navigation', async () => {
    mockMeRole(ROLES.applicant);
    renderApp('/facilities');

    expect(await screen.findByRole('heading', { level: 1, name: 'Facilities' })).toBeVisible();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'My bookings' })).toBeVisible();
    expect(within(nav).queryByRole('link', { name: 'Approvals' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Account menu for Test User' }));
    expect(await screen.findByText('test.user@example.org')).toBeVisible();
    expect(screen.getByText('Applicant')).toBeVisible();
  });

  it('shows administrators a different menu', async () => {
    mockMeRole(ROLES.facilityAdmin);
    renderApp('/facilities');

    await screen.findByRole('heading', { level: 1, name: 'Facilities' });
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Approvals' })).toBeVisible();
    expect(within(nav).getByRole('link', { name: 'Manage facilities' })).toBeVisible();
    expect(within(nav).queryByRole('link', { name: 'My bookings' })).not.toBeInTheDocument();
  });

  it('signs out through the user menu', async () => {
    mockMeRole(ROLES.applicant);
    renderApp('/facilities');

    await userEvent.click(await screen.findByRole('button', { name: /Account menu/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(clerkState.signOut).toHaveBeenCalledOnce();
  });
});

describe('routing', () => {
  it('redirects an unauthenticated visitor on a protected route to sign in', async () => {
    signOutUser();
    const { router } = renderApp('/bookings/new');

    expect(await screen.findByText('Clerk SignIn')).toBeVisible();
    expect(router.state.location.pathname).toBe('/sign-in');
  });

  it.each([
    [ROLES.applicant, '/bookings'],
    [ROLES.internal, '/bookings'],
    [ROLES.facilityAdmin, '/approvals'],
    [ROLES.systemAdmin, '/admin/users'],
  ])('sends a %s from / to %s', async (role, expected) => {
    mockMeRole(role);
    const { router } = renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).toBe(expected);
  });

  it('renders a forbidden page instead of redirecting when the role is not allowed', async () => {
    mockMeRole(ROLES.applicant);
    const { router } = renderApp('/approvals');

    expect(await screen.findByText('Forbidden')).toBeVisible();
    expect(router.state.location.pathname).toBe('/approvals');
  });

  it.each([
    [ROLES.applicant, '/bookings', 'My bookings'],
    [ROLES.applicant, '/bookings/new', 'Request a booking'],
    [ROLES.internal, '/bookings/abc', 'Booking not found'],
    [ROLES.facilityAdmin, '/approvals', 'Approvals'],
    [ROLES.facilityAdmin, '/admin/facilities', 'Manage facilities'],
    [ROLES.facilityAdmin, '/admin/resources', 'Manage resources'],
    [ROLES.systemAdmin, '/admin/users', 'Users'],
    [ROLES.systemAdmin, '/does-not-exist', 'Page not found'],
  ])('lets a %s reach %s inside the shell', async (role, path, title) => {
    mockMeRole(role);
    renderApp(path);

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });
});
