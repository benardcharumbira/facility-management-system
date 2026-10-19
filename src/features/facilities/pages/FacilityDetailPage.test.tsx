import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import { ROLES } from '@/shared/auth';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, setViewportWidth } from '@/test/viewport';

beforeEach(() => {
  mockMeRole(ROLES.applicant);
  setViewportWidth(DESKTOP_WIDTH);
});

describe('FacilityDetailPage', () => {
  it('shows the facility, its key facts, amenities and gallery', async () => {
    renderApp('/facilities/fac-hc-hall');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hillcrest Community Hall' }),
    ).toBeVisible();

    const facts = screen.getByRole('complementary', { name: 'Key facts' });
    expect(within(facts).getByText('Community hall')).toBeVisible();
    expect(within(facts).getByText('200 people')).toBeVisible();
    expect(within(facts).getByText('Available to book')).toBeVisible();

    const amenities = screen.getByRole('heading', { name: 'Amenities' }).closest('section');
    expect(within(amenities as HTMLElement).getByText('Kitchen')).toBeVisible();
    expect(await screen.findByAltText('Hillcrest Community Hall, photo 1')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Show photo 2 of 3' }));
    expect(screen.getByRole('button', { name: 'Show photo 2 of 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('links a parent to its child spaces and back', async () => {
    renderApp('/facilities/fac-cc-main');
    const spaces = await screen.findByRole('list', { name: 'Spaces within this facility' });
    const east = within(spaces).getByRole('link', { name: /Civic Centre East Wing/ });
    await userEvent.click(east);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Civic Centre East Wing' }),
    ).toBeVisible();
    const facts = screen.getByRole('complementary', { name: 'Key facts' });
    expect(within(facts).getByRole('link', { name: 'Civic Centre' })).toHaveAttribute(
      'href',
      '/facilities/fac-cc-main',
    );
  });

  it('says so in text when the facility is unavailable', async () => {
    renderApp('/facilities/fac-ot-hall');
    expect(
      await screen.findByText('This facility is currently unavailable for booking.'),
    ).toBeVisible();
    expect(screen.getByText('Currently unavailable')).toBeVisible();
  });

  it('returns to the same list results through the breadcrumb', async () => {
    const { router } = renderApp('/facilities?q=aquatic&view=list');
    await userEvent.click(await screen.findByRole('link', { name: 'Central Aquatic Centre' }));
    await screen.findByRole('heading', { level: 1, name: 'Central Aquatic Centre' });

    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', {
        name: 'Facilities',
      }),
    );
    await waitFor(() => expect(router.state.location.search).toBe('?q=aquatic&view=list'));
  });

  it('shows a distinct not found state', async () => {
    renderApp('/facilities/nope');
    expect(await screen.findByText('We could not find that facility')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to facilities' })).toHaveAttribute(
      'href',
      '/facilities',
    );
  });

  it('shows the problem with retry on failure', async () => {
    let fail = true;
    server.use(
      http.get(`${TEST_API_BASE_URL}/facilities/:id`, ({ params }) =>
        fail
          ? HttpResponse.json(
              { title: 'Mock failure', status: 500, detail: 'Service unavailable.' },
              { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
            )
          : HttpResponse.json({
              id: params.id,
              name: 'Recovered Hall',
              code: 'R',
              type: { id: 'community-hall', name: 'Community hall' },
              parentFacility: null,
              capacity: null,
              locality: 'Central',
              shortDescription: '',
              primaryImageUrl: null,
              amenities: [],
              status: 'active',
              description: 'Back.',
              images: [],
              address: null,
              childFacilities: [],
            }),
      ),
    );
    renderApp('/facilities/x');
    expect(await screen.findByText('Service unavailable.')).toBeVisible();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Recovered Hall' })).toBeVisible();
  });
});
