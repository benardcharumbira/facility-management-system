import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { REAL_FACILITIES } from '@/mocks/data/facilities.real';
import { createFacilityHandlers } from '@/mocks/facilities';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import { ROLES } from '@/shared/auth';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, setViewportWidth } from '@/test/viewport';

beforeEach(() => {
  mockMeRole(ROLES.applicant);
  setViewportWidth(DESKTOP_WIDTH);
});

describe('FacilityDetailPage', () => {
  it.each(REAL_FACILITIES.map((f) => [f.name, f.id]))('resolves %s', async (name, id) => {
    renderApp(`/facilities/${id}`);
    expect(await screen.findByRole('heading', { level: 1, name })).toBeVisible();
  });

  it('shows the venue, key facts and amenities, with no photographs or invented address', async () => {
    renderApp('/facilities/rothdene-hall');
    await screen.findByRole('heading', { level: 1, name: 'Rothdene Hall' });

    const facts = screen.getByRole('complementary', { name: 'Key facts' });
    expect(within(facts).getByText('Hall')).toBeVisible();
    expect(within(facts).getByText('Rothdene')).toBeVisible();
    expect(within(facts).getByText('250 people')).toBeVisible();
    expect(within(facts).getByText('Available to book')).toBeVisible();
    expect(within(facts).queryByText('Address')).not.toBeInTheDocument();

    const amenities = screen.getByRole('heading', { name: 'Amenities' }).closest('section');
    expect(within(amenities as HTMLElement).getByText('Kitchen')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Photos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows the sample data banner', async () => {
    renderApp('/facilities/city-hall');
    expect(await screen.findByText(/^Sample data\./)).toBeVisible();
  });

  it('links City Hall to its inferred child spaces and back', async () => {
    renderApp('/facilities/city-hall');
    const spaces = await screen.findByRole('list', { name: 'Spaces within this facility' });
    expect(
      within(spaces)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual([
      expect.stringContaining('Mitchell Wing'),
      expect.stringContaining('City Hall Committee Room'),
      expect.stringContaining('Loch Wing'),
    ]);
    await userEvent.click(within(spaces).getByRole('link', { name: /Mitchell Wing/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Mitchell Wing' })).toBeVisible();
    const facts = screen.getByRole('complementary', { name: 'Key facts' });
    expect(within(facts).getByRole('link', { name: 'City Hall' })).toHaveAttribute(
      'href',
      '/facilities/city-hall',
    );
  });

  it('says so in text when the facility is unavailable', async () => {
    server.use(...createFacilityHandlers(TEST_API_BASE_URL, { delayMs: 0, dataset: 'volume' }));
    renderApp('/facilities/volume-011');
    expect(
      await screen.findByText('This facility is currently unavailable for booking.'),
    ).toBeVisible();
    expect(screen.getByText('Currently unavailable')).toBeVisible();
  });

  it('returns to the same list results through the breadcrumb', async () => {
    const { router } = renderApp('/facilities?q=rothdene&view=list');
    await userEvent.click(await screen.findByRole('link', { name: 'Rothdene Hall' }));
    await screen.findByRole('heading', { level: 1, name: 'Rothdene Hall' });

    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', {
        name: 'Facilities',
      }),
    );
    await waitFor(() => expect(router.state.location.search).toBe('?q=rothdene&view=list'));
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
              type: { id: 'hall', name: 'Hall' },
              parentFacility: null,
              capacity: null,
              locality: 'Meyerton',
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
