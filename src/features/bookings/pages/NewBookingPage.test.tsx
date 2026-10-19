import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import { createApiClient, type Booking } from '@/shared/api';
import { ROLES } from '@/shared/auth';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, MOBILE_WIDTH, setViewportWidth } from '@/test/viewport';
import { TERMS_VERSION } from '@/mocks/data/bookingOptions';

const API = TEST_API_BASE_URL;
const api = createApiClient({ baseUrl: API, getToken: async () => null });

// The test clock is Monday 2 November 2026. Tuesday 24 November is in the completely free week;
// 09:00 to 12:00 in Johannesburg is 07:00 to 10:00 UTC.
const FREE = { startsAt: '2026-11-24T07:00:00Z', endsAt: '2026-11-24T10:00:00Z' };
const params = (facilityId: string, slot = FREE) =>
  `?facilityId=${facilityId}&startsAt=${encodeURIComponent(slot.startsAt)}&endsAt=${encodeURIComponent(slot.endsAt)}`;
const ROTHDENE = `/bookings/new${params('rothdene-hall')}`;

beforeEach(() => {
  mockMeRole(ROLES.applicant);
  setViewportWidth(DESKTOP_WIDTH);
});

const stepHeading = (name: string) => screen.findByRole('heading', { level: 2, name });
const press = (name: string) => userEvent.click(screen.getByRole('button', { name }));
const next = () => press('Continue');
const select = (label: string, option: string) =>
  userEvent.selectOptions(screen.getByLabelText(new RegExp(`^${label}`)), option);

async function fillDetails(over: { attendees?: string; arrangement?: string } = {}) {
  await select('Type of meeting or event', 'Meeting');
  await userEvent.type(screen.getByLabelText(/^Event description/), 'A community meeting');
  await select('Seating arrangement', over.arrangement ?? 'Cinema');
  await userEvent.type(screen.getByLabelText(/^Expected attendees/), over.attendees ?? '40');
}

/** Opens the form on a free slot and moves through to the review step. */
async function toReview(path = ROTHDENE) {
  const view = renderApp(path);
  await stepHeading('When and where');
  await screen.findByText('This time is still available.');
  await next();
  await stepHeading('Event details');
  await fillDetails();
  await next();
  await stepHeading('Resources');
  await next();
  await stepHeading('Documents');
  await next();
  await stepHeading('Review and submit');
  return view;
}

describe('step 1: when and where', () => {
  it('confirms the facility and window from the URL, read in the facility time zone', async () => {
    renderApp(ROTHDENE);
    await stepHeading('When and where');

    const summary = screen.getByRole('region', { name: 'Your request' });
    expect(await within(summary).findByRole('link', { name: 'Rothdene Hall' })).toBeVisible();
    expect(within(summary).getByText('Tuesday 24 November 2026')).toBeVisible();
    expect(
      await within(summary).findByText('09:00 to 12:00 (Africa/Johannesburg time)'),
    ).toBeVisible();
    expect(await screen.findByText('This time is still available.')).toBeVisible();
    // A confirmation, not a form: no inputs for the date or time.
    expect(within(summary).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it.each(['America/Los_Angeles', 'Pacific/Auckland'])(
    'reads the instants in the facility zone, not the system zone (%s)',
    async (zone) => {
      vi.stubEnv('TZ', zone);
      renderApp(ROTHDENE);
      expect(await screen.findByText('09:00 to 12:00 (Africa/Johannesburg time)')).toBeVisible();
      vi.unstubAllEnvs();
    },
  );

  it('offers a facility picker, not a date picker, when there are no parameters', async () => {
    renderApp('/bookings/new');
    await stepHeading('When and where');

    const venues = await screen.findByRole('list', { name: 'Venues' });
    expect(within(venues).getAllByRole('link')).toHaveLength(12);
    expect(within(venues).getByRole('link', { name: /Rothdene Hall/ })).toHaveAttribute(
      'href',
      '/facilities/rothdene-hall',
    );
    expect(document.querySelector('input[type="date"], input[type="time"]')).toBeNull();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search venues' }), 'marina');
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Venues' })).getAllByRole('link'),
      ).toHaveLength(2),
    );

    await next();
    expect(await screen.findByRole('link', { name: 'Choose a facility.' })).toBeVisible();
  });

  it('says at once when the slot has been taken, and blocks going on', async () => {
    // City Hall is booked all day on Friday 20 November.
    renderApp(
      `/bookings/new${params('city-hall', { startsAt: '2026-11-20T07:00:00Z', endsAt: '2026-11-20T10:00:00Z' })}`,
    );
    await stepHeading('When and where');

    expect(await screen.findByText('This time is no longer available')).toBeVisible();
    const choose = screen.getAllByRole('link', { name: 'Choose another time' })[0] as HTMLElement;
    expect(choose.getAttribute('href')).toContain('/facilities/city-hall?');
    expect(choose.getAttribute('href')).toContain('date=2026-11-20');

    await next();
    expect(screen.getByRole('heading', { level: 2, name: 'When and where' })).toBeVisible();
    expect(
      await screen.findByRole('link', { name: /overlaps time that is unavailable/ }),
    ).toBeVisible();
  });

  it('states what the request covers where there is a hierarchy', async () => {
    renderApp(`/bookings/new${params('city-hall')}`);
    const note = await screen.findByText(/^This request covers City Hall, which includes /);
    for (const name of ['Mitchell Wing', 'Loch Wing', 'City Hall Committee Room']) {
      expect(note).toHaveTextContent(name);
    }
    expect(note).toHaveTextContent('Booking the whole venue takes all of them.');
  });

  it('says what a child request means for its building', async () => {
    renderApp(`/bookings/new${params('mitchell-wing')}`);
    expect(await screen.findByText(/Mitchell Wing is part of City Hall/)).toBeVisible();
  });

  it('returns to the calendar with the current selection intact', async () => {
    renderApp(ROTHDENE);
    const change = await screen.findByRole('link', { name: 'Change venue or time' });
    const url = new URL(change.getAttribute('href') ?? '', 'http://x');
    expect(url.pathname).toBe('/facilities/rothdene-hall');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      month: '2026-11',
      date: '2026-11-24',
      startsAt: FREE.startsAt,
      endsAt: FREE.endsAt,
    });
  });
});

describe('step 2: event details', () => {
  it('shows a summary of problems, moves focus to it and links each to its field', async () => {
    renderApp(ROTHDENE);
    await screen.findByText('This time is still available.');
    await next();
    await stepHeading('Event details');
    await next();

    const box = (
      await screen.findByRole('heading', { name: 'There is a problem with your request' })
    ).closest('div') as HTMLElement;
    expect(box).toHaveFocus();
    expect(
      within(box)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual([
      'Choose the type of meeting or event.',
      'Describe the event.',
      'Enter the number of people expected.',
      'Choose a seating arrangement.',
    ]);

    await userEvent.click(within(box).getByRole('link', { name: 'Describe the event.' }));
    expect(screen.getByLabelText(/^Event description/)).toHaveFocus();
    expect(screen.getByLabelText(/^Event description/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Event description/)).toHaveAccessibleDescription(
      /Describe the event\./,
    );
  });

  it('validates on blur and clears the error as the field is fixed', async () => {
    renderApp(`/bookings/new${params('rothdene-hall')}&step=details`);
    await stepHeading('Event details');
    const attendees = screen.getByLabelText(/^Expected attendees/);

    await userEvent.type(attendees, 'abc');
    await userEvent.tab();
    expect(await screen.findByText('Enter a whole number, such as 40.')).toBeVisible();

    await userEvent.clear(attendees);
    await userEvent.type(attendees, '40');
    await waitFor(() =>
      expect(screen.queryByText('Enter a whole number, such as 40.')).not.toBeInTheDocument(),
    );
  });

  it('counts characters in the description', async () => {
    renderApp(`/bookings/new${params('rothdene-hall')}&step=details`);
    await stepHeading('Event details');
    await userEvent.type(screen.getByLabelText(/^Event description/), 'Hello');
    expect(screen.getByText('5 of 1000 characters')).toBeVisible();
  });

  it('warns, without blocking, when attendees exceed the arrangement capacity and names both figures', async () => {
    renderApp(`/bookings/new${params('rothdene-hall')}&step=details`);
    await stepHeading('Event details');
    await fillDetails({ arrangement: 'Banquet', attendees: '200' });

    // Rothdene Hall is listed for 250 cinema, which is 150 at banquet seating.
    const warning = await screen.findByText(
      /You expect 200 people, but banquet seating at Rothdene Hall lists 150/,
    );
    expect(warning).toBeVisible();
    await next();
    expect(await stepHeading('Resources')).toBeVisible();
  });
});

const resourcesReady = () => screen.findByRole('group', { name: 'Venue resources' });

describe('step 3: resources', () => {
  it('starts with everything off, reveals a quantity on selection and counts what is selected', async () => {
    renderApp(`/bookings/new${params('rothdene-hall')}&step=resources`);
    await stepHeading('Resources');
    await resourcesReady();

    expect(screen.getByText('No resources requested yet.')).toBeVisible();
    expect(screen.queryByRole('textbox', { name: /quantity/ })).not.toBeInTheDocument();
    const venue = screen.getByRole('group', { name: 'Venue resources' });
    for (const name of ['Tables', 'Chairs', 'Stage', 'Podium', 'Sound system']) {
      expect(within(venue).getByRole('checkbox', { name })).not.toBeChecked();
    }

    await userEvent.click(within(venue).getByRole('checkbox', { name: 'Chairs' }));
    expect(screen.getByRole('textbox', { name: 'Chairs quantity' })).toHaveValue('1');
    expect(screen.getByText('1 item selected')).toBeVisible();
  });

  it('keeps the kitchen behind a closed disclosure, summarised, with all fourteen items', async () => {
    renderApp(`/bookings/new${params('rothdene-hall')}&step=resources`);
    await stepHeading('Resources');
    await resourcesReady();

    const toggle = screen.getByRole('button', { name: 'Kitchen resources, none selected' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('checkbox', { name: 'Cups' })).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const kitchen = screen.getByRole('group', { name: 'Kitchen resources' });
    expect(
      within(kitchen)
        .getAllByRole('checkbox')
        .map((c) => c.getAttribute('id')),
    ).toHaveLength(14);
    expect(
      within(kitchen)
        .getAllByRole('checkbox')
        .map((c) => ((c as HTMLInputElement).labels?.[0]?.textContent ?? '').trim()),
    ).toEqual([
      'Cups',
      'Teaspoons',
      'Sugar bowls',
      'Glasses',
      'Jugs',
      'Milk jugs',
      'Water jars',
      'Dining forks',
      'Urn',
      'Side plates',
      'Dinner plates',
      'Knives',
      'Forks',
      'Bowls',
    ]);

    await userEvent.click(within(kitchen).getByRole('checkbox', { name: 'Cups' }));
    expect(screen.getByRole('textbox', { name: 'Cups quantity' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Kitchen resources, 1 selected' })).toBeVisible();
    expect(screen.getByText('1 item selected')).toBeVisible();

    await userEvent.click(within(kitchen).getByRole('checkbox', { name: 'Urn' }));
    expect(screen.getByText('2 items selected')).toBeVisible();
  });

  it('steps with buttons and the keyboard, and caps at what the venue holds', async () => {
    renderApp(`/bookings/new${params('rothdene-hall')}&step=resources`);
    await stepHeading('Resources');
    await resourcesReady();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chairs' }));

    const quantity = screen.getByRole('textbox', { name: 'Chairs quantity' });
    await userEvent.click(screen.getByRole('button', { name: 'Increase Chairs' }));
    expect(quantity).toHaveValue('2');
    quantity.focus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowDown}');
    expect(quantity).toHaveValue('3');

    // Rothdene Hall is listed with 250 chairs.
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '999');
    await userEvent.tab();
    expect(quantity).toHaveValue('250');
    expect(screen.getByText('Only 250 available, so the quantity was set to 250.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Increase Chairs' })).toBeDisabled();
  });

  it('disables a resource the venue does not list, and says so', async () => {
    renderApp(`/bookings/new${params('vaal-marina-board-room')}&step=resources`);
    await stepHeading('Resources');
    await resourcesReady();
    expect(screen.getByRole('checkbox', { name: 'Stage' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Stage' })).toHaveAccessibleDescription(
      'Not listed for this venue.',
    );
  });
});

describe('step 4: documents', () => {
  const file = (name: string, size = 20) => new File([new Uint8Array(size)], name);

  it('states the accepted types and limits before anything is picked', async () => {
    renderApp(`/bookings/new${params('rothdene-hall')}&step=documents`);
    await stepHeading('Documents');
    expect(
      screen.getByText(
        /Accepted: PDF, JPEG, PNG, Word, Excel\. Up to 10 MB each, and at most 5 files\./,
      ),
    ).toBeVisible();
    expect(screen.getByLabelText('Choose files')).toHaveAccessibleDescription(/Accepted: PDF/);
  });

  it('creates the draft silently on the first upload, shows progress and keeps the file', async () => {
    server.use(
      http.post(`${API}/bookings/:id/documents`, async () => {
        await delay(250);
        return HttpResponse.json(
          {
            id: 'doc-1',
            name: 'plan.pdf',
            sizeBytes: 20,
            contentType: 'application/pdf',
            uploadedAt: '2026-11-02T08:00:00Z',
          },
          { status: 201 },
        );
      }),
    );
    const { router } = renderApp(`/bookings/new${params('rothdene-hall')}&step=documents`);
    await stepHeading('Documents');
    expect(new URLSearchParams(router.state.location.search).get('draft')).toBeNull();

    await userEvent.upload(screen.getByLabelText('Choose files'), file('plan.pdf'));
    expect(await screen.findByRole('progressbar', { name: 'Uploading plan.pdf' })).toBeVisible();
    expect(await screen.findByText('Uploaded')).toBeVisible();
    expect(new URLSearchParams(router.state.location.search).get('draft')).toMatch(/^bk-/);
  });

  it('refuses a file of the wrong type before uploading it', async () => {
    renderApp(`/bookings/new${params('rothdene-hall')}&step=documents`);
    await stepHeading('Documents');
    // `applyAccept: false` lets the test pick a file the input would normally filter out.
    await userEvent
      .setup({ applyAccept: false })
      .upload(screen.getByLabelText('Choose files'), file('virus.exe'));
    expect(await screen.findByText('virus.exe is not an accepted type.')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Attached documents' })).not.toBeInTheDocument();
  });

  it('shows a failed upload with its reason, and lets it be retried or removed', async () => {
    renderApp(`/bookings/new${params('rothdene-hall')}&step=documents`);
    await stepHeading('Documents');
    await userEvent.upload(screen.getByLabelText('Choose files'), file('will-fail.pdf'));

    expect(
      await screen.findByText('Upload failed: The file could not be stored. Please try again.'),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Retry will-fail.pdf' }));
    expect(await screen.findByText(/Upload failed/)).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Remove will-fail.pdf' }));
    expect(screen.queryByText('will-fail.pdf')).not.toBeInTheDocument();
  });

  it('removes an uploaded document from the draft', async () => {
    const { router } = renderApp(`/bookings/new${params('rothdene-hall')}&step=documents`);
    await stepHeading('Documents');
    await userEvent.upload(screen.getByLabelText('Choose files'), file('plan.pdf'));
    await screen.findByText('Uploaded');
    const id = new URLSearchParams(router.state.location.search).get('draft') ?? '';

    await userEvent.click(screen.getByRole('button', { name: 'Remove plan.pdf' }));
    await waitFor(() => expect(screen.queryByText('plan.pdf')).not.toBeInTheDocument());
    expect((await api.get<Booking>(`/bookings/${id}`)).documents).toHaveLength(0);
  });
});

describe('drafts', () => {
  it('saves when moving between steps, and reloading resumes at the same step with answers intact', async () => {
    const { router, unmount } = renderApp(ROTHDENE);
    await screen.findByText('This time is still available.');
    await next();
    await stepHeading('Event details');
    await fillDetails();
    await next();
    await stepHeading('Resources');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chairs' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Chairs quantity' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Chairs quantity' }), '40');
    await userEvent.tab();
    await next();
    await stepHeading('Documents');
    expect(await screen.findByText(/Draft saved at \d\d:\d\d/)).toBeVisible();

    const search = router.state.location.search;
    const draft = new URLSearchParams(search).get('draft');
    expect(draft).toMatch(/^bk-/);
    expect(new URLSearchParams(search).get('step')).toBe('documents');
    unmount();

    // A fresh load of the same URL.
    renderApp(`/bookings/new${search}`);
    await stepHeading('Documents');
    await userEvent.click(screen.getByRole('button', { name: /Step 2: Event details/ }));
    await stepHeading('Event details');
    expect(screen.getByLabelText(/^Event description/)).toHaveValue('A community meeting');
    expect(screen.getByLabelText(/^Expected attendees/)).toHaveValue('40');
    expect(screen.getByLabelText(/^Type of meeting or event/)).toHaveValue('meeting');
    await userEvent.click(screen.getByRole('button', { name: /Step 3: Resources/ }));
    await stepHeading('Resources');
    expect(screen.getByRole('textbox', { name: 'Chairs quantity' })).toHaveValue('40');
  });

  it('autosaves while typing, after a pause', async () => {
    renderApp(`/bookings/new${params('rothdene-hall')}&step=details`);
    await stepHeading('Event details');
    await userEvent.type(screen.getByLabelText(/^Event description/), 'Typing and then pausing');
    expect(await screen.findByText(/Draft saved at/, {}, { timeout: 4000 })).toBeVisible();
  });

  it('opens a draft with its details complete on the review step', async () => {
    const draft = await api.post<Booking>('/bookings', {
      body: { facilityId: 'rothdene-hall', ...FREE },
    });
    await api.patch(`/bookings/${draft.id}`, {
      body: {
        eventTypeId: 'meeting',
        description: 'Resumed',
        attendeeCount: 20,
        seatingArrangementId: 'cinema',
      },
    });
    renderApp(`/bookings/new?draft=${draft.id}`);
    expect(await stepHeading('Review and submit')).toBeVisible();
    expect(screen.getByText('Resumed')).toBeVisible();
  });

  it('opens an unfinished draft on the details step', async () => {
    const draft = await api.post<Booking>('/bookings', {
      body: { facilityId: 'rothdene-hall', ...FREE },
    });
    renderApp(`/bookings/new?draft=${draft.id}`);
    expect(await stepHeading('Event details')).toBeVisible();
  });

  it('says where the draft is when saving to finish later', async () => {
    renderApp(`/bookings/new${params('rothdene-hall')}&step=details`);
    await stepHeading('Event details');
    await fillDetails();
    await press('Save and finish later');
    expect(await screen.findByText('Your request is saved as a draft')).toBeVisible();
    expect(screen.getByText(/\/bookings\/new\?draft=bk-\d+&step=details/)).toBeVisible();
    await press('Continue editing');
    expect(await stepHeading('Event details')).toBeVisible();
  });

  it('shows a not found state for a draft that does not exist', async () => {
    renderApp('/bookings/new?draft=nope');
    expect(await screen.findByText('We could not find that draft')).toBeVisible();
  });
});

describe('stepper and focus', () => {
  it('moves focus to the new step heading, announces it, and states each step in text', async () => {
    renderApp(ROTHDENE);
    await screen.findByText('This time is still available.');
    const stepper = screen.getByRole('navigation', { name: 'Progress' });
    expect(within(stepper).getByText('Step 1: When and where, current step')).toBeInTheDocument();
    expect(within(stepper).getByText('Step 4: Documents, not started')).toBeInTheDocument();

    await next();
    const heading = await stepHeading('Event details');
    expect(heading).toHaveFocus();
    expect(screen.getByText('Step 2 of 5: Event details')).toBeInTheDocument();
    expect(within(stepper).getByText('Step 1: When and where, completed')).toBeInTheDocument();
    expect(within(stepper).getByRole('button', { name: /Step 1: When and where/ })).toBeVisible();
    // Later steps cannot be reached until visited.
    expect(within(stepper).queryByRole('button', { name: /Step 5/ })).not.toBeInTheDocument();
  });

  it('can be driven from the keyboard', async () => {
    renderApp(ROTHDENE);
    await screen.findByText('This time is still available.');
    screen.getByRole('button', { name: 'Continue' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(await stepHeading('Event details')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText(/^Type of meeting or event/)).toHaveFocus();
  });
});

describe('step 5: review and submit', () => {
  it('summarises every answer with an edit action that returns to the field', async () => {
    await toReview();
    const list = document.querySelector('dl') as HTMLElement;
    expect(within(list).getByText('Rothdene Hall')).toBeVisible();
    expect(within(list).getByText('Tuesday 24 November 2026')).toBeVisible();
    expect(within(list).getByText('09:00 to 12:00 (Africa/Johannesburg time)')).toBeVisible();
    expect(within(list).getByText('Meeting')).toBeVisible();
    expect(within(list).getByText('A community meeting')).toBeVisible();
    expect(within(list).getByText('40')).toBeVisible();
    expect(within(list).getByText('Cinema')).toBeVisible();

    await press('Edit Event description');
    await stepHeading('Event details');
    expect(screen.getByLabelText(/^Event description/)).toHaveFocus();
  });

  it('blocks submission until the terms are accepted, and says why', async () => {
    const { router } = await toReview();
    await press('Submit request');

    expect(
      await screen.findByRole('link', {
        name: 'You must accept the terms and conditions before you can submit.',
      }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/bookings/new');
    expect(screen.getByLabelText(/I accept the terms and conditions/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('has the terms behind a disclosure and records the accepted version', async () => {
    const { router } = await toReview();
    const toggle = screen.getByRole('button', { name: 'Read the terms and conditions' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByText(/placeholder wording/)).toBeVisible();

    await userEvent.click(screen.getByLabelText(/I accept the terms and conditions/));
    await press('Submit request');
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/bookings\/bk-\d+\/confirmation$/),
    );

    const id = router.state.location.pathname.split('/')[2] ?? '';
    expect(await api.get<Booking>(`/bookings/${id}`)).toMatchObject({
      status: 'pending',
      acceptedTermsVersion: TERMS_VERSION,
    });
  });

  it('shows the confirmation at its own URL, and it survives a reload', async () => {
    const { router, unmount } = await toReview();
    await userEvent.click(screen.getByLabelText(/I accept the terms and conditions/));
    await press('Submit request');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your request has been received' }),
    ).toBeVisible();
    expect(screen.getByText(/^MVL-2026-\d{5}$/)).toBeVisible();
    expect(screen.getByText('Status: Pending')).toBeVisible();
    expect(
      screen.getByText('Your request is not confirmed until it has been approved.'),
    ).toBeVisible();
    expect(screen.getByText(/within 5 working days/)).toBeVisible();
    expect(screen.getByText('Rothdene Hall')).toBeVisible();
    expect(screen.getByRole('link', { name: 'View this booking' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse venues' })).toHaveAttribute(
      'href',
      '/facilities',
    );

    const path = router.state.location.pathname;
    unmount();
    renderApp(path);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your request has been received' }),
    ).toBeVisible();
    expect(screen.getByText(/^MVL-2026-\d{5}$/)).toBeVisible();
  });

  it('submits once even if the button is pressed repeatedly', async () => {
    let submissions = 0;
    const listener = ({ request }: { request: Request }) => {
      if (request.method === 'POST' && request.url.endsWith('/submit')) submissions += 1;
    };
    server.events.on('request:start', listener);
    try {
      await toReview();
      await userEvent.click(screen.getByLabelText(/I accept the terms and conditions/));
      const submit = screen.getByRole('button', { name: 'Submit request' });
      await Promise.all([
        userEvent.click(submit),
        userEvent.click(submit),
        userEvent.click(submit),
      ]);
      await screen.findByRole('heading', { level: 1, name: 'Your request has been received' });
      expect(submissions).toBe(1);
    } finally {
      server.events.removeListener('request:start', listener);
    }
  });

  it('puts a server side field error on the matching field', async () => {
    server.use(
      http.post(`${API}/bookings/:id/submit`, () =>
        HttpResponse.json(
          {
            title: 'Validation failed',
            status: 422,
            errors: { description: ['The server did not like this description.'] },
          },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    await toReview();
    await userEvent.click(screen.getByLabelText(/I accept the terms and conditions/));
    await press('Submit request');

    await stepHeading('Event details');
    const description = screen.getByLabelText(/^Event description/);
    expect(description).toHaveAttribute('aria-invalid', 'true');
    expect(description).toHaveAccessibleDescription(/The server did not like this description\./);
    // The answer itself is untouched.
    expect(description).toHaveValue('A community meeting');
    expect(
      screen.getByRole('link', { name: 'The server did not like this description.' }),
    ).toBeVisible();
  });

  it('shows no fee, deposit or payment anywhere in the form', async () => {
    await toReview();
    expect(document.body.textContent).not.toMatch(
      /\b(fee|fees|deposit|payment|pay|invoice|price|cost)\b/i,
    );
  });
});

describe('a slot taken before submission', () => {
  /** Another applicant submits first for the same slot, after this form passed its checks. */
  async function competitor(facilityId: string) {
    const draft = await api.post<Booking>('/bookings', { body: { facilityId, ...FREE } });
    await api.patch(`/bookings/${draft.id}`, {
      body: {
        eventTypeId: 'meeting',
        description: 'The other applicant',
        attendeeCount: 10,
        seatingArrangementId: 'cinema',
        acceptedTermsVersion: TERMS_VERSION,
      },
    });
    await api.post(`/bookings/${draft.id}/submit`);
  }

  it('explains the conflict specifically, loses no answers and offers the way back', async () => {
    const { router } = await toReview();
    await competitor('rothdene-hall');
    await userEvent.click(screen.getByLabelText(/I accept the terms and conditions/));
    await press('Submit request');

    const notice = await screen.findByText('That time is no longer available', { selector: 'p' });
    const alert = notice.closest('[role="alert"]') as HTMLElement;
    expect(
      within(alert).getByText(/Someone else has now booked or is holding 09:00 to 12:00/),
    ).toBeVisible();
    expect(within(alert).getByText(/Nothing you entered has been lost/)).toBeVisible();
    expect(router.state.location.pathname).toBe('/bookings/new');
    // Not a generic error.
    expect(screen.queryByText('We could not submit your request')).not.toBeInTheDocument();

    // Every answer is still there.
    await press('Edit Event description');
    await stepHeading('Event details');
    expect(screen.getByLabelText(/^Event description/)).toHaveValue('A community meeting');
    expect(screen.getByLabelText(/^Expected attendees/)).toHaveValue('40');

    const back = within(alert).getByRole('link', { name: 'Choose another time' });
    const url = new URL(back.getAttribute('href') ?? '', 'http://x');
    expect(url.pathname).toBe('/facilities/rothdene-hall');
    expect(url.searchParams.get('draft')).toMatch(/^bk-/);
  });

  it('names the related facility when the building causes the conflict', async () => {
    await toReview(`/bookings/new${params('mitchell-wing')}`);
    await competitor('city-hall');
    await userEvent.click(screen.getByLabelText(/I accept the terms and conditions/));
    await press('Submit request');

    expect(
      await screen.findByText(
        /City Hall contains this space and is now booked from 09:00 to 12:00, which blocks your request\./,
      ),
    ).toBeVisible();
  });

  it('carries the draft back to the form with a new slot, answers intact', async () => {
    const { router } = await toReview();
    await competitor('rothdene-hall');
    await userEvent.click(screen.getByLabelText(/I accept the terms and conditions/));
    await press('Submit request');
    const notice = await screen.findByText('That time is no longer available', { selector: 'p' });
    const back = within(notice.closest('[role="alert"]') as HTMLElement).getByRole('link', {
      name: 'Choose another time',
    });
    await userEvent.click(back);
    // The calendar opens on the day that was taken; close its panel to choose another.
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');

    // On the calendar, choose Wednesday 25 November 09:00 to 12:00 and request again.
    await userEvent.click(await screen.findByRole('button', { name: /^Wednesday 25 November/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText('Start time'), '09:00');
    await userEvent.selectOptions(within(dialog).getByLabelText('End time'), '12:00');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await userEvent.click(screen.getByRole('link', { name: 'Request booking' }));

    expect(router.state.location.pathname).toBe('/bookings/new');
    const search = new URLSearchParams(router.state.location.search);
    expect(search.get('draft')).toMatch(/^bk-/);
    expect(search.get('startsAt')).toBe('2026-11-25T07:00:00Z');

    await stepHeading('When and where');
    expect(await screen.findByText('Wednesday 25 November 2026')).toBeVisible();
    await screen.findByText('This time is still available.');
    await next();
    await stepHeading('Event details');
    expect(screen.getByLabelText(/^Event description/)).toHaveValue('A community meeting');
  });
});

describe('the whole journey', () => {
  it('goes from browsing to a confirmed reference: detail, calendar, select, five steps, submit', async () => {
    const { router } = renderApp('/facilities?q=rothdene');
    await userEvent.click(await screen.findByRole('link', { name: 'Rothdene Hall' }));
    await screen.findByRole('heading', { level: 1, name: 'Rothdene Hall' });

    await userEvent.click(await screen.findByRole('button', { name: /^Tuesday 24 November/ }));
    const panel = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(panel).getByLabelText('Start time'), '09:00');
    await userEvent.selectOptions(within(panel).getByLabelText('End time'), '12:00');
    await userEvent.click(within(panel).getByRole('button', { name: 'Done' }));
    await userEvent.click(screen.getByRole('link', { name: 'Request booking' }));

    await stepHeading('When and where');
    expect(await screen.findByText('This time is still available.')).toBeVisible();
    await next();
    await stepHeading('Event details');
    await fillDetails();
    await next();
    await stepHeading('Resources');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Chairs' }));
    await next();
    await stepHeading('Documents');
    await next();
    await stepHeading('Review and submit');
    expect(await screen.findByText('Chairs × 1')).toBeVisible();
    await userEvent.click(screen.getByLabelText(/I accept the terms and conditions/));
    await press('Submit request');

    expect(await screen.findByText(/^MVL-2026-\d{5}$/)).toBeVisible();
    expect(router.state.location.pathname).toMatch(/^\/bookings\/bk-\d+\/confirmation$/);

    // The submitted request now holds the slot on the calendar.
    await userEvent.click(screen.getByRole('link', { name: 'Browse venues' }));
    await userEvent.click(await screen.findByRole('link', { name: /Rothdene Hall/ }));
    expect(
      await screen.findByRole('button', {
        name: /^Tuesday 24 November, partly available, held pending a request$/,
      }),
    ).toBeVisible();
  });
});

describe('on a small screen', () => {
  it('works through the steps and keeps the resource steppers and upload usable', async () => {
    setViewportWidth(MOBILE_WIDTH);
    renderApp(ROTHDENE);
    await screen.findByText('This time is still available.');
    await next();
    await stepHeading('Event details');
    await fillDetails();
    await next();
    await stepHeading('Resources');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Tables' }));
    expect(screen.getByRole('button', { name: 'Increase Tables' })).toBeVisible();
    await next();
    await stepHeading('Documents');
    expect(screen.getByLabelText('Choose files')).toBeInTheDocument();
  });
});

describe('the confirmation page', () => {
  it('shows a not found state for an unknown booking', async () => {
    renderApp('/bookings/nope/confirmation');
    expect(await screen.findByText('We could not find that booking')).toBeVisible();
  });

  it('sends an unsubmitted draft back to its form', async () => {
    const draft = await api.post<Booking>('/bookings', {
      body: { facilityId: 'rothdene-hall', ...FREE },
    });
    const { router } = renderApp(`/bookings/${draft.id}/confirmation`);
    await stepHeading('Review and submit');
    expect(router.state.location.pathname).toBe('/bookings/new');
  });
});
