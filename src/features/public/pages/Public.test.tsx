import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import { createApiClient } from '@/shared/api';
import { ROLES } from '@/shared/auth';
import { signOutUser } from '@/test/clerk-mock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, MOBILE_WIDTH, setViewportWidth } from '@/test/viewport';

beforeEach(() => {
  signOutUser();
  setViewportWidth(DESKTOP_WIDTH);
});
afterEach(() => vi.unstubAllEnvs());

const description = () =>
  document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content;
const footer = () => screen.getByRole('contentinfo');

describe('the landing page', () => {
  it('is what a visitor who is not signed in sees at the root', async () => {
    const { router } = renderApp('/');
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Book a hall or meeting room in Midvaal',
      }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
  });

  it('says in plain words that a booking is a request, not an instant confirmation', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    expect(
      screen.getByText(/A booking here is a request, not an instant confirmation/),
    ).toBeVisible();
    expect(document.body.textContent).not.toMatch(/facilities booking management system/i);
  });

  it('explains how it works in four steps', async () => {
    renderApp('/');
    const steps = await screen.findByRole('list', { name: 'How it works' });
    expect(
      within(steps)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual([
      'Step 1: Find a venue',
      'Step 2: Check when it is free',
      'Step 3: Send a request',
      'Step 4: Wait for the answer',
    ]);
  });

  it('has one clear primary action, which is to sign in while browsing needs an account', async () => {
    renderApp('/');
    const action = await screen.findByRole('link', { name: 'Sign in to book a venue' });
    expect(action).toHaveAttribute('href', '/sign-in');
  });

  it('previews four venues, each with a sized image that loads lazily, linking onward', async () => {
    renderApp('/');
    const list = await screen.findByRole('list', { name: 'Some of our venues' });
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(4));
    const rothdene = within(list).getByRole('link', { name: 'Rothdene Hall' });
    expect(rothdene).toHaveAttribute('href', '/facilities/rothdene-hall');
    const image = list.querySelector('img') as HTMLImageElement;
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image).toHaveAttribute('width', '640');
    expect(image).toHaveAttribute('height', '400');
  });

  it('offers modern formats when the API gives them', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/public/facilities/featured`, () =>
        HttpResponse.json([
          {
            id: 'rothdene-hall',
            name: 'Rothdene Hall',
            locality: 'Meyerton',
            typeName: 'Hall',
            capacity: 200,
            shortDescription: 'A hall.',
            image: {
              src: '/i/a.jpg',
              width: 640,
              height: 400,
              alt: '',
              sources: [
                { type: 'image/avif', srcSet: '/i/a.avif 640w' },
                { type: 'image/webp', srcSet: '/i/a.webp 640w' },
              ],
            },
          },
        ]),
      ),
    );
    renderApp('/');
    const list = await screen.findByRole('list', { name: 'Some of our venues' });
    const sources = [...list.querySelectorAll('picture source')].map((s) => s.getAttribute('type'));
    expect(sources).toEqual(['image/avif', 'image/webp']);
  });

  it('still reads when the venues cannot be loaded', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/public/facilities/featured`, () =>
        HttpResponse.json({ title: 'Down' }, { status: 500 }),
      ),
    );
    renderApp('/');
    expect(await screen.findByText('We could not show the venues just now.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Sign in to book a venue' })).toBeVisible();
  });

  it('links to help, the terms, privacy and contact', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    const more = screen
      .getByRole('heading', { level: 2, name: 'Need to know more?' })
      .closest('section') as HTMLElement;
    for (const [name, href] of [
      ['How the service works', '/help'],
      ['Terms and conditions', '/terms'],
      ['Privacy notice', '/privacy'],
      ['Contact us', '/contact'],
    ]) {
      expect(within(more).getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('sends someone who is signed in to the home of their role, as before', async () => {
    const { signIn } = await import('@/test/clerk-mock');
    signIn();
    mockMeRole(ROLES.facilityAdmin);
    const { router } = renderApp('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/approvals'));
    expect(
      screen.queryByRole('heading', { name: 'Book a hall or meeting room in Midvaal' }),
    ).toBeNull();
  });

  it('works on a phone: one column, and the action is full of target', async () => {
    setViewportWidth(MOBILE_WIDTH);
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: 'Sign in to book a venue' }).className).toContain(
      'h-14',
    );
  });
});

describe('the public pages', () => {
  it.each([
    ['/terms', 'Terms and conditions of hire'],
    ['/privacy', 'Privacy notice'],
    ['/accessibility', 'Accessibility statement'],
    ['/help', 'How the service works'],
    ['/contact', 'Contact us'],
  ])('%s renders for someone who is not signed in', async (path, title) => {
    const { router } = renderApp(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeVisible();
    expect(router.state.location.pathname).toBe(path);
  });

  it('keep the way into the service in the bar: sign in and register', async () => {
    renderApp('/terms');
    await screen.findByRole('heading', { level: 1 });
    const account = screen.getByRole('navigation', { name: 'Account' });
    expect(within(account).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
    expect(within(account).getByRole('link', { name: 'Register' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
  });

  it('are readable by someone who is signed in too, with a way back into the service', async () => {
    const { signIn } = await import('@/test/clerk-mock');
    signIn();
    mockMeRole(ROLES.applicant);
    renderApp('/help');
    await screen.findByRole('heading', { level: 1, name: 'How the service works' });
    expect(await screen.findByRole('link', { name: 'Open the service' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});

describe('the terms', () => {
  it('are the currently published version, with its identifier and publication date', async () => {
    renderApp('/terms');
    await screen.findByRole('heading', { level: 1, name: 'Terms and conditions of hire' });
    expect(screen.getByText('Version 2026-1, published 1 February 2026')).toBeVisible();
    expect(screen.getByText(/A booking request is not a confirmed booking\./)).toBeVisible();
    expect(screen.getByText(/This is version 2026-1\./)).toBeVisible();
  });

  it('follow a version published afterwards', async () => {
    const sysadmin = createApiClient({
      baseUrl: TEST_API_BASE_URL,
      getToken: async () => 'user:mock-sysadmin',
    });
    await sysadmin.post('/admin/terms/terms-2026-2/publish');
    renderApp('/terms');
    expect(await screen.findByText(/^Version 2026-2, published/)).toBeVisible();
    expect(screen.getByText(/Cancellations made fewer than seven days/)).toBeVisible();
  });

  it('say so when none is published yet, rather than showing nothing', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/public/terms`, () =>
        HttpResponse.json({ title: 'No terms published', status: 404 }, { status: 404 }),
      ),
    );
    renderApp('/terms');
    expect(await screen.findByText('No terms are published yet')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Terms and conditions' })).toBeVisible();
  });
});

describe('placeholder content', () => {
  const legal = ['/terms', '/privacy', '/contact'] as const;

  it.each(legal)(
    'is marked on %s in development, so it cannot be mistaken for the real thing',
    async (path) => {
      renderApp(path);
      const notice = await screen.findByRole('note', { name: 'Content status' });
      expect(notice).toHaveTextContent('Placeholder: awaiting the municipality');
      expect(notice).toHaveTextContent(/not the municipality’s/);
    },
  );

  it('marks the help page and the accessibility statement as drafts awaiting review', async () => {
    renderApp('/help');
    expect(await screen.findByRole('note', { name: 'Content status' })).toHaveTextContent(
      'Draft: awaiting municipal review',
    );
  });

  it.each(['/privacy', '/contact', '/terms'])(
    'is withheld on %s in a production build: no placeholder wording, and no notice',
    async (path) => {
      vi.stubEnv('PROD', true);
      renderApp(path);
      expect(await screen.findByText('This page is being prepared')).toBeVisible();
      expect(screen.queryByRole('note', { name: 'Content status' })).toBeNull();
      expect(document.body.textContent).not.toMatch(
        /Awaiting the municipality|placeholder wording/i,
      );
    },
  );

  it('does not withhold the terms once they are the municipality’s own', async () => {
    const sysadmin = createApiClient({
      baseUrl: TEST_API_BASE_URL,
      getToken: async () => 'user:mock-sysadmin',
    });
    await sysadmin.post('/admin/terms', {
      body: { title: 'Terms of hire', paragraphs: ['Real terms.'] },
    });
    await sysadmin.post('/admin/terms/terms-2026-3/publish');
    vi.stubEnv('PROD', true);
    renderApp('/terms');
    expect(await screen.findByText('Real terms.')).toBeVisible();
    expect(screen.queryByRole('note', { name: 'Content status' })).toBeNull();
  });

  it('shows the delivery team’s help page in production, without a notice', async () => {
    vi.stubEnv('PROD', true);
    renderApp('/help');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'A booking is a request' }),
    ).toBeVisible();
    expect(screen.queryByRole('note', { name: 'Content status' })).toBeNull();
  });
});

describe('the content of the served pages', () => {
  it('structures the privacy notice by what POPIA requires and names the Information Officer', async () => {
    renderApp('/privacy');
    await screen.findByRole('heading', { level: 1, name: 'Privacy notice' });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      'What personal information we collect',
      'Why we collect it',
      'The lawful basis',
      'Who we share it with',
      'How long we keep it',
      'Your rights and how to use them',
      'Our Information Officer',
    ]);
    expect(
      screen.getByText(/supply the name and contact details of its Information Officer/),
    ).toBeVisible();
  });

  it('leaves the accessibility conformance claim to the audit', async () => {
    renderApp('/accessibility');
    await screen.findByRole('heading', { level: 1, name: 'Accessibility statement' });
    expect(screen.getByText(/WCAG\) 2\.2 at level AA/)).toBeVisible();
    expect(screen.getByText(/conformance claim is not made yet/)).toBeVisible();
    expect(screen.getByText(/not yet been tested with screen readers/i)).toBeVisible();
  });

  it('points a booking question at the reference and the department of the venue', async () => {
    renderApp('/contact');
    await screen.findByRole('heading', { level: 1, name: 'Contact us' });
    expect(screen.getByText(/Quote the booking reference/)).toBeVisible();
    expect(screen.getByText(/names the municipal department that manages it/)).toBeVisible();
  });

  it('invents no telephone number', async () => {
    renderApp('/contact');
    await screen.findByRole('heading', { level: 1, name: 'Contact us' });
    expect(document.body.textContent).not.toMatch(/\+?\d[\d\s]{8,}\d/);
  });
});

describe('document title and description', () => {
  it('change as the visitor moves between pages', async () => {
    const { router } = renderApp('/terms');
    await screen.findByRole('heading', { level: 1, name: 'Terms and conditions of hire' });
    expect(document.title).toBe('Terms and conditions · Facilities Booking');
    expect(description()).toMatch(/terms and conditions for hiring/);

    await router.navigate('/privacy');
    await screen.findByRole('heading', { level: 1, name: 'Privacy notice' });
    expect(document.title).toBe('Privacy notice · Facilities Booking');
    expect(description()).toMatch(/how the municipality collects/i);
  });

  it.each([
    ['/', 'Book a hall or meeting room · Facilities Booking'],
    ['/terms', 'Terms and conditions · Facilities Booking'],
    ['/privacy', 'Privacy notice · Facilities Booking'],
    ['/accessibility', 'Accessibility statement · Facilities Booking'],
    ['/help', 'How the service works · Facilities Booking'],
    ['/contact', 'Contact us · Facilities Booking'],
    ['/sign-in', 'Sign in · Facilities Booking'],
    ['/sign-up', 'Register · Facilities Booking'],
  ])('gives %s a title following the one pattern', async (path, title) => {
    renderApp(path);
    await waitFor(() => expect(document.title).toBe(title));
    expect(description()?.length).toBeGreaterThan(40);
  });

  it('gives every public page its own description', async () => {
    const seen = new Set<string>();
    for (const path of ['/', '/terms', '/privacy', '/accessibility', '/help', '/contact']) {
      const { unmount } = renderApp(path);
      await waitFor(() => expect(description()).toBeTruthy());
      await waitFor(() => expect(seen.has(description() ?? '')).toBe(false));
      seen.add(description() ?? '');
      unmount();
    }
    expect(seen.size).toBe(6);
  });
});

describe('the footer', () => {
  const links = [
    ['Terms and conditions', '/terms'],
    ['Privacy notice', '/privacy'],
    ['Accessibility', '/accessibility'],
    ['Help', '/help'],
    ['Contact', '/contact'],
  ];

  it.each([
    '/',
    '/terms',
    '/privacy',
    '/accessibility',
    '/help',
    '/contact',
    '/sign-in',
    '/sign-up',
  ])('is on %s for someone who is not signed in', async (path) => {
    renderApp(path);
    await waitFor(() => expect(screen.getByRole('contentinfo')).toBeVisible());
    for (const [name, href] of links) {
      expect(within(footer()).getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it.each(['/approvals', '/bookings', '/facilities', '/account', '/nowhere'])(
    'is on %s inside the application',
    async (path) => {
      const { signIn } = await import('@/test/clerk-mock');
      signIn();
      mockMeRole(ROLES.systemAdmin);
      renderApp(path);
      await waitFor(() => expect(screen.getByRole('contentinfo')).toBeVisible());
      for (const [name, href] of links) {
        expect(within(footer()).getByRole('link', { name })).toHaveAttribute('href', href);
      }
    },
  );

  it('is not a second navigation: those links, the municipality and the year, and nothing else', async () => {
    renderApp('/terms');
    await waitFor(() => expect(screen.getByRole('contentinfo')).toBeVisible());
    expect(within(footer()).getAllByRole('link')).toHaveLength(5);
    expect(footer()).toHaveTextContent('© 2026 Midvaal Local Municipality');
  });

  it('opens a page from inside the app and brings the visitor back', async () => {
    const { signIn } = await import('@/test/clerk-mock');
    signIn();
    mockMeRole(ROLES.applicant);
    const { router } = renderApp('/bookings');
    await waitFor(() => expect(screen.getByRole('contentinfo')).toBeVisible());
    await userEvent.click(within(footer()).getByRole('link', { name: 'Privacy notice' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy notice' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/privacy');
  });
});

describe('printing', () => {
  it('leaves the bar, the footer and the print button off the page, and puts the municipality above the terms', async () => {
    renderApp('/terms');
    await screen.findByRole('heading', { level: 1, name: 'Terms and conditions of hire' });
    expect(document.querySelector('body > div > div > header')?.className).toContain(
      'print:hidden',
    );
    expect(footer().className).toContain('print:hidden');
    expect(
      screen.getByRole('button', { name: 'Print these terms' }).parentElement?.className,
    ).toContain('print:hidden');
    const masthead = screen.getByText('Midvaal Local Municipality · Facilities Booking');
    expect(masthead.className).toContain('hidden');
    expect(masthead.className).toContain('print:block');
    // The words themselves are not hidden when printing.
    expect(
      screen
        .getByText(/A booking request is not a confirmed booking\./)
        .closest('[class*="print:hidden"]'),
    ).toBeNull();
  });

  it('prints the notice nowhere: a placeholder notice is not part of the document', async () => {
    renderApp('/privacy');
    const notice = await screen.findByRole('note', { name: 'Content status' });
    expect(notice.className).toContain('print:hidden');
  });

  it('prints from the button', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderApp('/terms');
    await userEvent.click(await screen.findByRole('button', { name: 'Print these terms' }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });
});
