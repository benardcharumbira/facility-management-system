import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import { createApiClient, type MyProfile } from '@/shared/api';
import { ROLES } from '@/shared/auth';
import { clerkState, openUserProfile } from '@/test/clerk-mock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, setViewportWidth } from '@/test/viewport';

beforeEach(() => {
  mockMeRole(ROLES.applicant);
  setViewportWidth(DESKTOP_WIDTH);
  openUserProfile.mockReset();
});

const api = (token: string | null = null) =>
  createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => token });
const telephone = () => screen.findByLabelText('Telephone number') as Promise<HTMLInputElement>;
const open = async () => {
  renderApp('/account');
  await screen.findByRole('heading', { level: 1, name: 'Your account' });
};

describe('the Clerk details', () => {
  it('shows the name, email address, verification and role, as text', async () => {
    await open();
    const details = screen
      .getByRole('heading', { level: 2, name: 'Your sign-in details' })
      .closest('section') as HTMLElement;
    expect(within(details).getByText('Test User')).toBeVisible();
    expect(within(details).getByText('test.user@example.org')).toBeVisible();
    expect(within(details).getByText('Verified')).toBeVisible();
    expect(within(details).getByText('Applicant')).toBeVisible();
    // Nothing in this section can be typed into.
    expect(within(details).queryByRole('textbox')).toBeNull();
  });

  it('says when the email address has not been verified', async () => {
    clerkState.user.primaryEmailAddress.verification.status = 'unverified';
    await open();
    expect(await screen.findByText('Not verified')).toBeVisible();
    clerkState.user.primaryEmailAddress.verification.status = 'verified';
  });

  it('routes into Clerk’s own screens rather than reimplementing them', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Manage your sign-in details' }));
    expect(openUserProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/looked after by Clerk/)).toBeVisible();
  });

  it('has no password, email or credential control anywhere', async () => {
    await open();
    await screen.findByLabelText('Telephone number');
    expect(document.querySelector('input[type="password"], input[type="email"]')).toBeNull();
    for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('textbox')]) {
      expect(control).not.toHaveAccessibleName(/password|reset|change (your )?e-?mail/i);
    }
    // Only the telephone number can be typed into.
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });
});

describe('the contact telephone number', () => {
  it('starts empty for someone who has not given one, and says what it is for', async () => {
    await open();
    expect(await telephone()).toHaveValue('');
    expect(screen.getByText(/only to phone you about a booking/)).toBeVisible();
    expect(screen.getByText(/It is optional/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save number' })).toBeDisabled();
  });

  it('shows one that was given', async () => {
    clerkState.getToken.mockImplementation(async () => 'user:applicant-priya');
    await open();
    expect(await telephone()).toHaveValue('082 555 0142');
  });

  it('is the right kind of field for a phone: telephone keyboard, autocomplete', async () => {
    await open();
    const input = await telephone();
    expect(input).toHaveAttribute('type', 'tel');
    expect(input).toHaveAttribute('autocomplete', 'tel');
  });

  it('saves a number, and it is kept', async () => {
    await open();
    await userEvent.type(await telephone(), '011 555 0100');
    await userEvent.click(screen.getByRole('button', { name: 'Save number' }));
    expect(await screen.findByText('Telephone number saved.')).toBeVisible();
    expect((await api('test-token').get<MyProfile>('/me/profile')).telephone).toBe('011 555 0100');
    expect(screen.getByRole('button', { name: 'Save number' })).toBeDisabled();
  });

  it('removes it when it is emptied', async () => {
    clerkState.getToken.mockImplementation(async () => 'user:applicant-priya');
    await open();
    await userEvent.clear(await telephone());
    await userEvent.click(screen.getByRole('button', { name: 'Save number' }));
    expect(await screen.findByText('Telephone number removed.')).toBeVisible();
    expect((await api('user:applicant-priya').get<MyProfile>('/me/profile')).telephone).toBeNull();
  });

  it('puts a refusal on the field itself', async () => {
    await open();
    await userEvent.type(await telephone(), 'call me');
    await userEvent.click(screen.getByRole('button', { name: 'Save number' }));
    const input = await telephone();
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(input).toHaveAccessibleDescription(/digits, spaces, \+ and brackets/);
    expect(input).toHaveValue('call me');
  });

  it('keeps what was typed, and says so, when the save fails', async () => {
    await open();
    await userEvent.type(await telephone(), '000 000 0000');
    await userEvent.click(screen.getByRole('button', { name: 'Save number' }));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('We could not save your number')).toBeVisible();
    expect(within(alert).getByText(/Your number has not been changed/)).toBeVisible();
    expect(await telephone()).toHaveValue('000 000 0000');
    expect(screen.getByRole('button', { name: 'Save number' })).toBeEnabled();
  });

  it('can be discarded', async () => {
    await open();
    await userEvent.type(await telephone(), '011');
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(await telephone()).toHaveValue('');
  });

  it('says when the details cannot be loaded', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/me/profile`, () =>
        HttpResponse.json({ title: 'Down' }, { status: 500 }),
      ),
    );
    await open();
    expect(await screen.findByText('We could not load your details')).toBeVisible();
  });
});

describe('the rest', () => {
  it('links an applicant to their bookings', async () => {
    await open();
    expect(await screen.findByRole('link', { name: 'Go to my bookings' })).toHaveAttribute(
      'href',
      '/bookings',
    );
  });

  it('does not offer bookings to a role that makes none', async () => {
    mockMeRole(ROLES.systemAdmin);
    await open();
    expect(screen.queryByRole('link', { name: 'Go to my bookings' })).toBeNull();
    expect(screen.getByText('System administrator')).toBeVisible();
  });

  it('signs out', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(clerkState.signOut).toHaveBeenCalledTimes(1);
  });

  it('is reached from the account menu in the bar', async () => {
    const { router } = renderApp('/bookings');
    await userEvent.click(await screen.findByRole('button', { name: /Account menu for/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Your account' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/account');
  });

  it('is not offered notification preferences, since all email is transactional', async () => {
    await open();
    expect(document.body.textContent).not.toMatch(/notification|newsletter|subscribe|marketing/i);
  });

  it('is for signed in users only', async () => {
    const { signOutUser } = await import('@/test/clerk-mock');
    signOutUser();
    const { router } = renderApp('/account');
    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'));
  });

  it('has the page title', async () => {
    await open();
    await waitFor(() => expect(document.title).toBe('Your account · Facilities Booking'));
  });
});
