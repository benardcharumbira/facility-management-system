# Facilities Booking – Frontend

Frontend for the municipal Facilities Booking Management System. Members of the public and
staff request bookings for public facilities; a booking is routed to a designated approver and
approved or rejected. This repository currently contains the application shell (slice 1) and the facilities browse
screen (slice 2). Everything else is still a placeholder.

## Prerequisites

- Node.js 24 (see `.nvmrc`; 22.22+ also works). `nvm use` picks the right version.
- npm 10+
- A [Clerk](https://clerk.com) application (a free development instance is enough) for the
  publishable key. Clerk handles sign in and sign up; the app never stores credentials.

## Setup

```bash
git clone <repo-url> && cd facility-management-system
npm install
cp .env.example .env     # then set VITE_CLERK_PUBLISHABLE_KEY
npm run dev
```

Open the URL Vite prints. With `VITE_ENABLE_API_MOCKING=true` (the default in `.env.example`) no
backend is needed. Sign in or sign up through Clerk and you land on the page for your role.

`npm install` also installs the pre-commit hook (via the `prepare` script).

## Environment variables

Parsed and validated with Zod at startup (`src/app/env.ts`). A missing or invalid value stops the
app with a message naming the variable. Never commit `.env`; `.env.example` is the template.

| Variable                     | Required | Description                                                                                                        |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL`          | yes      | Absolute base URL of the backend API, e.g. `http://localhost:5000/api`.                                            |
| `VITE_CLERK_PUBLISHABLE_KEY` | yes      | Clerk publishable key, starts with `pk_`.                                                                          |
| `VITE_ENABLE_API_MOCKING`    | no       | `true` serves the API from MSW, `false` calls the real API. Default `false`.                                       |
| `VITE_MOCK_ROLE`             | no       | Role the mocked `GET /me` returns: `applicant`, `internal`, `facility_admin`, `system_admin`. Default `applicant`. |

Restart `npm run dev` after changing `.env`.

## Mocked vs real API

Switching is one variable:

- **Mocked:** `VITE_ENABLE_API_MOCKING=true`. A service worker (`public/mockServiceWorker.js`)
  intercepts requests to `VITE_API_BASE_URL`. Handlers live in `src/mocks` (`GET /me` and the
  facilities endpoints, backed by the fixtures described below). Filtering, search,
  sorting and pagination run in the handler, not the client. Responses are delayed 600ms in
  development so loading states are visible. Change
  `VITE_MOCK_ROLE` to see the navigation for each role. Requests with no handler (such as Clerk's)
  pass through untouched.
- **Real:** `VITE_ENABLE_API_MOCKING=false` and point `VITE_API_BASE_URL` at the backend. The mock
  code is loaded with a dynamic import and is not executed.

To trigger states during review, add `?mock=error` or `?mock=empty` to any page URL
(e.g. `/facilities?mock=error`). `empty` serves an empty catalogue, which shows the "no facilities
yet" state; a search such as `?q=zzzz` shows the "no matches" state.

Tests always use MSW's Node server (`src/mocks/server.ts`), independent of this flag.

## Scripts

| Script                 | Does                                         |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Vite dev server                              |
| `npm run build`        | Type check, then production build to `dist/` |
| `npm run preview`      | Serve the production build locally           |
| `npm run lint`         | ESLint (flat config)                         |
| `npm run format`       | Prettier, write                              |
| `npm run format:check` | Prettier, check only (used in CI)            |
| `npm run typecheck`    | `tsc -b`, strict mode                        |
| `npm run test`         | Vitest, single run                           |
| `npm run test:watch`   | Vitest, watch mode                           |

A pre-commit hook (Husky + lint-staged) lints and formats staged files. CI
(`.github/workflows/ci.yml`) runs install, typecheck, lint, format check, test and build.

## Folder structure

```
src/
  app/              providers, router, route guards' wiring, shell, theme, env config
    theme/          the single theme module; index.ts is the only entry point
    shell/          app bar, side navigation / drawer, user menu
    routes/         root layout (Clerk), public layout, sign in/up, redirect, 404
  features/         one folder per feature; owns its pages, components, hooks, types, tests
    facilities/ bookings/ approvals/ admin/
  shared/
    api/            http client, query client, query key factory, ApiProblem
    auth/           roles, useCurrentUser, ProtectedRoute, RequireRole (the only Clerk consumer)
    components/     page layout, loading/empty/error/forbidden states, error boundary,
                    confirm dialog, snackbar
    hooks/ types/ utils/
  mocks/            MSW handlers, browser worker, node server
  test/             test setup, Clerk test double, render helpers
```

Rules enforced by ESLint: features never import from other features (move shared code to
`shared/`); only the auth layer, root layout and Clerk sign-in pages import `@clerk/react`; no
hex colours or pixel values in component code (the theme module is exempt).

## Facilities data

The default fixture (`src/mocks/data/facilities.real.ts`) is the twelve Midvaal venues from the
client's Business Requirements Document v2.0, section 7. **Only the names are confirmed.** Every
other field is provisional, listed per record in `provisionalFields`, and the file's opening
comment records the source, the date, and the basis for each inference (hierarchy, localities,
types, amenities, capacities). There are no photographs: venues show a type based placeholder.
`docs/facilities-data-gaps.md` is the question list to send to the client.

- `provisionalFields` exists on the mock contract only; the real API never sends it.
- While a displayed record has provisional fields, a banner says so. It is development only
  (`import.meta.env.DEV`), so production builds never contain it; set
  `VITE_SHOW_SAMPLE_DATA_BANNER=false` to hide it in development.
- `VITE_MOCK_DATASET=volume` serves `facilities.volume.ts` instead: 72 generated, obviously
  fictional venues ("Volume Test Venue 001"...) for testing pagination and filters at scale.
  Off by default; never use it in a client demonstration.
- Filter options (types, localities, amenities, capacity bounds) are derived from whichever
  fixture is active. Types and amenities are not hardcoded, so recreational types can be added
  when the register arrives; unknown types fall back to a generic placeholder icon.
- A locality that is unknown reads "To be confirmed" and appears as its own filter option until the
  client answers.

## Facilities browse screen

`/facilities` (`src/features/facilities`). All search, filter, sort, view and page state lives in
the URL, through `useUrlState` and a schema built with `params-codec` (both knowledge-free of
facilities, for reuse by later list screens). Defaults are omitted from the URL; parameters the
schema does not own (such as `mock`) are preserved. `src/shared/components/README.md` lists the
extracted primitives and the decisions behind them.

The API contract lives in `src/shared/api/contracts/facilities.ts` and is the specification for the
backend: parameters, combination rules, the standard `{ items, page, pageSize, totalItems,
totalPages }` envelope, and the reserved `availableFrom` / `availableTo` parameters. Contract
choices the brief left open:

- `status` accepts `active` (default), `unavailable` or `all`; the "include unavailable" toggle sends `all`.
- Locality is filtered by id from `filter-options`; the summary carries only the display name.
- Filter option counts are over active facilities in the whole catalogue, ignoring applied
  filters (not facet aware).
- A capacity filter excludes facilities with null capacity.
- Facilities with null capacity sort last in both directions.
- `GET /facilities/:id` returns a `FacilityDetail`: the summary plus full `description`, an ordered
  `images` gallery with alt text, `address` and `childFacilities`. 404 uses problem details.

## Facility detail screen

`/facilities/:id`. The contract is `FacilityDetail` in `src/shared/api/contracts/facilities.ts`;
the mock derives complete detail for every venue in `src/mocks/data/facilityDetail.ts`
(description, capacity by seating arrangement, venue and kitchen resources, opening hours,
managing department, booking notes, children and siblings). All of it beyond the summary is
provisional and listed in `provisionalFields`; there are still no photographs.

- **Hierarchy is the centre of the page.** A parent says "Comprises N separately bookable spaces"
  under its title, in key facts, and in a "Spaces within X" section explaining that booking the
  whole venue includes all of them. A child says "Part of X" under its title (linked), in the
  breadcrumb and key facts, and in a "Part of X" section listing the whole venue and the other
  spaces and stating that a whole venue booking would make it unavailable.
- **Back returns to the exact result set.** Cards and every related venue link carry the browse
  screen's query string in router state (`fromList`); "Back to results" and the "Facilities"
  breadcrumb use it, so nothing is reconstructed. Opened directly, there is no origin and they go
  to the unfiltered list ("All facilities").
- **Primary action.** "Request booking" goes to `/bookings/new?facilityId=:id` (still a
  placeholder). It is fixed to the bottom of the screen on mobile and in the sticky sidebar on
  desktop, and disabled with an explanation when the facility is unavailable. It is shown only to
  roles that can make bookings (`BOOKING_ROLES`), since other roles would land on a forbidden page.
- **Availability** is a labelled placeholder: no calendar and no dates.
- **Review states:** `/facilities/nope` (not found), `?mock=error` (error, retry), and the 600ms
  development latency shows the skeleton.

## Availability calendar

The availability section of the facility detail page. The contract is
`src/shared/api/contracts/availability.ts` (`GET /facilities/:id/availability?from&to`, at most 62
days); the mock engine in `src/mocks/availability.ts` implements the behaviour the backend must:
operating hours, closures, buffer expansion, hierarchy blocking, overlap resolution and merging.
The client renders what it is given and never derives blocking from the hierarchy.

- **Why a day is unavailable is always said, in words.** Booked, held, set-up or clear-down time,
  blocked by a related space (naming it: "Unavailable, City Hall is booked", in both directions),
  closed (the reason, e.g. "Public holiday: Day of Reconciliation" or "Maintenance"), and past or
  too far ahead. Each also has its own pattern and icon, so none relies on colour. The legend names
  all of them.
- **Time zone.** Instants are UTC ISO on the wire; every date, time and selection is in the
  facility's zone, which the API returns. Nothing uses the browser's zone, except the very first
  month before the zone is known (the browser's current month). Tests run under other system zones.
- **URL state.** `month`, `date` (the open day panel) and `startsAt`/`endsAt` (UTC instants). The
  selection is a **range of two instants**, not a date plus times, so multi day selection is an
  extension of this shape. A `Selection` is `{ start, end }` everywhere.
- **Hand off.** "Request booking" goes to `/bookings/new?facilityId=&startsAt=&endsAt=` (placeholder
  route). The page says once, beside the action, that availability is not a reservation.
- **Selection is constrained, not validated afterwards.** The time selectors offer only valid
  choices (opening hours, unavailable time, minimum notice, minimum duration) and state the rule
  that limits the choice. A selection arriving by URL that overlaps a booking is flagged.
- **Rules.** Minimum notice (48 hours), horizon (90 days) and minimum duration (60 minutes) are
  served by the mock and provisional. `minimumDurationMinutes` is an addition to the brief's shape.
- **Mock data** is relative to today and covers this month and the next two: a full day City Hall
  booking (its three spaces blocked), a Mitchell Wing partial booking (City Hall blocked, Loch Wing
  free), set-up and clear-down around a Rothdene Hall booking, an expiring hold, a public holiday,
  a maintenance blackout, a weekend only venue (Sicelo Hall), a busy week and a free week. Every
  booking is invented.
- Keyboard: arrows move by day and week, Page Up and Page Down by month, Home and End to the ends
  of the week; Enter opens the day panel, Escape closes it and focus returns to the day.

## Booking request form

`/bookings/new`, replacing the paper venue application (BRD sections 8.3 and 8.4). The contract
is `src/shared/api/contracts/bookings.ts`; `src/mocks/bookings.ts` implements it.

- **Five steps, current step in the URL** (`?step=`), plus the draft (`?draft=`) and the window and
  facility handed over by the calendar. Visited steps can be revisited. Steps were chosen for the
  fourteen item kitchen list and phone users; the review step does summarise everything, but it
  does not do most of the work: each step still validates its own fields before advancing.
- **Step 1 is a confirmation, not inputs.** It re-checks live availability on entry with the same
  rules the calendar uses (`shared/utils/availability.ts`) and blocks going on if the slot has
  gone. With no parameters it offers the browse search as a venue picker, then sends the user to
  that venue's calendar. "Change" returns to the calendar with the selection intact and the draft
  id carried, so "Request booking" continues the draft rather than starting another.
- **Drafts.** Saved on step change, on a pause in typing (1.2s) and on leaving; "Save and finish
  later" confirms where to find it (a resume link; the My bookings page will list drafts once it
  exists). A draft is created lazily at the first save, or on the first upload. **Drafts never hold
  a slot: only `submit` checks availability and creates the hold.** A submitted request then shows
  as held on the calendar.
- **Conflict.** A lost race is a 409 problem whose `type` is `SLOT_CONFLICT_PROBLEM_TYPE`, with
  `conflictingWindow`, `relatedFacility` and `reason`. The form explains it in words (naming the
  building when the hierarchy caused it), keeps every answer, and links back to the calendar.
- **Validation.** One Zod schema composed from step schemas; blur validates, a field that has
  errored revalidates on change. A failed advance shows a summary of links and moves focus to it;
  server field errors land on their fields and the form jumps to the first affected step.
- **Reviewers' triggers:** `?mock=conflict` forces a conflict on submit; a description containing
  `[invalid]` returns a server field error; a file whose name contains `fail` fails to upload.
- **Additions and assumptions to confirm with the client:** the attendee count (not in the BRD,
  needed for the capacity warning); the booking options endpoint also returns the resource
  catalogue; seating arrangements are matched to a venue's capacities by name; the reference is
  assigned when the draft is created (the contract table) although the BRD says on submission;
  documents are optional; the event types, terms text, upload limits and turnaround are
  placeholders; event type and seating lists are not in the BRD. **No fee, deposit or payment
  appears anywhere.**
- **Multi day and recurring bookings.** The window is a pair of instants (`startsAt`, `endsAt`)
  and the facility check treats a booking as one day, so a multi day booking needs the availability
  check (`windowProblem`) and step 1 to iterate days; nothing else in the form assumes one day.
  Recurrence would need a new field and a new submit rule; none is built.

## Conventions

- TypeScript strict, no `any`. Named exports, except lazy loaded route components (default).
- Tests are co-located as `*.test.ts(x)`.
- Server state lives in TanStack Query; no global state library.
- Styling is Tailwind CSS v4. Components use only the semantic tokens from the theme
  (`bg-surface`, `text-muted`, `border-line`, `bg-primary` ...) and the Tailwind spacing and type
  scale. No palette colours, hex values, pixel values or arbitrary `[...]` sizes in components.

## Key design notes

**Theme.** `src/app/theme/theme.css` is the single light theme: a Tailwind `@theme` block mapping
semantic tokens (primary blue, ink, muted, line, canvas, surface, danger, warning) onto Tailwind's
default palette, plus the Public Sans font and the global focus style. `src/app/theme/index.ts` is
the one entry point and is imported once in `main.tsx`; `clerkAppearance.ts` points Clerk's cards
at the same tokens. Replacing the design language means replacing those files. Interactive
primitives without a native equivalent (dialogs and drawers, the user menu, the range slider) use
unstyled Radix UI; icons are Lucide. Slice 1 and 2 used Material UI; it was removed in slice 3.

**Auth and roles.** Clerk owns identity; the backend owns roles. `useCurrentUser()` combines
Clerk's user with the role from `GET /me` into one shape (`status`: `loading`, `signed-out`,
`error`, `ready`). Nothing else reads Clerk. Route access is declared once in
`src/app/access.ts` and drives both the router and the navigation. `RequireRole` renders a
forbidden page rather than redirecting. Clerk is mounted in the root route (not above the router)
so it can navigate through React Router.

**API layer.** All requests go through `createApiClient` (`src/shared/api/client.ts`), which adds the
Clerk session token. Failures of every kind (RFC 7807 problem details, network, unexpected
responses) throw an `ApiProblem`. Call sites currently pass response types as generics
(`api.get<Me>('/me')`); when the OpenAPI contract is published, generate types and use them in the
per-feature endpoint functions that wrap the client. Callers do not change. Each feature builds its
query keys with `createQueryKeys('scope')`.

**Dates.** The backend stores booked windows as timezone aware ranges. The convention is ISO 8601
instants over the wire, Luxon `DateTime` with an explicit facility zone in the UI, never `Date`
(`src/shared/utils/datetime.ts`). The MUI X Luxon adapter went with Material UI; when date and
time pickers are needed, pick a Luxon compatible one then (nothing uses one yet).

## Decisions that may constrain later slices

- Clerk sits in the root route, so anything needing Clerk must render beneath the router.
- A system administrator currently has access only to `/facilities` and `/admin/users`, exactly as
  the route table specifies. Whether they should also reach facility administration is a product
  decision, changed in `ACCESS` in `src/app/access.ts`.
- Roles are a closed set (`src/shared/auth/roles.ts`); a user has exactly one role.
- View mode is in the URL once chosen; until then the session preference applies, so a shared
  URL only carries a view if its sender picked one.
- Adding the availability filter means adding fields to `facilityListCodec` and a section to
  `FacilityFilters`; no other URL handling changes.
- Card columns follow the width available to the results (container queries), not the viewport:
  one, two, three or four columns. The shell navigation shows from `lg`, the filter sidebar from `xl`.
- The "My bookings" nav item is highlighted only on `/bookings`, not on child routes.
- `/bookings/:id` is open to every authenticated role; per-booking authorisation must come from
  the API.

## Dependency notes

- `@clerk/react` is used instead of `@clerk/clerk-react`, which Clerk has deprecated in its favour.
- ESLint is on v9 because `eslint-plugin-react` and `eslint-plugin-jsx-a11y` do not yet support v10.
- TypeScript is on 6.x because `typescript-eslint` does not yet support 7.
- jsdom is on v27; v30 needs a newer Node 22/24 patch release than some machines have.
