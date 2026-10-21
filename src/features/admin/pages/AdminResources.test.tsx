import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedFacilityAdmin } from '@/mocks/data/facilityAdminSeeds';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import { createApiClient, type AllocationMatrix } from '@/shared/api';
import { ROLES } from '@/shared/auth';
import { clerkState } from '@/test/clerk-mock';
import { FIXED_NOW } from '@/test/clock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, setViewportWidth } from '@/test/viewport';

beforeEach(() => {
  mockMeRole(ROLES.facilityAdmin);
  setViewportWidth(DESKTOP_WIDTH);
  seedFacilityAdmin(FIXED_NOW);
});

const api = createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => null });
const alertdialog = () => screen.findByRole('alertdialog');
const affected = (scope: HTMLElement) =>
  within(within(scope).getByRole('list', { name: 'Affected bookings' }))
    .getAllByRole('listitem')
    .map((li) => /MVL-2026-\d+/.exec(li.textContent ?? '')?.[0]);

const GRID = { name: 'Resources held by each facility' };
async function openGrid(search = '') {
  const view = renderApp(`/admin/resources/allocation${search}`);
  const grid = await screen.findByRole('grid', GRID);
  return { ...view, grid };
}
const cell = (resource: string, facility: string) =>
  screen.getByLabelText(`${resource}, ${facility}`) as HTMLInputElement;
const counter = () =>
  within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('status');
const edit = async (resource: string, facility: string, value: string) => {
  const input = cell(resource, facility);
  await userEvent.clear(input);
  await userEvent.type(input, `${value}{Enter}`);
};
const showKitchen = async () => {
  await userEvent.click(screen.getByRole('button', { name: /^Kitchen resources/ }));
  await screen.findByLabelText('Cups, Rothdene Hall');
};
const saved = async (facility: string, resource: string) =>
  (await api.get<AllocationMatrix>('/admin/resource-allocations')).allocations.find(
    (a) => a.facilityId === facility && a.resourceId === resource,
  )?.value;

describe('the catalogue', () => {
  async function openCatalogue(search = '') {
    renderApp(`/admin/resources${search}`);
    await screen.findByRole('heading', { level: 3, name: 'Tables' });
  }
  const row = (name: string) =>
    screen.getByRole('link', { name }).closest('article') as HTMLElement;

  it('lists the nineteen resources from the requirements, grouped by category', async () => {
    await openCatalogue();
    const venue = screen.getByRole('list', { name: 'Venue resources' });
    const kitchen = screen.getByRole('list', { name: 'Kitchen resources' });
    expect(within(venue).getAllByRole('heading', { level: 3 })).toHaveLength(5);
    expect(within(kitchen).getAllByRole('heading', { level: 3 })).toHaveLength(14);
    expect(screen.getByText('19 resources')).toBeVisible();
  });

  it('shows how each is recorded and how many facilities hold it', async () => {
    await openCatalogue();
    expect(within(row('Stage')).getByText('Available or not')).toBeVisible();
    expect(within(row('Chairs')).getByText('Counted')).toBeVisible();
    expect(within(row('Urn')).getByText('Held by 8 facilities')).toBeVisible();
    expect(within(row('Podium')).getByText(/^Held by \d+ facilities$/)).toBeVisible();
  });

  it('lists Dining forks and Forks separately, rather than quietly merging them', async () => {
    await openCatalogue();
    expect(screen.getByRole('link', { name: 'Dining forks' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Forks' })).toBeVisible();
  });

  it('keeps the catalogue and the allocation visibly apart, as two tabs in the URL', async () => {
    await openCatalogue();
    const tabs = screen.getByRole('navigation', { name: 'Resources' });
    expect(within(tabs).getByRole('link', { name: /Catalogue/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabs).getByText('What kinds of resource exist, defined once')).toBeVisible();
    expect(within(tabs).getByRole('link', { name: /Allocation/ })).toHaveAttribute(
      'href',
      '/admin/resources/allocation',
    );
    expect(within(tabs).getByText('How many of each every facility holds')).toBeVisible();
  });

  it('searches, and keeps archived resources behind a filter', async () => {
    await api.post('/admin/resources/stage/archive');
    renderApp('/admin/resources?q=stage');
    expect(await screen.findByText('No resources match')).toBeVisible();
    renderApp('/admin/resources?q=stage&status=archived');
    expect(await screen.findAllByRole('link', { name: 'Stage' })).not.toHaveLength(0);
  });

  it('creates a resource that then exists, with no facility holding one yet', async () => {
    renderApp('/admin/resources/new');
    await userEvent.type(await screen.findByLabelText(/^Name/), 'Projector');
    await userEvent.click(screen.getByRole('radio', { name: /Available or not/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Create resource' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Projector' })).toBeVisible();
    expect(screen.getByText(/Available or not · held by 0 facilities/)).toBeVisible();
    expect(screen.getByText('No facility holds this resource.')).toBeVisible();
  });

  it('refuses a duplicate name, naming the one it clashes with', async () => {
    renderApp('/admin/resources/new');
    await userEvent.type(await screen.findByLabelText(/^Name/), 'chairs');
    await userEvent.click(screen.getByRole('button', { name: 'Create resource' }));
    expect(await screen.findByText(/already a resource called Chairs/)).toBeVisible();
  });

  it('saves a rename without a dialog, since it reaches nothing', async () => {
    renderApp('/admin/resources/kitchen-urn');
    const name = await screen.findByLabelText(/^Name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Tea urn');
    await userEvent.click(screen.getByRole('button', { name: 'Save resource' }));
    expect(await screen.findByText('Resource saved.')).toBeVisible();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Tea urn' })).toBeVisible();
  });

  it('says plainly what is lost when a resource stops being counted, even if no booking is affected', async () => {
    renderApp('/admin/resources/kitchen-urn');
    await userEvent.click(await screen.findByRole('radio', { name: /Available or not/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save resource' }));

    const confirm = await alertdialog();
    expect(within(confirm).getByText('Stop counting Urn?')).toBeVisible();
    expect(
      within(confirm).getByText(/The numbers held at 8 facilities will be discarded/),
    ).toBeVisible();
    expect(
      within(confirm).queryByRole('list', { name: 'Affected bookings' }),
    ).not.toBeInTheDocument();
    expect(await saved('rothdene-hall', 'kitchen-urn')).toBe(2);

    await userEvent.click(within(confirm).getByRole('button', { name: 'Go back' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(await saved('rothdene-hall', 'kitchen-urn')).toBe(2);

    await userEvent.click(screen.getByRole('button', { name: 'Save resource' }));
    await userEvent.click(
      within(await alertdialog()).getByRole('button', {
        name: 'Stop counting, and discard the numbers',
      }),
    );
    expect(await screen.findByText('Resource saved.')).toBeVisible();
    expect(await saved('rothdene-hall', 'kitchen-urn')).toBe(true);
  });

  it('says every facility is left at none when a resource starts being counted, and names the bookings', async () => {
    renderApp('/admin/resources/stage');
    await userEvent.click(await screen.findByRole('radio', { name: /^Counted/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save resource' }));
    const confirm = await alertdialog();
    expect(within(confirm).getByText(/Every facility will be left holding none/)).toBeVisible();
    expect(affected(confirm)).toEqual(['MVL-2026-9202']);
    expect(within(confirm).getByText('Stage: 1 asked for, 0 would be held')).toBeVisible();
  });

  it('archives a resource after naming the pending and approved bookings that asked for it', async () => {
    renderApp('/admin/resources/kitchen-urn');
    await userEvent.click(await screen.findByRole('button', { name: 'Archive Urn' }));
    const confirm = await alertdialog();
    expect(affected(confirm)).toEqual(['MVL-2026-9211', 'MVL-2026-9202', 'MVL-2026-9209']);
    expect(within(confirm).getAllByText('Urn: asked for, to be archived')).toHaveLength(3);
    expect(within(confirm).getByText('Pending')).toBeVisible();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Archive' }));
    expect(await screen.findByText('Urn archived.')).toBeVisible();
    expect(await screen.findByText('This resource is archived')).toBeVisible();
    expect(
      (await api.get<{ retiredResources: unknown[] }>('/booking-options')).retiredResources,
    ).toHaveLength(1);
  });

  it('restores an archived resource', async () => {
    await api.post('/admin/resources/stage/archive');
    renderApp('/admin/resources/stage');
    await userEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('Stage restored.')).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByText('This resource is archived')).not.toBeInTheDocument(),
    );
  });

  it('has no delete', async () => {
    renderApp('/admin/resources/stage');
    await screen.findByRole('button', { name: 'Archive Stage' });
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('says a resource is not found when the address is wrong', async () => {
    renderApp('/admin/resources/nowhere');
    expect(await screen.findByText('We could not find that resource')).toBeVisible();
  });
});

describe('the allocation grid: structure', () => {
  it('is a real table, with every cell under its facility and its resource', async () => {
    const { grid } = await openGrid();
    const headers = within(grid)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toHaveLength(13);
    expect(headers.slice(1).map((h) => h?.replace(/Fill or copy$/, ''))).toContain('Rothdene Hall');
    const row = within(grid).getByRole('row', { name: /^Chairs/ });
    expect(within(row).getByRole('rowheader')).toHaveTextContent('Chairs');
    expect(within(row).getAllByRole('gridcell')).toHaveLength(12);
  });

  it('names every cell by its resource and its facility', async () => {
    await openGrid();
    expect(cell('Chairs', 'Rothdene Hall')).toHaveValue('250');
    expect(screen.getByLabelText('Stage, Rothdene Hall')).toBeVisible();
    await showKitchen();
    expect(cell('Cups', 'Rothdene Hall')).toHaveValue('250');
  });

  it('renders a number for a counted resource and a checkbox for one that is available or not, never a stepper', async () => {
    const { grid } = await openGrid();
    expect(screen.getByRole('textbox', { name: 'Chairs, Rothdene Hall' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Stage, Rothdene Hall' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Podium, Rothdene Hall' })).not.toBeChecked();
    expect(
      within(grid).queryByRole('button', { name: /^(Increase|Decrease)/ }),
    ).not.toBeInTheDocument();
  });

  it('folds the kitchen away, since it is most of the rows, and opens it on request', async () => {
    const { grid } = await openGrid();
    expect(grid.querySelectorAll('tbody th[scope="row"]')).toHaveLength(5);
    const toggle = screen.getByRole('button', { name: /^Kitchen resources/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('14 resources');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(grid.querySelectorAll('tbody th[scope="row"]')).toHaveLength(19);
  });

  it('narrows to some facilities and one category, in the URL', async () => {
    const { grid, router } = await openGrid(
      '?facility=city-hall&facility=rothdene-hall&category=kitchen',
    );
    await waitFor(() => expect(within(grid).getAllByRole('columnheader')).toHaveLength(3));
    // Narrowing to kitchen opens it.
    expect(grid.querySelectorAll('tbody th[scope="row"]')).toHaveLength(14);
    expect(screen.getByText('Showing 2 of 12 facilities and 14 of 19 resources')).toBeVisible();
    expect(router.state.location.search).toContain('category=kitchen');
  });
});

describe('the allocation grid: editing', () => {
  it('accumulates edits as a count, announced, and flags each changed cell', async () => {
    await openGrid();
    expect(counter()).toHaveTextContent('No unsaved changes');
    await edit('Chairs', 'Rothdene Hall', '240');
    expect(counter()).toHaveTextContent('1 unsaved change');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Podium, Rothdene Hall' }));
    expect(counter()).toHaveTextContent('2 unsaved changes');
    expect(counter().getAttribute('aria-live')).toBe('polite');

    expect(cell('Chairs', 'Rothdene Hall').closest('[data-changed]')).not.toBeNull();
    expect(cell('Tables', 'Rothdene Hall').closest('[data-changed]')).toBeNull();
    expect(cell('Chairs', 'Rothdene Hall')).toHaveAccessibleDescription('Changed from 250');
  });

  it('stops counting a cell once it is put back', async () => {
    await openGrid();
    await edit('Chairs', 'Rothdene Hall', '240');
    await edit('Chairs', 'Rothdene Hall', '250');
    expect(counter()).toHaveTextContent('No unsaved changes');
  });

  it('discards every edit on request', async () => {
    await openGrid();
    await edit('Chairs', 'Rothdene Hall', '240');
    await userEvent.click(screen.getByRole('button', { name: /^Discard/ }));
    expect(cell('Chairs', 'Rothdene Hall')).toHaveValue('250');
    expect(counter()).toHaveTextContent('No unsaved changes');
  });

  it('sends nothing while editing: one request is made at save, not one per keystroke', async () => {
    const seen: string[] = [];
    const listener = ({ request }: { request: Request }) => {
      if (request.method !== 'GET') seen.push(`${request.method} ${new URL(request.url).pathname}`);
    };
    server.events.on('request:start', listener);
    await openGrid();
    await edit('Chairs', 'Rothdene Hall', '240');
    await edit('Tables', 'Rothdene Hall', '30');
    expect(seen).toEqual([]);
    server.events.removeListener('request:start', listener);
  });
});

describe('the allocation grid: fill and copy', () => {
  it('fills a row across only the facilities shown', async () => {
    const { router } = await openGrid('?facility=city-hall&facility=rothdene-hall');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Fill Chairs across the facilities shown' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Fill Chairs' });
    expect(within(dialog).getByText(/at the 2 facilities shown/)).toBeVisible();
    const quantity = within(dialog).getByLabelText('Quantity at each facility');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '10');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fill row' }));

    expect(cell('Chairs', 'City Hall')).toHaveValue('10');
    expect(cell('Chairs', 'Rothdene Hall')).toHaveValue('10');
    expect(counter()).toHaveTextContent('2 unsaved changes');

    // Widen the view: the facilities that were not shown were not touched.
    await router.navigate('/admin/resources/allocation');
    await waitFor(() => expect(cell('Chairs', 'Lakeside Hall')).toHaveValue('180'));
    expect(cell('Chairs', 'City Hall')).toHaveValue('10');
    expect(counter()).toHaveTextContent('2 unsaved changes');
  });

  it('fills a row of something available or not with available or not', async () => {
    await openGrid();
    await userEvent.click(
      screen.getByRole('button', { name: 'Fill Podium across the facilities shown' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Fill Podium' });
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Available' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fill row' }));
    expect(screen.getByRole('checkbox', { name: 'Podium, Sicelo Hall' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Podium, Rothdene Hall' })).toBeChecked();
  });

  it('fills a column across the resources shown, counted ones with a number and the rest with available or not', async () => {
    await openGrid();
    await userEvent.click(screen.getByRole('button', { name: 'Column actions for Rothdene Hall' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rothdene Hall' });
    expect(within(dialog).getByText(/apply to the 5 resources shown/)).toBeVisible();
    const quantity = within(dialog).getByLabelText('Quantity for counted resources');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '5');
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Available' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fill column' }));

    expect(cell('Tables', 'Rothdene Hall')).toHaveValue('5');
    expect(cell('Chairs', 'Rothdene Hall')).toHaveValue('5');
    expect(screen.getByRole('checkbox', { name: 'Podium, Rothdene Hall' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Sound system, Rothdene Hall' })).toBeChecked();
    // Stage was available already: no change.
    expect(counter()).toHaveTextContent('4 unsaved changes');

    // The kitchen was folded away, so it was not touched.
    await showKitchen();
    expect(cell('Cups', 'Rothdene Hall')).toHaveValue('250');
    expect(counter()).toHaveTextContent('4 unsaved changes');
  });

  it('copies one facility’s column to another', async () => {
    await openGrid();
    await userEvent.click(screen.getByRole('button', { name: 'Column actions for Lakeside Hall' }));
    const dialog = await screen.findByRole('dialog', { name: 'Lakeside Hall' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Copy values from'), 'city-hall');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copy into Lakeside Hall' }));
    expect(cell('Tables', 'Lakeside Hall')).toHaveValue(cell('Tables', 'City Hall').value);
    expect(cell('Chairs', 'Lakeside Hall')).toHaveValue('500');
    expect(screen.getByRole('checkbox', { name: 'Podium, Lakeside Hall' })).toBeChecked();
  });

  it('signposts the form for one facility from its column', async () => {
    await openGrid();
    await userEvent.click(screen.getByRole('button', { name: 'Column actions for Rothdene Hall' }));
    expect(
      within(await screen.findByRole('dialog', { name: 'Rothdene Hall' })).getByRole('link', {
        name: 'Open the form for Rothdene Hall',
      }),
    ).toHaveAttribute('href', '/admin/facilities/rothdene-hall/resources');
  });
});

describe('the allocation grid: saving', () => {
  it('runs a single impact check for the whole batch, not one per cell', async () => {
    const posts: string[] = [];
    const listener = ({ request }: { request: Request }) => {
      if (request.method === 'POST') posts.push(new URL(request.url).pathname);
    };
    server.events.on('request:start', listener);
    await openGrid();
    await edit('Chairs', 'Rothdene Hall', '95');
    await edit('Tables', 'Lakeside Hall', '10');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Stage, Rothdene Hall' }));
    await userEvent.click(screen.getByRole('button', { name: /^Save 3 changes/ }));
    await alertdialog();
    server.events.removeListener('request:start', listener);
    expect(posts.filter((p) => p.endsWith('/resource-allocations/impact'))).toHaveLength(1);
  });

  it('names a booking whose request a reduced quantity no longer meets, with the resource and the numbers', async () => {
    await openGrid();
    await edit('Chairs', 'Rothdene Hall', '95');
    await userEvent.click(screen.getByRole('button', { name: /^Save 1 change/ }));
    const confirm = await alertdialog();
    expect(affected(confirm)).toEqual(['MVL-2026-9202', 'MVL-2026-9209']);
    expect(within(confirm).getByText('Chairs: 140 asked for, 95 would be held')).toBeVisible();
    expect(
      within(confirm).getAllByText('The facility would hold fewer than it asks for.'),
    ).toHaveLength(2);
    expect(within(confirm).getAllByText('Dawie Steyn · Rothdene Hall')).toHaveLength(2);
    expect(await saved('rothdene-hall', 'chairs')).toBe(250);

    await userEvent.click(
      within(confirm).getByRole('button', { name: 'Save and keep these bookings' }),
    );
    expect(await screen.findByText('1 change saved.')).toBeVisible();
    expect(await saved('rothdene-hall', 'chairs')).toBe(95);
    expect(counter()).toHaveTextContent('No unsaved changes');
  });

  it('names a booking that asked for something now withdrawn', async () => {
    await openGrid();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Stage, Rothdene Hall' }));
    await userEvent.click(screen.getByRole('button', { name: /^Save 1 change/ }));
    const confirm = await alertdialog();
    expect(affected(confirm)).toEqual(['MVL-2026-9202']);
    expect(
      within(confirm).getByText('Stage: asked for, would no longer be available'),
    ).toBeVisible();
  });

  it('saves a batch that affects nothing without a dialog', async () => {
    await openGrid();
    await edit('Chairs', 'Rothdene Hall', '300');
    await edit('Tables', 'Sicelo Hall', '5');
    await userEvent.click(screen.getByRole('button', { name: /^Save 2 changes/ }));
    expect(await screen.findByText('2 changes saved.')).toBeVisible();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await saved('rothdene-hall', 'chairs')).toBe(300);
    expect(await saved('sicelo-hall', 'tables')).toBe(5);
  });

  it('keeps every pending edit when the save fails, and nothing is half saved', async () => {
    server.use(
      http.put(`${TEST_API_BASE_URL}/admin/resource-allocations`, () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Mock failure',
            status: 500,
            detail: 'The server is down.',
          },
          { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    await openGrid();
    await edit('Chairs', 'Rothdene Hall', '300');
    await edit('Tables', 'Sicelo Hall', '5');
    await userEvent.click(screen.getByRole('button', { name: /^Save 2 changes/ }));
    expect(await screen.findByText('The server is down.')).toBeVisible();
    expect(counter()).toHaveTextContent('2 unsaved changes');
    expect(cell('Chairs', 'Rothdene Hall')).toHaveValue('300');
    expect(await saved('rothdene-hall', 'chairs')).toBe(250);
  });

  it('rolls back a batch that fails part way, names why, and keeps the edits', async () => {
    await openGrid();
    await edit('Chairs', 'Rothdene Hall', '300');
    // The Bantu Bonke Hall is locked for a stocktake, which the server finds as it applies the batch.
    await edit('Chairs', 'Bantu Bonke Hall', '5');
    await userEvent.click(screen.getByRole('button', { name: /^Save 2 changes/ }));
    expect(await screen.findByText(/stock is locked while a stocktake is under way/)).toBeVisible();
    expect(counter()).toHaveTextContent('2 unsaved changes');
    expect(await saved('rothdene-hall', 'chairs')).toBe(250);
    expect(cell('Chairs', 'Rothdene Hall')).toHaveValue('300');
  });

  it('names the cell at fault when the server refuses a value, and applies none of the batch', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/admin/resource-allocations/impact`, () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Validation failed',
            status: 422,
            errors: { 'changes.1': ['Chairs is counted: use a whole number from 0 to 5000.'] },
          },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    await openGrid();
    await edit('Tables', 'Sicelo Hall', '5');
    await edit('Chairs', 'Rothdene Hall', '300');
    await userEvent.click(screen.getByRole('button', { name: /^Save 2 changes/ }));
    expect(
      await screen.findByText(/Chairs, Rothdene Hall: Chairs is counted: use a whole number/),
    ).toBeVisible();
    expect(counter()).toHaveTextContent('2 unsaved changes');
  });

  it('warns before unsaved work is lost to navigation, and keeps it if the person stays', async () => {
    const { router } = await openGrid();
    await edit('Chairs', 'Rothdene Hall', '240');
    void router.navigate('/facilities');

    const ask = await alertdialog();
    expect(within(ask).getByText(/You have 1 unsaved change/)).toBeVisible();
    await userEvent.click(within(ask).getByRole('button', { name: 'Stay here' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(cell('Chairs', 'Rothdene Hall')).toHaveValue('240');
    expect(router.state.location.pathname).toBe('/admin/resources/allocation');

    void router.navigate('/facilities');
    await userEvent.click(
      within(await alertdialog()).getByRole('button', { name: 'Leave and discard' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/facilities'));
  });
});

describe('the allocation grid: the keyboard', () => {
  it('is one tab stop, and Tab leaves it', async () => {
    const { grid } = await openGrid();
    expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    cell('Tables', 'Activity Room').focus();
    await userEvent.tab();
    expect(grid.contains(document.activeElement)).toBe(false);
  });

  it('moves between cells with the arrow keys, and edits without the mouse', async () => {
    const { grid } = await openGrid();
    const first = cell('Tables', 'Activity Room');
    first.focus();
    first.select();

    await userEvent.keyboard('{ArrowRight}');
    expect(cell('Tables', 'Bantu Bonke Hall')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('checkbox', { name: 'Stage, Bantu Bonke Hall' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    const podium = screen.getByRole('checkbox', { name: 'Podium, Bantu Bonke Hall' });
    expect(podium).toHaveFocus();
    const wasChecked = (podium as HTMLInputElement).checked;
    await userEvent.keyboard(' ');
    expect(podium).toHaveProperty('checked', !wasChecked);
    expect(counter()).toHaveTextContent('1 unsaved change');

    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('checkbox', { name: 'Podium, Activity Room' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(cell('Tables', 'Activity Room')).toHaveFocus();

    // Typing replaces the selected number, and Enter commits it.
    await userEvent.keyboard('7{Enter}');
    expect(cell('Tables', 'Activity Room')).toHaveValue('7');
    expect(counter()).toHaveTextContent('2 unsaved changes');
    expect(grid.contains(document.activeElement)).toBe(true);
  });

  it('reaches the row and column controls and the group heading with the same keys', async () => {
    await openGrid();
    const chairs = cell('Chairs', 'Activity Room');
    chairs.focus();
    chairs.select();
    await userEvent.keyboard('{ArrowLeft}');
    expect(
      screen.getByRole('button', { name: 'Fill Chairs across the facilities shown' }),
    ).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(
      screen.getByRole('button', { name: 'Fill Tables across the facilities shown' }),
    ).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: /^Venue resources/ })).toHaveFocus();

    cell('Tables', 'Activity Room').focus();
    cell('Tables', 'Activity Room').select();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: 'Column actions for Activity Room' })).toHaveFocus();
  });

  it('operates the row fill entirely from the keyboard', async () => {
    await openGrid();
    const chairs = cell('Chairs', 'Activity Room');
    chairs.focus();
    chairs.select();
    await userEvent.keyboard('{ArrowLeft}{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Fill Chairs' });
    const quantity = within(dialog).getByLabelText('Quantity at each facility');
    quantity.focus();
    await userEvent.keyboard('{Control>}a{/Control}12');
    await userEvent.tab();
    await userEvent.tab();
    expect(within(dialog).getByRole('button', { name: 'Fill row' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Fill Chairs' })).not.toBeInTheDocument(),
    );
    expect(cell('Chairs', 'Activity Room')).toHaveValue('12');
    expect(cell('Chairs', 'Rothdene Hall')).toHaveValue('12');
    // Focus returns to where it was.
    expect(
      screen.getByRole('button', { name: 'Fill Chairs across the facilities shown' }),
    ).toHaveFocus();
  });

  it('lets the caret move within a number before the arrow keys leave the cell', async () => {
    await openGrid();
    const input = cell('Chairs', 'Rothdene Hall');
    await userEvent.click(input);
    input.setSelectionRange(1, 1);
    await userEvent.keyboard('{ArrowLeft}');
    // The caret was mid-number, so focus stayed.
    expect(input).toHaveFocus();
  });
});

describe('the form for one facility', () => {
  const open = async (id = 'rothdene-hall') => {
    const view = renderApp(`/admin/facilities/${id}/resources`);
    await screen.findByRole('heading', { level: 1, name: /: resources$/ });
    return view;
  };

  it('shows a number for what is counted and a checkbox for the rest, kitchen behind a disclosure', async () => {
    await open();
    const venue = screen.getByRole('group', { name: 'Venue resources' });
    expect(within(venue).getByRole('textbox', { name: 'Chairs quantity' })).toHaveValue('250');
    expect(within(venue).getByRole('checkbox', { name: /^Stage/ })).toBeChecked();
    expect(within(venue).getByRole('checkbox', { name: /^Podium/ })).not.toBeChecked();
    // A counted resource has a stepper here; the one thing a stage never has.
    expect(within(venue).queryByRole('button', { name: 'Increase Stage' })).not.toBeInTheDocument();
    expect(within(venue).getByRole('button', { name: 'Increase Chairs' })).toBeVisible();

    expect(screen.queryByRole('textbox', { name: 'Cups quantity' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Kitchen resources/ }));
    expect(await screen.findByRole('textbox', { name: 'Cups quantity' })).toHaveValue('250');
  });

  it('saves with one impact check, naming a booking a reduction would leave short', async () => {
    await open();
    const chairs = screen.getByRole('textbox', { name: 'Chairs quantity' });
    await userEvent.clear(chairs);
    await userEvent.type(chairs, '95{Enter}');
    expect(
      within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('status'),
    ).toHaveTextContent('1 unsaved change');
    await userEvent.click(screen.getByRole('button', { name: /^Save 1 change/ }));
    const confirm = await alertdialog();
    expect(affected(confirm)).toEqual(['MVL-2026-9202', 'MVL-2026-9209']);
    await userEvent.click(
      within(confirm).getByRole('button', { name: 'Save and keep these bookings' }),
    );
    expect(await screen.findByText('Rothdene Hall: resources saved.')).toBeVisible();
    expect(await saved('rothdene-hall', 'chairs')).toBe(95);
  });

  it('saves a harmless change without a dialog', async () => {
    await open();
    await userEvent.click(screen.getByRole('checkbox', { name: /^Podium/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Save 1 change/ }));
    expect(await screen.findByText('Rothdene Hall: resources saved.')).toBeVisible();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await saved('rothdene-hall', 'podium')).toBe(true);
  });

  it('warns before unsaved edits are lost', async () => {
    const { router } = await open();
    await userEvent.click(screen.getByRole('checkbox', { name: /^Podium/ }));
    void router.navigate('/facilities');
    expect(within(await alertdialog()).getByText('Leave without saving?')).toBeVisible();
  });

  it('points to the grid for many facilities, and is reached from the facility’s own screen', async () => {
    await open();
    expect(screen.getByRole('link', { name: 'Use the allocation grid' })).toHaveAttribute(
      'href',
      '/admin/resources/allocation?facility=rothdene-hall',
    );
    expect(screen.getByRole('link', { name: 'catalogue' })).toHaveAttribute(
      'href',
      '/admin/resources',
    );
  });

  it('says a facility is not found when the address is wrong', async () => {
    renderApp('/admin/facilities/nowhere/resources');
    expect(await screen.findByText('We could not find that facility')).toBeVisible();
  });
});

describe('the grid scoped from a facility', () => {
  it('opens with just that facility, ready to widen', async () => {
    const { grid } = await openGrid('?facility=rothdene-hall');
    await waitFor(() => expect(within(grid).getAllByRole('columnheader')).toHaveLength(2));
    expect(screen.getByRole('button', { name: 'Remove filter: Rothdene Hall' })).toBeVisible();
  });
});

describe('what the rest of the system then shows', () => {
  it('an archived resource keeps its name on the booking that asked for it', async () => {
    await api.post('/admin/resources/stage/archive');
    clerkState.getToken.mockImplementation(async () => 'user:applicant-dawie');
    mockMeRole(ROLES.applicant);
    renderApp('/bookings/adm-9202');
    expect(await screen.findByRole('heading', { level: 1, name: 'MVL-2026-9202' })).toBeVisible();
    expect(await screen.findByText('Stage')).toBeVisible();
    expect(screen.getByText('Chairs × 100')).toBeVisible();
  });

  it('an uncounted resource shows without a number on the booking, a counted one with', async () => {
    clerkState.getToken.mockImplementation(async () => 'user:applicant-dawie');
    mockMeRole(ROLES.applicant);
    renderApp('/bookings/adm-9202');
    expect(await screen.findByText('Chairs × 100')).toBeVisible();
    expect(screen.getByText('Stage')).toBeVisible();
    expect(screen.queryByText('Stage × 1')).not.toBeInTheDocument();
  });

  it('changing the grid changes the public pages', async () => {
    await openGrid();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Podium, Rothdene Hall' }));
    await userEvent.click(screen.getByRole('button', { name: /^Save 1 change/ }));
    await screen.findByText('1 change saved.');
    const shown = await api.get<{
      resources: Array<{ id: string }>;
      amenities: Array<{ id: string }>;
    }>('/facilities/rothdene-hall');
    expect(shown.resources.map((r) => r.id)).toContain('podium');
    expect(shown.amenities.map((a) => a.id)).toContain('podium');
  });
});

describe('permissions', () => {
  it.each([
    '/admin/resources',
    '/admin/resources/new',
    '/admin/resources/allocation',
    '/admin/resources/stage',
    '/admin/facilities/rothdene-hall/resources',
  ])('keeps an applicant out of %s', async (path) => {
    mockMeRole(ROLES.applicant);
    renderApp(path);
    expect(await screen.findByText(/don.t have access|not allowed|permission/i)).toBeVisible();
  });

  it('lets a system administrator in', async () => {
    mockMeRole(ROLES.systemAdmin);
    clerkState.getToken.mockImplementation(async () => 'user:mock-sysadmin');
    renderApp('/admin/resources');
    await screen.findByRole('heading', { level: 3, name: 'Tables' });
    expect(
      within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', {
        name: 'Manage resources',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('refuses the API to someone who is not an administrator', async () => {
    const applicant = createApiClient({
      baseUrl: TEST_API_BASE_URL,
      getToken: async () => 'user:applicant-thandi',
    });
    await expect(applicant.get('/admin/resource-allocations')).rejects.toMatchObject({
      status: 403,
    });
  });
});
