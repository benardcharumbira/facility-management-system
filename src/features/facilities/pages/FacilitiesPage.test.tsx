import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@/app/env';
import { REAL_FACILITIES } from '@/mocks/data/facilities.real';
import { createFacilityHandlers } from '@/mocks/facilities';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import { ROLES } from '@/shared/auth';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, MOBILE_WIDTH, setViewportWidth } from '@/test/viewport';

const API = `${TEST_API_BASE_URL}/facilities`;
const emptyEnvelope = { items: [], page: 1, pageSize: 24, totalItems: 0, totalPages: 0 };

beforeEach(() => {
  mockMeRole(ROLES.applicant);
  setViewportWidth(DESKTOP_WIDTH);
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

const count = () => screen.getByRole('status');
const results = () => screen.getByRole('region', { name: 'Facility results' });
const waitForCount = (text: RegExp) => waitFor(() => expect(count()).toHaveTextContent(text));
const useVolume = () =>
  server.use(...createFacilityHandlers(TEST_API_BASE_URL, { delayMs: 0, dataset: 'volume' }));

describe('FacilitiesPage with the Midvaal venues', () => {
  it('lists exactly the twelve confirmed venues, spelled as given', async () => {
    renderApp('/facilities');
    await waitForCount(/^12 facilities$/);

    const list = within(results()).getByRole('list', { name: 'Facilities' });
    const names = within(list)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect([...names].sort()).toEqual(REAL_FACILITIES.map((f) => f.name).sort());
    expect(names).toContain('Vaal Marina Board Room');
    expect(names).toContain('Bantu Bonke Hall');
  });

  it('makes a parent venue and its children distinguishable', async () => {
    renderApp('/facilities');
    await waitForCount(/^12 facilities$/);
    const list = within(results()).getByRole('list', { name: 'Facilities' });
    const link = (name: string) => within(list).getByRole('link', { name });

    for (const child of ['Mitchell Wing', 'Loch Wing', 'City Hall Committee Room']) {
      expect(link(child)).toHaveAccessibleDescription(/Part of City Hall/);
      expect(
        within(link(child).closest('article') as HTMLElement).getByText('Part of City Hall'),
      ).toBeVisible();
    }
    expect(link('Vaal Marina Board Room')).toHaveAccessibleDescription(/Part of Vaal Marina Hall/);
    // The parents and standalone venues carry no such line.
    for (const name of ['City Hall', 'Vaal Marina Hall', 'Council Chambers', 'Activity Room']) {
      expect(link(name)).not.toHaveAccessibleDescription(/Part of/);
    }
    expect(link('Mitchell Wing')).toHaveAttribute('href', '/facilities/mitchell-wing');
  });

  it('shows the provisional data banner in development, and hides it when switched off', async () => {
    const view = renderApp('/facilities');
    expect(await screen.findByText(/^Sample data\./)).toBeVisible();
    view.unmount();

    vi.stubEnv('VITE_SHOW_SAMPLE_DATA_BANNER', 'false');
    resetEnvCache();
    renderApp('/facilities');
    await waitForCount(/^12 facilities$/);
    expect(screen.queryByText(/^Sample data\./)).not.toBeInTheDocument();
  });

  it('shows no banner when no displayed record has provisional fields', async () => {
    const real = REAL_FACILITIES.map((f) => ({ ...f, provisionalFields: undefined }));
    server.use(
      http.get(API, () =>
        HttpResponse.json({ ...emptyEnvelope, items: real, totalItems: 12, totalPages: 1 }),
      ),
    );
    renderApp('/facilities');
    await waitForCount(/^12 facilities$/);
    expect(screen.queryByText(/^Sample data\./)).not.toBeInTheDocument();
  });

  it('debounces search so only the settled text is requested', async () => {
    const queries: string[] = [];
    server.use(
      http.get(API, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('q') ?? '');
        return HttpResponse.json(emptyEnvelope);
      }),
    );
    const { router } = renderApp('/facilities');
    await waitFor(() => expect(queries).toHaveLength(1));

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search facilities' }), 'marina');
    await waitFor(() => expect(router.state.location.search).toBe('?q=marina'));
    await waitFor(() => expect(queries).toEqual(['', 'marina']));
  });

  it('search updates results', async () => {
    const { router } = renderApp('/facilities');
    await waitForCount(/^12 facilities$/);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search facilities' }), 'marina');
    await waitForCount(/^2 facilities$/);
    expect(router.state.location.search).toBe('?q=marina');
    expect(within(results()).getByRole('link', { name: 'Vaal Marina Hall' })).toBeVisible();
  });

  it('filters update the URL and results, and removing the chip reverses both', async () => {
    const { router } = renderApp('/facilities');
    await waitForCount(/^12 facilities$/);

    await userEvent.click(screen.getByRole('checkbox', { name: /^Hall\s*\d+$/ }));
    await waitForCount(/^5 facilities$/);
    expect(router.state.location.search).toBe('?type=hall');

    await userEvent.click(screen.getByRole('checkbox', { name: /^Lakeside/ }));
    await waitForCount(/^1 facility$/);
    expect(router.state.location.search).toBe('?type=hall&locality=lakeside');
    expect(within(results()).getByRole('link', { name: 'Lakeside Hall' })).toBeVisible();

    const chips = screen.getByRole('list', { name: 'Active filters' });
    await userEvent.click(within(chips).getByRole('button', { name: 'Remove filter: Hall' }));
    expect(router.state.location.search).toBe('?locality=lakeside');
    await userEvent.click(within(chips).getByRole('button', { name: 'Remove filter: Lakeside' }));
    expect(router.state.location.search).toBe('');
    await waitForCount(/^12 facilities$/);
    expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
  });

  it('filters by amenity (all must be present)', async () => {
    renderApp('/facilities');
    await waitForCount(/^12 facilities$/);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Podium' }));
    await waitForCount(/^4 facilities$/);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Kitchen' }));
    await waitForCount(/^3 facilities$/);
  });

  it('restores everything from the URL, including view and sort', async () => {
    renderApp('/facilities?q=hall&type=hall&sort=-capacity&view=list');
    await waitForCount(/^5 facilities$/);

    expect(screen.getByRole('searchbox', { name: 'Search facilities' })).toHaveValue('hall');
    expect(screen.getByRole('checkbox', { name: /^Hall\s*\d+$/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const names = within(results())
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(names).toEqual([
      'Bantu Bonke Hall',
      'Vaal Marina Hall',
      'Rothdene Hall',
      'Sicelo Hall',
      'Lakeside Hall',
    ]);
  });

  it('remembers the view mode for the session and writes it to the URL', async () => {
    const { router } = renderApp('/facilities');
    await waitForCount(/^12 facilities$/);
    await userEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(router.state.location.search).toBe('?view=list');
    expect(window.sessionStorage.getItem('facilities.view')).toBe('list');
  });

  it('shows the include unavailable toggle in the URL and as a chip', async () => {
    const { router } = renderApp('/facilities');
    await waitForCount(/^12 facilities$/);
    await userEvent.click(screen.getByRole('switch', { name: 'Include unavailable facilities' }));
    await waitFor(() => expect(router.state.location.search).toBe('?status=all'));
    expect(
      screen.getByRole('button', { name: 'Remove filter: Including unavailable' }),
    ).toBeVisible();
  });

  it('shows one empty state when the catalogue has no facilities', async () => {
    server.use(http.get(API, () => HttpResponse.json(emptyEnvelope)));
    renderApp('/facilities');
    expect(await screen.findByText('No facilities available yet')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows a different empty state, with a way out, when filters exclude everything', async () => {
    renderApp('/facilities?q=zzzzzz&type=hall');
    expect(await screen.findByText('No facilities match your search')).toBeVisible();
    expect(screen.queryByText('No facilities available yet')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    await waitForCount(/^12 facilities$/);
  });

  it('shows the problem message with retry on failure', async () => {
    let fail = true;
    server.use(
      http.get(API, () =>
        fail
          ? HttpResponse.json(
              {
                title: 'Mock failure',
                status: 500,
                detail: 'The facilities service is unavailable.',
              },
              { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
            )
          : HttpResponse.json(emptyEnvelope),
      ),
    );
    renderApp('/facilities');
    expect(await screen.findByText('The facilities service is unavailable.')).toBeVisible();

    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No facilities available yet')).toBeVisible();
  });

  it('shows skeleton cards while loading', async () => {
    server.use(
      http.get(API, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json(emptyEnvelope);
      }),
    );
    renderApp('/facilities');
    expect(await screen.findByRole('list', { name: 'Loading results' })).toBeVisible();
    expect(await screen.findByText('No facilities available yet')).toBeVisible();
  });

  it('omits capacity on a card when the venue has none', async () => {
    const [first] = REAL_FACILITIES;
    if (!first) throw new Error('fixture empty');
    server.use(
      http.get(API, () =>
        HttpResponse.json({
          ...emptyEnvelope,
          items: [{ ...first, capacity: null }],
          totalItems: 1,
          totalPages: 1,
        }),
      ),
    );
    renderApp('/facilities');
    const card = (await screen.findByRole('link', { name: 'City Hall' })).closest('article');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).queryByText(/Capacity/)).not.toBeInTheDocument();
  });
});

describe('FacilitiesPage with the volume fixture', () => {
  it('paginates through the envelope', async () => {
    useVolume();
    const { router } = renderApp('/facilities');
    await waitForCount(/^66 facilities$/);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(results()).getAllByRole('link')).toHaveLength(24);

    await userEvent.click(within(nav).getByRole('button', { name: 'Go to page 2' }));
    expect(router.state.location.search).toBe('?page=2');
    await waitFor(() =>
      expect(within(nav).getByRole('button', { name: 'Go to page 2' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
  });

  it('flags unavailable venues in text', async () => {
    useVolume();
    renderApp('/facilities?status=unavailable');
    const link = await screen.findByRole('link', { name: 'Volume Test Venue 011' });
    expect(within(link.closest('article') as HTMLElement).getByText('Unavailable')).toBeVisible();
  });
});

describe('FacilitiesPage on a small screen', () => {
  it('opens filters in a dialog, closes on Escape and returns focus to the button', async () => {
    setViewportWidth(MOBILE_WIDTH);
    renderApp('/facilities');
    await waitForCount(/^12 facilities$/);
    expect(screen.queryByRole('checkbox', { name: /^Hall\s*\d+$/ })).not.toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Filters' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /^Hall wing/ }));

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBe(button);
  });
});
