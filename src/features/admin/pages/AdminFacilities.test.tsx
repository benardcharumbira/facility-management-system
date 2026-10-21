import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedFacilityAdmin } from '@/mocks/data/facilityAdminSeeds';
import { TEST_API_BASE_URL } from '@/mocks/server';
import { createApiClient } from '@/shared/api';
import { ROLES } from '@/shared/auth';
import { FIXED_NOW } from '@/test/clock';
import { clerkState } from '@/test/clerk-mock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, setViewportWidth } from '@/test/viewport';

beforeEach(() => {
  mockMeRole(ROLES.facilityAdmin);
  setViewportWidth(DESKTOP_WIDTH);
  seedFacilityAdmin(FIXED_NOW);
});

const api = createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => null });

const sectionsNav = () => screen.findByRole('navigation', { name: 'Facility sections' });
async function openFacility(id: string, section?: string) {
  const view = renderApp(`/admin/facilities/${id}${section ? `?section=${section}` : ''}`);
  await sectionsNav();
  return view;
}
const dialog = () => screen.findByRole('alertdialog');
const affected = (scope: HTMLElement) =>
  within(within(scope).getByRole('list', { name: 'Affected bookings' }))
    .getAllByRole('listitem')
    .map((li) => /MVL-2026-\d+/.exec(li.textContent ?? '')?.[0]);
const set = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('the list', () => {
  async function openList(search = '') {
    renderApp(`/admin/facilities${search}`);
    return screen.findByRole('list', { name: 'Facilities' });
  }
  const row = (name: string) =>
    screen.getByRole('link', { name }).closest('article') as HTMLElement;

  it('shows each space under its parent, attached by indentation and in words', async () => {
    const list = await openList();
    const names = within(list)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    const hall = names.indexOf('City Hall');
    expect(names.slice(hall + 1, hall + 4).sort()).toEqual([
      'City Hall Committee Room',
      'Loch Wing',
      'Mitchell Wing',
    ]);
    expect(within(row('Mitchell Wing')).getByText('Part of City Hall')).toBeVisible();
    expect(within(row('City Hall')).getByText('Includes 3 spaces')).toBeVisible();
    expect(within(row('Rothdene Hall')).queryByText(/Part of/)).not.toBeInTheDocument();
  });

  it('shows status, future bookings and any closure in effect at a glance', async () => {
    await openList();
    const hall = row('City Hall');
    expect(within(hall).getByText('Active')).toBeVisible();
    expect(within(hall).getByText('Closure in effect')).toBeVisible();
    expect(within(row('Rothdene Hall')).getByText('4 future bookings')).toBeVisible();
    expect(within(row('Sicelo Hall')).getByText('0 future bookings')).toBeVisible();
    expect(within(row('Mitchell Wing')).getByText('Closure in effect')).toBeVisible();
  });

  it('makes a facility with nobody to approve for it a visible problem', async () => {
    await openList();
    expect(await screen.findByText('3 facilities have nobody to approve for them')).toBeVisible();
    expect(within(row('Activity Room')).getByText('No approver')).toBeVisible();
    expect(within(row('Council Chambers')).getByText('No approver')).toBeVisible();
    expect(within(row('Rothdene Hall')).queryByText('No approver')).not.toBeInTheDocument();
  });

  it('leaves archived facilities out until asked, and keeps the filters in the URL', async () => {
    await api.post('/admin/facilities/vaal-marina-board-room/archive');
    const { router } = (await (async () => {
      const view = renderApp('/admin/facilities');
      await screen.findByRole('list', { name: 'Facilities' });
      return view;
    })()) as { router: { state: { location: { search: string } } } };
    expect(screen.queryByText('Vaal Marina Board Room')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filters' });
    await userEvent.click(within(panel).getByRole('checkbox', { name: 'Archived' }));
    await userEvent.click(within(panel).getByRole('checkbox', { name: 'Active' }));
    await userEvent.click(within(panel).getByRole('checkbox', { name: 'Unavailable' }));
    await waitFor(() => expect(router.state.location.search).toBe('?status=archived'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('link', { name: 'Vaal Marina Board Room' })).toBeVisible();
    expect(within(row('Vaal Marina Board Room')).getByText('Archived')).toBeVisible();
  });

  it('filters by whether a facility is a parent or a child, and searches', async () => {
    renderApp('/admin/facilities?structure=child');
    await screen.findByRole('list', { name: 'Facilities' });
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Facilities' })).getAllByRole('heading', {
          level: 3,
        }),
      ).toHaveLength(4),
    );
    expect(screen.queryByRole('link', { name: 'City Hall' })).not.toBeInTheDocument();
  });

  it('offers a way to create, and to manage facility types', async () => {
    await openList();
    expect(screen.getByRole('link', { name: 'Create facility' })).toHaveAttribute(
      'href',
      '/admin/facilities/new',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Facility types' }));
    const types = await screen.findByRole('dialog', { name: 'Facility types' });
    expect(await within(types).findByText('Used by 5 facilities')).toBeVisible();

    await userEvent.type(within(types).getByLabelText(/^Name \* \(required\)/), 'Sports field');
    await userEvent.click(
      within(types).getByRole('checkbox', { name: 'Capacity applies to this type' }),
    );
    await userEvent.click(within(types).getByRole('button', { name: 'Add type' }));
    expect(await within(types).findByLabelText('Name of Sports field')).toBeVisible();
  });
});

describe('creating a facility', () => {
  it('with a parent gives the containment relationship, which the public screens then show', async () => {
    renderApp('/admin/facilities/new');
    await screen.findByRole('heading', { level: 1, name: 'Create facility' });

    await userEvent.type(await screen.findByLabelText(/^Name/), 'Annex Room');
    await userEvent.type(screen.getByLabelText(/^Code/), 'ANX-1');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Committee room' })).toBeVisible(),
    );
    await userEvent.selectOptions(screen.getByLabelText(/^Type/), 'committee-room');
    await userEvent.type(screen.getByLabelText(/^Locality/), 'Meyerton');
    await userEvent.type(
      screen.getByLabelText(/^Short description/),
      'A small room next to City Hall.',
    );
    await waitFor(() => expect(screen.getByRole('option', { name: 'City Hall' })).toBeVisible());
    await userEvent.selectOptions(screen.getByLabelText('Part of'), 'city-hall');
    await userEvent.click(screen.getByRole('button', { name: 'Create facility' }));

    // Lands on the next thing to do: it cannot be active without an approver.
    expect(await screen.findByRole('heading', { level: 1, name: 'Annex Room' })).toBeVisible();
    expect(screen.getByText('Part of City Hall', { exact: false })).toBeVisible();
    expect(screen.getByText('Nobody approves for this facility')).toBeVisible();

    const detail = await api.get<{ parentFacility: { name: string } | null }>(
      '/facilities/annex-room',
    );
    expect(detail.parentFacility?.name).toBe('City Hall');
    const parent = await api.get<{ childFacilities: Array<{ name: string }> }>(
      '/facilities/city-hall',
    );
    expect(parent.childFacilities.map((c) => c.name)).toContain('Annex Room');
  });

  it('says what is missing rather than creating half a facility', async () => {
    renderApp('/admin/facilities/new');
    await screen.findByRole('heading', { level: 1, name: 'Create facility' });
    await userEvent.click(screen.getByRole('button', { name: 'Create facility' }));
    expect(await screen.findByText('Enter the name.')).toBeVisible();
    expect(screen.getByText('Choose a type.')).toBeVisible();
    expect((await api.get<{ totalItems: number }>('/admin/facilities')).totalItems).toBe(12);
  });
});

describe('the hierarchy', () => {
  it('cannot be made cyclic through the control: nothing inside a facility is offered as its parent', async () => {
    await openFacility('city-hall', 'hierarchy');
    const select = await screen.findByLabelText('Part of');
    const options = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toContain('Rothdene Hall');
    for (const inside of ['City Hall', 'Mitchell Wing', 'Loch Wing', 'City Hall Committee Room']) {
      expect(options).not.toContain(inside);
    }
  });

  it('states the containment rule in plain words and links the spaces inside', async () => {
    await openFacility('city-hall', 'hierarchy');
    expect(
      await screen.findByText(/Booking a parent facility blocks every space inside it/),
    ).toBeVisible();
    const inside = screen.getByRole('list', { name: 'Spaces inside' });
    expect(within(inside).getByRole('link', { name: 'Mitchell Wing' })).toHaveAttribute(
      'href',
      '/admin/facilities/mitchell-wing',
    );
  });

  it('names a booking that would newly clash when a facility is moved into a building', async () => {
    await openFacility('activity-room', 'hierarchy');
    await userEvent.selectOptions(await screen.findByLabelText('Part of'), 'rothdene-hall');
    await userEvent.click(screen.getByRole('button', { name: 'Save hierarchy' }));

    const confirm = await dialog();
    expect(affected(confirm)).toEqual(['MVL-2026-9210']);
    expect(
      within(confirm).getByText(/Would now clash with MVL-2026-9201 at Rothdene Hall/),
    ).toBeVisible();
    expect(
      within(confirm).getByText(/does not cancel or move any of these bookings/),
    ).toBeVisible();
    // Nothing has changed yet.
    expect(
      (await api.get<{ parentFacility: unknown }>('/admin/facilities/activity-room'))
        .parentFacility,
    ).toBeNull();

    await userEvent.click(within(confirm).getByRole('button', { name: 'Change the hierarchy' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(
      (await api.get<{ parentFacility: { id: string } }>('/admin/facilities/activity-room'))
        .parentFacility.id,
    ).toBe('rothdene-hall');
  });

  it('saves a harmless move without any dialog', async () => {
    await openFacility('sicelo-hall', 'hierarchy');
    await userEvent.selectOptions(await screen.findByLabelText('Part of'), 'city-hall');
    await userEvent.click(screen.getByRole('button', { name: 'Save hierarchy' }));
    expect(await screen.findByText('Hierarchy saved.')).toBeVisible();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('blackouts', () => {
  async function fillClosure(reason = 'Closed while the floor is resurfaced.') {
    await screen.findByRole('heading', { name: 'Add a closure' });
    set(/^First day/, '2026-12-12');
    set(/^Last day/, '2026-12-13');
    await userEvent.type(screen.getByLabelText(/^Reason/), reason);
  }

  it('lists every booking it covers before it is confirmed, and creates nothing until then', async () => {
    await openFacility('rothdene-hall', 'blackouts');
    await fillClosure();
    await userEvent.click(screen.getByRole('button', { name: 'Add closure' }));

    const confirm = await dialog();
    expect(within(confirm).getByText('3 bookings are affected:')).toBeVisible();
    expect(affected(confirm)).toEqual(['MVL-2026-9201', 'MVL-2026-9202', 'MVL-2026-9203']);
    expect(within(confirm).getByText('Grace Mthembu · Rothdene Hall')).toBeVisible();
    expect(within(confirm).getByText('Sat 12 Dec, 09:00 to 13:00')).toBeVisible();
    expect(within(confirm).getAllByText('Falls inside the closure.')).toHaveLength(3);
    expect(await api.get<unknown[]>('/admin/facilities/rothdene-hall/blackouts')).toEqual([]);

    await userEvent.click(within(confirm).getByRole('button', { name: 'Add the closure' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    const list = await screen.findByRole('list', { name: 'Current and upcoming closures' });
    expect(within(list).getByText('Closed while the floor is resurfaced.')).toBeVisible();
    expect(within(list).getByText('Sat 12 Dec 2026 to Sun 13 Dec 2026')).toBeVisible();
  });

  it('can be abandoned from the dialog, leaving nothing behind and focus where it was', async () => {
    await openFacility('rothdene-hall', 'blackouts');
    await fillClosure();
    const add = screen.getByRole('button', { name: 'Add closure' });
    await userEvent.click(add);
    const confirm = await dialog();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Go back' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(add).toHaveFocus());
    expect(await api.get<unknown[]>('/admin/facilities/rothdene-hall/blackouts')).toEqual([]);
  });

  it('is added at once when it covers no booking', async () => {
    await openFacility('rothdene-hall', 'blackouts');
    await screen.findByRole('heading', { name: 'Add a closure' });
    set(/^First day/, '2027-02-01');
    set(/^Last day/, '2027-02-02');
    await userEvent.type(screen.getByLabelText(/^Reason/), 'Closed for the annual inspection.');
    await userEvent.click(screen.getByRole('button', { name: 'Add closure' }));
    expect(await screen.findByText('Closure added.')).toBeVisible();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('needs a reason a resident can read, and says that a closure on a building covers its spaces', async () => {
    await openFacility('city-hall', 'blackouts');
    expect(
      await screen.findByText(
        'A closure on City Hall also applies to the spaces inside it: City Hall Committee Room, Loch Wing, Mitchell Wing.',
      ),
    ).toBeVisible();
    set(/^First day/, '2027-02-01');
    await userEvent.click(screen.getByRole('button', { name: 'Add closure' }));
    expect(
      await screen.findByText(/Say why, in a sentence the public will understand/),
    ).toBeVisible();
  });

  it('shows a closure in effect, an inherited one with where it was set, and offers delete only before it starts', async () => {
    await openFacility('mitchell-wing', 'blackouts');
    const list = await screen.findByRole('list', { name: 'Current and upcoming closures' });
    expect(within(list).getByText('Closed while the roof is repaired')).toBeVisible();
    expect(within(list).getByText('In effect now')).toBeVisible();
    expect(within(list).getByRole('link', { name: 'City Hall' })).toHaveAttribute(
      'href',
      '/admin/facilities/city-hall?section=blackouts',
    );
    // Inherited and under way: nothing to delete here.
    expect(within(list).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('deletes a closure that has not started, after asking', async () => {
    await api.post('/admin/facilities/sicelo-hall/blackouts', {
      body: {
        startsAt: '2027-03-01T00:00:00Z',
        endsAt: '2027-03-02T00:00:00Z',
        allDay: true,
        reason: 'Painting',
      },
    });
    await openFacility('sicelo-hall', 'blackouts');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete closure: Painting' }));
    const confirm = await dialog();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete closure' }));
    expect(await screen.findByText('There are no current or upcoming closures.')).toBeVisible();
  });

  it.each(['America/Los_Angeles', 'Pacific/Auckland'])(
    'shows dates in the facility zone, not the system zone (%s)',
    async (zone) => {
      vi.stubEnv('TZ', zone);
      await api.post('/admin/facilities/sicelo-hall/blackouts', {
        body: {
          startsAt: '2027-02-28T22:00:00Z',
          endsAt: '2027-03-01T22:00:00Z',
          allDay: true,
          reason: 'Painting',
        },
      });
      await openFacility('sicelo-hall', 'blackouts');
      // 00:00 on 1 March in Johannesburg, whatever the machine thinks.
      expect(await screen.findByText('Mon 1 Mar 2027')).toBeVisible();
      vi.unstubAllEnvs();
    },
  );
});

describe('the schedule', () => {
  const hoursOf = (day: string) => ({
    opens: screen.getByLabelText(`${day} opens`) as HTMLInputElement,
    closes: screen.getByLabelText(`${day} closes`) as HTMLInputElement,
  });

  it('saves a change that affects nothing without a confirmation dialog', async () => {
    await openFacility('vaal-marina-hall', 'schedule');
    await screen.findByRole('list', { name: 'Operating hours' });
    set('Sunday closes', '23:30');
    await userEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
    expect(await screen.findByText('Schedule saved.')).toBeVisible();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('surfaces a booking left outside narrowed hours', async () => {
    await openFacility('vaal-marina-hall', 'schedule');
    await screen.findByRole('list', { name: 'Operating hours' });
    set('Wednesday closes', '22:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
    const confirm = await dialog();
    expect(affected(confirm)).toEqual(['MVL-2026-9206']);
    expect(within(confirm).getByText('Would fall outside the new operating hours.')).toBeVisible();
    expect(
      (
        await api.get<{ schedule: { days: Array<{ closesAt: string }> } }>(
          '/admin/facilities/vaal-marina-hall',
        )
      ).schedule.days[2]?.closesAt,
    ).toBe('23:00');
  });

  it('surfaces a conflict that did not exist when a buffer is increased', async () => {
    await openFacility('lakeside-hall', 'schedule');
    await screen.findByRole('list', { name: 'Operating hours' });
    await userEvent.clear(screen.getByLabelText(/^Set-up time before each booking/));
    await userEvent.type(screen.getByLabelText(/^Set-up time before each booking/), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
    const confirm = await dialog();
    expect(affected(confirm)).toEqual(['MVL-2026-9205']);
    expect(
      within(confirm).getByText(/Would now clash with MVL-2026-9204 at Lakeside Hall/),
    ).toBeVisible();

    await userEvent.click(
      within(confirm).getByRole('button', { name: 'Save and keep these bookings' }),
    );
    expect(await screen.findByText('Schedule saved.')).toBeVisible();
  });

  it('treats closed as a choice of its own, and copies one day to others', async () => {
    await openFacility('rothdene-hall', 'schedule');
    await screen.findByRole('list', { name: 'Operating hours' });
    set('Monday opens', '09:00');
    set('Monday closes', '15:00');

    await userEvent.click(screen.getByRole('button', { name: 'Copy Monday to other days' }));
    const copy = await screen.findByRole('dialog', { name: 'Copy Monday' });
    // Weekdays are the default targets for a weekday.
    expect(within(copy).getByRole('checkbox', { name: 'Tuesday' })).toBeChecked();
    expect(within(copy).getByRole('checkbox', { name: 'Saturday' })).not.toBeChecked();
    await userEvent.click(within(copy).getByRole('button', { name: 'Copy hours' }));

    expect(hoursOf('Friday').opens.value).toBe('09:00');
    expect(hoursOf('Friday').closes.value).toBe('15:00');
    expect(hoursOf('Saturday').opens.value).toBe('07:00');

    const closed = within(screen.getByRole('radiogroup', { name: 'Sunday is' })).getByRole(
      'radio',
      { name: 'Closed' },
    );
    await userEvent.click(closed);
    expect(screen.getByText('Closed all day')).toBeVisible();
    expect(screen.queryByLabelText('Sunday opens')).not.toBeInTheDocument();
  });

  it('refuses a closing time before the opening time, naming the day', async () => {
    await openFacility('rothdene-hall', 'schedule');
    await screen.findByRole('list', { name: 'Operating hours' });
    set('Tuesday opens', '18:00');
    set('Tuesday closes', '09:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
    expect(
      await screen.findByText('Tuesday: Closing time must be after opening time.'),
    ).toBeVisible();
  });
});

describe('capacity', () => {
  it('names bookings that now exceed a reduced capacity, and warns without blocking', async () => {
    await openFacility('rothdene-hall', 'capacity');
    const seats = await screen.findByLabelText(/^Seats for arrangement 2/);
    expect((screen.getByLabelText(/^Arrangement 2/) as HTMLSelectElement).value).toBe('Banquet');
    await userEvent.clear(seats);
    await userEvent.type(seats, '120');
    await userEvent.click(screen.getByRole('button', { name: 'Save capacity' }));

    const confirm = await dialog();
    expect(affected(confirm)).toEqual(['MVL-2026-9209']);
    expect(
      within(confirm).getByText('Expects more people than the new capacity allows.'),
    ).toBeVisible();
    await userEvent.click(
      within(confirm).getByRole('button', { name: 'Save and keep these bookings' }),
    );
    expect(await screen.findByText('Capacity saved.')).toBeVisible();
  });

  it('says so when capacity does not apply to the type', async () => {
    await api.post('/admin/facility-types', { body: { name: 'Park', capacityApplies: false } });
    await api.post('/admin/facilities', {
      body: {
        name: 'Town Park',
        code: 'PK-1',
        typeId: 'park',
        locality: 'Meyerton',
        shortDescription: 'A park.',
        description: '',
        parentFacilityId: null,
      },
    });
    await openFacility('town-park', 'capacity');
    expect(await screen.findByText(/Capacity does not apply to a park/)).toBeVisible();
  });
});

describe('details, status and archiving', () => {
  it('saves a change that affects nothing without a confirmation dialog', async () => {
    await openFacility('rothdene-hall');
    const short = await screen.findByLabelText(/^Short description/);
    await userEvent.clear(short);
    await userEvent.type(short, 'A hall for community events in Rothdene.');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Details saved.')).toBeVisible();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(
      (await api.get<{ shortDescription: string }>('/admin/facilities/rothdene-hall'))
        .shortDescription,
    ).toBe('A hall for community events in Rothdene.');
  });

  it('names the upcoming bookings when a facility is made unavailable', async () => {
    await openFacility('vaal-marina-hall');
    await userEvent.selectOptions(await screen.findByLabelText('Status'), 'unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    const confirm = await dialog();
    expect(affected(confirm)).toEqual(['MVL-2026-9207', 'MVL-2026-9206']);
    expect(
      within(confirm).getAllByText('The facility would no longer be available for it.'),
    ).toHaveLength(2);
  });

  it('lists the upcoming bookings when archiving, and the facility then leaves the public browse screen', async () => {
    const { router } = await openFacility('vaal-marina-board-room');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Archive Vaal Marina Board Room' }),
    );

    const confirm = await dialog();
    expect(affected(confirm)).toEqual(['MVL-2026-9208']);
    expect(
      within(confirm).getByText(/Archiving does not cancel or move these bookings/),
    ).toBeVisible();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Archive' }));
    expect(await screen.findByText('Vaal Marina Board Room archived.')).toBeVisible();
    expect(await screen.findByText('This facility is archived')).toBeVisible();

    await router.navigate('/facilities?q=marina');
    await screen.findByRole('link', { name: /Vaal Marina Hall/ });
    expect(screen.queryByRole('link', { name: /Vaal Marina Board Room/ })).not.toBeInTheDocument();
  });

  it('asks even when archiving reaches nothing, because the click is the decision', async () => {
    await openFacility('sicelo-hall');
    await userEvent.click(await screen.findByRole('button', { name: 'Archive Sicelo Hall' }));
    const confirm = await dialog();
    expect(within(confirm).getByText('No upcoming bookings are affected.')).toBeVisible();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Keep it' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect((await api.get<{ status: string }>('/admin/facilities/sicelo-hall')).status).toBe(
      'active',
    );
  });

  it('can be restored, and comes back unavailable', async () => {
    await api.post('/admin/facilities/vaal-marina-board-room/archive');
    await openFacility('vaal-marina-board-room');
    await userEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    expect(await screen.findByText(/Vaal Marina Board Room restored/)).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByText('This facility is archived')).not.toBeInTheDocument(),
    );
    expect(
      (await api.get<{ status: string }>('/admin/facilities/vaal-marina-board-room')).status,
    ).toBe('unavailable');
  });

  it('has no delete: archive is the only way out', async () => {
    await openFacility('rothdene-hall');
    await screen.findByRole('button', { name: 'Archive Rothdene Hall' });
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('will not activate a facility that has no approver', async () => {
    await api.post('/admin/facilities', {
      body: {
        name: 'Annex Room',
        code: 'ANX-1',
        typeId: 'committee-room',
        locality: 'Meyerton',
        shortDescription: 'A room.',
        description: '',
        parentFacilityId: null,
      },
    });
    await openFacility('annex-room');
    await userEvent.selectOptions(await screen.findByLabelText('Status'), 'active');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText(/Designate at least one approver/)).toBeVisible();
    expect((await api.get<{ status: string }>('/admin/facilities/annex-room')).status).toBe(
      'unavailable',
    );
  });
});

describe('approvers', () => {
  it('flags a facility with nobody, until someone is designated', async () => {
    await openFacility('activity-room', 'approvers');
    expect(await screen.findAllByText('Nobody approves for this facility')).not.toHaveLength(0);
    expect(
      within(screen.getByRole('navigation', { name: 'Facility sections' })).getByText('None'),
    ).toBeVisible();

    await userEvent.selectOptions(screen.getByLabelText('Add an approver'), 'approver-empty');
    await userEvent.click(screen.getByRole('button', { name: 'Add approver' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save approvers' }));
    expect(await screen.findByText('Approvers saved.')).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByText('Nobody approves for this facility')).not.toBeInTheDocument(),
    );
    const list = screen.getByRole('list', { name: 'Approvers' });
    expect(within(list).getByText('Lerato Sithole')).toBeVisible();
  });

  it('will not let the last approver go from an active facility', async () => {
    await openFacility('sicelo-hall', 'approvers');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Lerato Sithole' }));
    expect(screen.getByText(/An active facility needs at least one approver/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save approvers' })).toBeDisabled();
  });
});

describe('images', () => {
  const choose = async (name = 'hall.png') => {
    await screen.findByText(/This facility has no images yet/);
    await userEvent.upload(
      screen.getByLabelText('Add images'),
      new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' }),
    );
  };

  it('states the accepted types and the limit before a file is chosen', async () => {
    await openFacility('rothdene-hall', 'images');
    expect(await screen.findByText(/JPG, PNG, WebP, up to 5 MB each/)).toBeVisible();
    expect(screen.getByText(/up to 12 images/)).toBeVisible();
  });

  it('will not save an image without a caption', async () => {
    await openFacility('rothdene-hall', 'images');
    await choose();
    await userEvent.click(await screen.findByRole('button', { name: 'Upload hall.png' }));
    expect(
      await screen.findByText(
        'Describe the image. This text is read aloud to people who cannot see it.',
      ),
    ).toBeVisible();
    expect(
      (await api.get<{ images: unknown[] }>('/admin/facilities/rothdene-hall')).images,
    ).toEqual([]);
  });

  it('uploads with a caption, which becomes its alternative text, and the first is the main image', async () => {
    await openFacility('rothdene-hall', 'images');
    await choose();
    await userEvent.type(
      await screen.findByLabelText(/^Description of hall.png/),
      'The hall set for a wedding',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Upload hall.png' }));
    const picture = await screen.findByRole('img', { name: 'The hall set for a wedding' });
    expect(picture).toBeVisible();
    expect(screen.getByText('Main image')).toBeVisible();
  });

  it('keeps a file that fails, with a way to try again', async () => {
    await openFacility('rothdene-hall', 'images');
    await choose('fail.png');
    await userEvent.type(await screen.findByLabelText(/^Description of fail.png/), 'Will fail');
    await userEvent.click(screen.getByRole('button', { name: 'Upload fail.png' }));
    expect(await screen.findByText(/could not be stored/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry fail.png' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Remove fail.png' }));
    expect(screen.queryByText(/could not be stored/)).not.toBeInTheDocument();
  });

  it('refuses a file of the wrong type before it is uploaded', async () => {
    await openFacility('rothdene-hall', 'images');
    await screen.findByText(/This facility has no images yet/);
    fireEvent.change(screen.getByLabelText('Add images'), {
      target: { files: [new File(['x'], 'notes.pdf', { type: 'application/pdf' })] },
    });
    expect(await screen.findByText('notes.pdf is not an accepted type.')).toBeVisible();
  });

  it('reorders, changes the main image, recaptions (never blank) and removes', async () => {
    for (const [name, caption] of [
      ['a.png', 'First'],
      ['b.png', 'Second'],
    ] as const) {
      const body = new FormData();
      body.set('file', new File([new Uint8Array([1])], name, { type: 'image/png' }));
      body.set('caption', caption);
      await api.upload('/admin/facilities/rothdene-hall/images', body);
    }
    await openFacility('rothdene-hall', 'images');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Make Second the main image' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Make Second the main image' }),
      ).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Move Second earlier' }));
    await waitFor(() => {
      const items = within(screen.getByRole('list', { name: 'Images' })).getAllByRole('listitem');
      expect(within(items[0] as HTMLElement).getByRole('img', { name: 'Second' })).toBeVisible();
    });

    const first = screen.getByRole('img', { name: 'First' }).closest('li') as HTMLElement;
    const caption = within(first).getByLabelText(/^Description/);
    await userEvent.clear(caption);
    await userEvent.click(within(first).getByRole('button', { name: /^Save description/ }));
    expect(await within(first).findByText(/cannot be left without a description/)).toBeVisible();

    await userEvent.click(within(first).getByRole('button', { name: 'Remove First' }));
    const confirm = await dialog();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove image' }));
    await waitFor(() =>
      expect(screen.queryByRole('img', { name: 'First' })).not.toBeInTheDocument(),
    );
  });
});

describe('the sections', () => {
  it('are in the URL, so one can be linked and survives a reload', async () => {
    const first = await openFacility('rothdene-hall', 'schedule');
    expect(await screen.findByRole('heading', { level: 2, name: 'Schedule' })).toBeVisible();
    expect(within(await sectionsNav()).getByRole('link', { name: 'Schedule' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await userEvent.click(within(await sectionsNav()).getByRole('link', { name: 'Capacity' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Capacity' })).toBeVisible();
    expect(first.router.state.location.search).toBe('?section=capacity');
    first.unmount();

    // A fresh load of the address shows the same section.
    await openFacility('rothdene-hall', 'capacity');
    expect(await screen.findByRole('heading', { level: 2, name: 'Capacity' })).toBeVisible();
    expect(within(await sectionsNav()).getByRole('link', { name: 'Capacity' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('offers all seven, and links the resources that belong to the next slice', async () => {
    await openFacility('rothdene-hall');
    const nav = await sectionsNav();
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Details', 'Hierarchy', 'Images', 'Schedule', 'Blackouts', 'Capacity', 'Approvers']);
    expect(
      screen.getByRole('link', { name: /Manage the resources of this facility/ }),
    ).toHaveAttribute('href', '/admin/resources');
  });

  it('asks before unsaved edits are lost, and keeps them if the person stays', async () => {
    await openFacility('rothdene-hall');
    const short = await screen.findByLabelText(/^Short description/);
    await userEvent.type(short, ' More.');
    await userEvent.click(within(await sectionsNav()).getByRole('link', { name: 'Hierarchy' }));

    const ask = await dialog();
    expect(within(ask).getByText('Leave without saving?')).toBeVisible();
    await userEvent.click(within(ask).getByRole('button', { name: 'Stay here' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect((screen.getByLabelText(/^Short description/) as HTMLTextAreaElement).value).toContain(
      'More.',
    );

    await userEvent.click(within(await sectionsNav()).getByRole('link', { name: 'Hierarchy' }));
    await userEvent.click(
      within(await dialog()).getByRole('button', { name: 'Leave and discard' }),
    );
    expect(await screen.findByRole('heading', { level: 2, name: 'Hierarchy' })).toBeVisible();
  });

  it('says a facility is not found when the address is wrong', async () => {
    renderApp('/admin/facilities/nowhere');
    expect(await screen.findByText('We could not find that facility')).toBeVisible();
  });
});

describe('permissions', () => {
  it.each(['/admin/facilities', '/admin/facilities/new', '/admin/facilities/rothdene-hall'])(
    'keeps an applicant out of %s',
    async (path) => {
      mockMeRole(ROLES.applicant);
      renderApp(path);
      expect(await screen.findByText(/don.t have access|not allowed|permission/i)).toBeVisible();
      expect(screen.queryByRole('link', { name: 'Create facility' })).not.toBeInTheDocument();
    },
  );

  it('keeps an approver who is not an administrator out too', async () => {
    mockMeRole(ROLES.internal);
    renderApp('/admin/facilities');
    expect(await screen.findByText(/don.t have access|not allowed|permission/i)).toBeVisible();
  });

  it('lets a system administrator in, and lists the page in the navigation', async () => {
    mockMeRole(ROLES.systemAdmin);
    clerkState.getToken.mockImplementation(async () => 'user:mock-sysadmin');
    renderApp('/admin/facilities');
    await screen.findByRole('list', { name: 'Facilities' });
    expect(
      within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', {
        name: 'Manage facilities',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('refuses the API to someone who is not an administrator, whatever the screen shows', async () => {
    const applicant = createApiClient({
      baseUrl: TEST_API_BASE_URL,
      getToken: async () => 'user:applicant-thandi',
    });
    await expect(applicant.get('/admin/facilities')).rejects.toMatchObject({ status: 403 });
  });
});

describe('what the public then sees', () => {
  it('a new blackout closes the day on the availability calendar, with its reason', async () => {
    await openFacility('rothdene-hall', 'blackouts');
    await screen.findByRole('heading', { name: 'Add a closure' });
    set(/^First day/, '2027-02-01');
    set(/^Last day/, '2027-02-01');
    await userEvent.type(screen.getByLabelText(/^Reason/), 'Closed for the annual inspection.');
    await userEvent.click(screen.getByRole('button', { name: 'Add closure' }));
    await screen.findByText('Closure added.');

    const result = await api.get<{ days: Array<{ status: string; closedReason: string | null }> }>(
      '/facilities/rothdene-hall/availability',
      { query: { from: '2027-02-01', to: '2027-02-01' } },
    );
    expect(result.days[0]).toMatchObject({
      status: 'closed',
      closedReason: 'Closed for the annual inspection.',
    });
  });
});
