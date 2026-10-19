# Facilities Booking – Frontend

Frontend for the municipal Facilities Booking Management System. Members of the public and
staff request bookings for public facilities; a booking is routed to a designated approver and
approved or rejected. This repository currently contains the **application shell only** (slice 1):
authentication, routing, theme, API layer, mocking and shared primitives. There are no business
features yet.

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
  intercepts requests to `VITE_API_BASE_URL`. Handlers live in `src/mocks/handlers.ts`
  (`GET /me`, and `GET /facilities` as a sample of the pagination envelope). Change
  `VITE_MOCK_ROLE` to see the navigation for each role. Requests with no handler (such as Clerk's)
  pass through untouched.
- **Real:** `VITE_ENABLE_API_MOCKING=false` and point `VITE_API_BASE_URL` at the backend. The mock
  code is loaded with a dynamic import and is not executed.

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

## Conventions

- TypeScript strict, no `any`. Named exports, except lazy loaded route components (default).
- Tests are co-located as `*.test.ts(x)`.
- Server state lives in TanStack Query; no global state library.
- Components never hardcode colours, spacing or font sizes. Use `sx`, `styled` or theme
  callbacks. Layout sizes use `theme.spacing(...)`.

## Key design notes

**Theme.** `src/app/theme/theme.ts` is one `createTheme` call close to the Material UI defaults
(font family, type scale, spacing unit). `ThemeProvider` and `CssBaseline` sit once in
`AppProviders`. Replacing the design language means editing that module only.

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
(`src/shared/utils/datetime.ts`). `LocalizationProvider` with the Luxon adapter is mounted at the
root for the MUI X pickers.

## Decisions that may constrain later slices

- Clerk sits in the root route, so anything needing Clerk must render beneath the router.
- A system administrator currently has access only to `/facilities` and `/admin/users`, exactly as
  the route table specifies. Whether they should also reach facility administration is a product
  decision, changed in `ACCESS` in `src/app/access.ts`.
- Roles are a closed set (`src/shared/auth/roles.ts`); a user has exactly one role.
- The "My bookings" nav item is highlighted only on `/bookings`, not on child routes.
- `/bookings/:id` is open to every authenticated role; per-booking authorisation must come from
  the API.

## Dependency notes

- `@clerk/react` is used instead of `@clerk/clerk-react`, which Clerk has deprecated in its favour.
- ESLint is on v9 because `eslint-plugin-react` and `eslint-plugin-jsx-a11y` do not yet support v10.
- TypeScript is on 6.x because `typescript-eslint` does not yet support 7.
- jsdom is on v27; v30 needs a newer Node 22/24 patch release than some machines have.
