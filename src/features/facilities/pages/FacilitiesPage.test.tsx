import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
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

const count = () => screen.getByRole('status');
const results = () => screen.getByRole('region', { name: 'Facility results' });
const waitForCount = (text: RegExp) => waitFor(() => expect(count()).toHaveTextContent(text));

describe('FacilitiesPage', () => {
  it('lists active facilities as cards and shows parent relationships', async () => {
    renderApp('/facilities');
    await waitForCount(/^\d+ facilities$/);

    const list = within(results()).getByRole('list', { name: 'Facilities' });
    expect(within(list).getAllByRole('link').length).toBeGreaterThan(0);
    const eastWing = within(list).getByRole('link', { name: 'Civic Centre East Wing' });
    expect(eastWing).toHaveAccessibleDescription(/Part of Civic Centre/);
    expect(eastWing).toHaveAttribute('href', '/facilities/fac-cc-east');
    // Unavailable facilities are excluded by default.
    expect(within(list).queryByText('Old Town Hall')).not.toBeInTheDocument();
  });

  it('debounces search so only the settled text is requested', async () => {
    const queries: string[] = [];
    server.use(
      http.get(API, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('q') ?? '');
        return HttpResponse.json({ ...emptyEnvelope, items: [], totalItems: 0 });
      }),
    );
    const { router } = renderApp('/facilities');
    await waitFor(() => expect(queries).toHaveLength(1));

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search facilities' }), 'civic');
    await waitFor(() => expect(router.state.location.search).toBe('?q=civic'));
    await waitFor(() => expect(queries).toEqual(['', 'civic']));
  });

  it('search updates results and resets to page 1', async () => {
    const { router } = renderApp('/facilities?page=2');
    await waitForCount(/^\d+ facilities$/);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search facilities' }), 'aquatic');
    await waitForCount(/^1 facility$/);
    expect(router.state.location.search).toBe('?q=aquatic');
    expect(within(results()).getByRole('link', { name: 'Central Aquatic Centre' })).toBeVisible();
  });

  it('filters update the URL and results, and removing the chip reverses both', async () => {
    const { router } = renderApp('/facilities');
    await waitForCount(/^\d+ facilities$/);
    const before = count().textContent;

    await userEvent.click(screen.getByRole('checkbox', { name: /Swimming pool/ }));
    await waitForCount(/^2 facilities$/);
    expect(router.state.location.search).toBe('?type=swimming-pool');

    await userEvent.click(screen.getByRole('checkbox', { name: /Lakeside/ }));
    await waitForCount(/^1 facility$/);
    expect(router.state.location.search).toBe('?type=swimming-pool&locality=lakeside');
    expect(within(results()).getByRole('link', { name: 'Lakeside Outdoor Pool' })).toBeVisible();

    const chips = screen.getByRole('list', { name: 'Active filters' });
    await userEvent.click(
      within(chips).getByRole('button', { name: 'Remove filter: Swimming pool' }),
    );
    expect(router.state.location.search).toBe('?locality=lakeside');
    await userEvent.click(within(chips).getByRole('button', { name: 'Remove filter: Lakeside' }));
    expect(router.state.location.search).toBe('');
    await waitForCount(new RegExp(`^${before}$`));
    expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
  });

  it('includes unavailable facilities with a text indication when toggled', async () => {
    const { router } = renderApp('/facilities?q=old+town');
    await waitForCount(/^3 facilities$/);

    await userEvent.click(screen.getByRole('switch', { name: 'Include unavailable facilities' }));
    await waitFor(() => expect(router.state.location.search).toBe('?q=old+town&status=all'));
    const link = await within(results()).findByRole('link', { name: 'Old Town Hall' });
    expect(within(link).getByText('Unavailable')).toBeVisible();
  });

  it('restores everything from the URL, including view and sort', async () => {
    renderApp('/facilities?q=hall&type=community-hall&sort=-capacity&view=list&page=1');
    await waitForCount(/^\d+ facilities?$/);

    expect(screen.getByRole('searchbox', { name: 'Search facilities' })).toHaveValue('hall');
    expect(screen.getByRole('checkbox', { name: /Community hall/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const names = within(results())
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(names[0]).toBe('Hillcrest Community Hall');
  });

  it('remembers the view mode for the session and writes it to the URL', async () => {
    const { router } = renderApp('/facilities');
    await waitForCount(/^\d+ facilities$/);
    await userEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(router.state.location.search).toBe('?view=list');
    expect(window.sessionStorage.getItem('facilities.view')).toBe('list');
  });

  it('shows one empty state when the catalogue has no facilities', async () => {
    server.use(http.get(API, () => HttpResponse.json(emptyEnvelope)));
    renderApp('/facilities');
    expect(await screen.findByText('No facilities available yet')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows a different empty state, with a way out, when filters exclude everything', async () => {
    renderApp('/facilities?q=zzzzzz&type=court');
    expect(await screen.findByText('No facilities match your search')).toBeVisible();
    expect(screen.queryByText('No facilities available yet')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    await waitForCount(/^\d+ facilities$/);
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

  it('paginates through the envelope', async () => {
    server.use(
      http.get(API, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
        return HttpResponse.json({ ...emptyEnvelope, page, totalItems: 60, totalPages: 3 });
      }),
    );
    const { router } = renderApp('/facilities');
    const nav = await screen.findByRole('navigation', { name: 'Pagination' });
    await userEvent.click(within(nav).getByRole('button', { name: 'Go to page 2' }));
    expect(router.state.location.search).toBe('?page=2');
  });
});

describe('FacilitiesPage on a small screen', () => {
  it('opens filters in a dialog, closes on Escape and returns focus to the button', async () => {
    setViewportWidth(MOBILE_WIDTH);
    renderApp('/facilities');
    await waitForCount(/^\d+ facilities$/);
    expect(screen.queryByRole('checkbox', { name: /Swimming pool/ })).not.toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Filters' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Swimming pool/ }));

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBe(button);
  });
});
