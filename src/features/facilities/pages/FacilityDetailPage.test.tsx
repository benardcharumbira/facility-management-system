import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { REAL_FACILITIES } from '@/mocks/data/facilities.real';
import { deriveDetail } from '@/mocks/data/facilityDetail';
import { createFacilityHandlers } from '@/mocks/facilities';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import { ROLES } from '@/shared/auth';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, setViewportWidth } from '@/test/viewport';

const DETAIL_API = `${TEST_API_BASE_URL}/facilities/:id`;

beforeEach(() => {
  mockMeRole(ROLES.applicant);
  setViewportWidth(DESKTOP_WIDTH);
});

const useVolume = () =>
  server.use(...createFacilityHandlers(TEST_API_BASE_URL, { delayMs: 0, dataset: 'volume' }));
const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const section = (name: string) => {
  const found = screen.getByRole('heading', { level: 2, name }).closest('section');
  if (!found) throw new Error(`No section ${name}`);
  return found;
};

describe('every Midvaal venue', () => {
  it.each(REAL_FACILITIES.map((f) => [f.name, f.id]))(
    'renders a complete page for %s',
    async (name, id) => {
      renderApp(`/facilities/${id}`);
      await heading(name as string);

      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('region', { name: 'Key facts' })).toBeVisible();
      expect(section('About this venue')).toBeVisible();
      expect(section('Resources')).toBeVisible();
      expect(section('Availability')).toBeVisible();
      expect(section('Opening hours')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Request booking' })).toHaveAttribute(
        'href',
        `/bookings/new?facilityId=${id}`,
      );
    },
  );
});

describe('a standalone venue', () => {
  it('shows facts, resources, hours and a reserved availability region, with no relationships', async () => {
    renderApp('/facilities/rothdene-hall');
    await heading('Rothdene Hall');

    expect(screen.getByText('Hall · Rothdene')).toBeVisible();
    expect(screen.getByText('Available to book', { selector: 'span' })).toBeVisible();

    const facts = screen.getByRole('region', { name: 'Key facts' });
    expect(within(facts).getByText('Up to 250 people')).toBeVisible();
    const arrangements = within(facts).getByRole('list', {
      name: 'Capacity by seating arrangement',
    });
    expect(within(arrangements).getByText('Cinema')).toBeVisible();
    expect(within(arrangements).getByText('U-shape')).toBeVisible();
    expect(within(facts).getByText('Community Services')).toBeVisible();
    expect(within(facts).getByText('Kitchen')).toBeVisible();

    expect(
      within(section('Resources')).getByRole('list', { name: 'Venue resources' }),
    ).toBeVisible();
    expect(screen.getByText('Before you request a booking')).toBeVisible();

    // No relationship content for a standalone venue.
    expect(screen.queryByText(/Part of/)).not.toBeInTheDocument();
    expect(screen.queryByText(/separately bookable/)).not.toBeInTheDocument();

    // The availability calendar fills the section reserved for it.
    const availability = section('Availability');
    expect(await within(availability).findByRole('grid', { name: 'November 2026' })).toBeVisible();
    expect(within(section('Opening hours')).getByText('Monday to Sunday')).toBeVisible();

    // No photographs for these buildings: the placeholder stands in.
    expect(screen.queryByRole('img', { name: /Enlarge/ })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Photos of Rothdene Hall' })).toBeVisible();
  });

  it('shows the sample data banner', async () => {
    renderApp('/facilities/rothdene-hall');
    expect(await screen.findByText(/^Sample data\./)).toBeVisible();
  });
});

describe('a parent venue', () => {
  it('lists and links its child spaces and explains what booking the whole venue means', async () => {
    renderApp('/facilities/city-hall');
    await heading('City Hall');

    expect(screen.getByText('Comprises 3 separately bookable spaces')).toBeVisible();
    const facts = screen.getByRole('region', { name: 'Key facts' });
    expect(within(facts).getByText('3 separately bookable spaces')).toBeVisible();

    const spaces = section('Spaces within City Hall');
    expect(
      within(spaces).getByText(/Booking the whole of City Hall includes all of them/),
    ).toBeVisible();
    const list = within(spaces).getByRole('list', { name: 'Spaces within City Hall' });
    const links = within(list).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href')).sort()).toEqual([
      '/facilities/city-hall-committee-room',
      '/facilities/loch-wing',
      '/facilities/mitchell-wing',
    ]);
    expect(within(list).getByRole('link', { name: /Loch Wing/ })).toHaveTextContent(
      'Hall wing · Capacity 150',
    );
    expect(screen.queryByRole('heading', { name: /^Part of/ })).not.toBeInTheDocument();
  });
});

describe('a child venue', () => {
  it('shows its parent, its siblings and the effect of a whole venue booking', async () => {
    renderApp('/facilities/mitchell-wing');
    await heading('Mitchell Wing');

    // Header statement and breadcrumb both place it inside City Hall.
    const header = screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement;
    const statement = within(header)
      .getByText(/^Part of/)
      .closest('p') as HTMLElement;
    expect(within(statement).getByRole('link', { name: 'City Hall' })).toHaveAttribute(
      'href',
      '/facilities/city-hall',
    );
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(
      within(crumbs)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Facilities', 'City Hall', 'Mitchell Wing']);

    const context = section('Part of City Hall');
    expect(
      within(context).getByText(/one of 3 separately bookable spaces in City Hall/),
    ).toBeVisible();
    expect(
      within(context).getByText(
        /A booking of the whole of City Hall would make Mitchell Wing unavailable/,
      ),
    ).toBeVisible();
    const whole = within(context).getByRole('list', { name: 'The whole venue' });
    expect(within(whole).getByRole('link', { name: /City Hall/ })).toHaveAttribute(
      'href',
      '/facilities/city-hall',
    );
    const siblings = within(context).getByRole('list', { name: 'Other spaces in City Hall' });
    expect(
      within(siblings)
        .getAllByRole('link')
        .map((l) => l.getAttribute('href'))
        .sort(),
    ).toEqual(['/facilities/city-hall-committee-room', '/facilities/loch-wing']);
    expect(within(siblings).queryByRole('link', { name: /Mitchell Wing/ })).not.toBeInTheDocument();
  });

  it('says so when a child has no siblings', async () => {
    renderApp('/facilities/vaal-marina-board-room');
    await heading('Vaal Marina Board Room');
    const context = section('Part of Vaal Marina Hall');
    expect(
      within(context).getByText('There are no other spaces in Vaal Marina Hall.'),
    ).toBeVisible();
  });
});

describe('navigation', () => {
  it('returns from a detail page to the exact browse result set', async () => {
    useVolume();
    const original = '?sort=-name&page=2';
    const { router } = renderApp(`/facilities${original}`);
    const grid = await screen.findByRole('list', { name: 'Facilities' });
    await userEvent.click(within(grid).getAllByRole('link')[0] as HTMLElement);
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).toMatch(/^\/facilities\/volume-/);

    await userEvent.click(screen.getByRole('link', { name: 'Back to results' }));
    await waitFor(() => expect(router.state.location.search).toBe(original));
  });

  it('keeps the origin through related venues, and via the breadcrumb', async () => {
    const { router } = renderApp('/facilities?q=wing&view=list');
    await userEvent.click(await screen.findByRole('link', { name: 'Mitchell Wing' }));
    await heading('Mitchell Wing');
    const header = screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement;
    const statement = within(header)
      .getByText(/^Part of/)
      .closest('p') as HTMLElement;
    await userEvent.click(within(statement).getByRole('link', { name: 'City Hall' }));
    await heading('City Hall');
    expect(router.state.location.pathname).toBe('/facilities/city-hall');

    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', {
        name: 'Facilities',
      }),
    );
    await waitFor(() => expect(router.state.location.search).toBe('?q=wing&view=list'));
  });

  it('goes to the unfiltered list when the page was opened directly', async () => {
    const { router } = renderApp('/facilities/rothdene-hall');
    await userEvent.click(await screen.findByRole('link', { name: 'All facilities' }));
    expect(router.state.location.pathname + router.state.location.search).toBe('/facilities');
  });
});

describe('not found, loading and error', () => {
  it('renders a not found state rather than an error for an unknown identifier', async () => {
    renderApp('/facilities/nope');
    expect(await screen.findByText('We could not find that facility')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to facilities' })).toHaveAttribute(
      'href',
      '/facilities',
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows a skeleton with the page layout while loading', async () => {
    server.use(
      http.get(DETAIL_API, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json(deriveDetail(REAL_FACILITIES[0]!, REAL_FACILITIES));
      }),
    );
    renderApp('/facilities/city-hall');
    const skeleton = '[aria-busy="true"][aria-label="Loading"]';
    await waitFor(() => expect(document.querySelector(skeleton)).not.toBeNull());
    await heading('City Hall');
    expect(document.querySelector(skeleton)).toBeNull();
  });

  it('shows the problem message with retry on failure', async () => {
    let fail = true;
    server.use(
      http.get(DETAIL_API, () =>
        fail
          ? HttpResponse.json(
              { title: 'Mock failure', status: 500, detail: 'Service unavailable.' },
              { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
            )
          : HttpResponse.json(deriveDetail(REAL_FACILITIES[5]!, REAL_FACILITIES)),
      ),
    );
    renderApp('/facilities/x');
    expect(await screen.findByText('Service unavailable.')).toBeVisible();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await heading('Rothdene Hall');
  });
});

describe('primary action', () => {
  it('carries the facility id into the booking route', async () => {
    const { router } = renderApp('/facilities/loch-wing');
    await userEvent.click(await screen.findByRole('link', { name: 'Request booking' }));
    expect(router.state.location.pathname).toBe('/bookings/new');
    expect(router.state.location.search).toBe('?facilityId=loch-wing');
  });

  it('is disabled, with an explanation, for an unavailable facility', async () => {
    useVolume();
    renderApp('/facilities/volume-011');
    await heading('Volume Test Venue 011');

    const action = screen.getByRole('button', { name: 'Request booking' });
    expect(action).toBeDisabled();
    expect(action).toHaveAccessibleDescription(
      /currently unavailable, so booking requests cannot be made/,
    );
    expect(screen.queryByRole('link', { name: 'Request booking' })).not.toBeInTheDocument();
    expect(screen.getByText('Unavailable', { selector: 'span' })).toBeVisible();
    expect(screen.getByText(/is currently unavailable for booking\./)).toBeVisible();
  });

  it('is not offered to roles that cannot make bookings', async () => {
    mockMeRole(ROLES.facilityAdmin);
    renderApp('/facilities/rothdene-hall');
    await heading('Rothdene Hall');
    expect(screen.queryByRole('link', { name: 'Request booking' })).not.toBeInTheDocument();
  });
});

describe('resources', () => {
  it('shows venue resources openly and keeps the kitchen inventory collapsed until opened', async () => {
    renderApp('/facilities/rothdene-hall');
    await heading('Rothdene Hall');

    const resources = section('Resources');
    expect(within(resources).getByRole('list', { name: 'Venue resources' })).toBeVisible();
    expect(within(resources).getByText('Chairs')).toBeVisible();

    const toggle = within(resources).getByRole('button', { name: 'Kitchen equipment, 14 items' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Hot water urns')).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(resources).getByRole('list', { name: 'Kitchen equipment' })).toBeVisible();
    expect(within(resources).getByText('Hot water urns')).toBeVisible();
  });

  it('omits the kitchen disclosure when a venue has no kitchen', async () => {
    renderApp('/facilities/vaal-marina-board-room');
    await heading('Vaal Marina Board Room');
    expect(screen.queryByRole('button', { name: /Kitchen equipment/ })).not.toBeInTheDocument();
  });
});

describe('gallery', () => {
  const withPhotos = () => {
    const base = deriveDetail(REAL_FACILITIES[5]!, REAL_FACILITIES);
    server.use(
      http.get(DETAIL_API, () =>
        HttpResponse.json({
          ...base,
          images: [
            { url: 'https://images.invalid/one.jpg', caption: 'The main hall' },
            { url: 'https://images.invalid/two.jpg', caption: null },
          ],
        }),
      ),
    );
  };

  it('shows a primary image with thumbnails that choose it', async () => {
    withPhotos();
    renderApp('/facilities/rothdene-hall');
    await heading('Rothdene Hall');

    expect(screen.getByRole('button', { name: 'Enlarge photo: The main hall' })).toBeVisible();
    expect(screen.getByText('The main hall', { selector: 'p' })).toBeVisible();
    const second = screen.getByRole('button', { name: 'Show photo 2 of 2' });
    expect(second).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Enlarge photo: Rothdene Hall, view 2' }),
    ).toBeVisible();
  });

  it('opens an expanded view, closes on Escape and returns focus to the opener', async () => {
    withPhotos();
    renderApp('/facilities/rothdene-hall');
    await heading('Rothdene Hall');

    const opener = screen.getByRole('button', { name: 'Enlarge photo: The main hall' });
    await userEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: /photo 1 of 2/ });
    await userEvent.keyboard('{ArrowRight}');
    expect(await within(dialog).findByRole('img', { name: 'Rothdene Hall, view 2' })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Enlarge photo/ })).toHaveFocus(),
    );
  });
});
