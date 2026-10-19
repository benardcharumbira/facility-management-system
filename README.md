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

`/facilities/:id`. Gallery with selectable photos, about text, amenities, a key facts panel (type,
locality, address, capacity, status, parent link) and, for a parent, links to its child spaces.
Loading, not found and error are distinct states. Cards pass the list's query string in router
state, so the "Facilities" breadcrumb returns to the same results; opened directly, it goes to the
unfiltered list. There is deliberately no "Book" action: booking creation and availability are
later slices, and the page has no slot for them yet.

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
