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

## My bookings and booking detail

`/bookings` and `/bookings/:id`. The contract is in `src/shared/api/contracts/bookings.ts`.

- **A note on slice 6.** The brief for this slice assumes a slice 6 that delivered a design
  language with status tokens. No such slice exists in this repository: styling is the Tailwind
  theme from slice 3 onwards. So `StatusBadge` was built from what does exist, the calendar's fill
  patterns, icons and the semantic colour tokens, and each status differs by pattern, icon and
  words (Draft dashed, Pending striped, Approved solid, Rejected crosshatched, Cancelled outlined).
  When a real design language arrives, `src/shared/components/ui/BookingStatusBadge.tsx` is the one file to
  restyle. The mechanical style rule (no hex or pixel values in components) is the ESLint rule
  from slice 1 and passes.
- **List.** The default order is `attention`: drafts, then pending, then upcoming approved, then
  everything past or closed, in sections. A booking whose event has ended is "past and closed"
  whatever its status. Other sorts drop the sections. Search, status, event date range, venue,
  sort and page are all in the URL. Three empty states: no bookings at all, nothing matching the
  filters, and a quiet note where there are no past bookings. Cancellation and rescheduling are
  deliberately not on the list; a draft can be resumed from its row.
- **Detail.** Status, in words, and what happens next sit inside the header, above everything else:
  pending says it is under review, how long it has waited and the expected turnaround; the hold is
  a date and a sentence, never a countdown; a rejection reason is given in full. Then details
  (everything submitted, with document downloads), the hierarchy consequence, and history.
- **Actions never fail.** The server computes `actions.cancel` and `actions.reschedule` for the
  caller; the screen offers an action only if it is allowed, and otherwise shows the reason in its
  place. Cancelling a pending request and cancelling an approved booking are worded differently.
  A cancellation updates the booking in place with a confirmation and does not navigate.
- **Reschedule is a request.** From an approved booking, the facility's calendar opens on its day
  (`?reschedule=<id>`) with a banner saying what is held and that nothing moves until a decision.
  Choosing a time returns to the booking with the proposal beside the original for confirmation.
  Sending creates a pending request; the booking stays Approved on its original window, and the
  request is shown on both the list and the detail.
- **Print.** An approved booking has a print-only block (reference, venue, window, details,
  resources); the rest of the page and the shell are `print:hidden`. No PDF is generated.
- **Access.** Identity is the token, never a parameter. Someone else's booking answers 404, so
  identifiers cannot be probed; the screen shows the same not found as for an unknown id.
- **Mock.** `seedBookings` fills the mock applicant's bookings in every state (development only);
  `?mock=empty` gives an applicant with none. Rules: cancelling or moving an approved booking needs
  72 hours' notice (assumed), and a pending request holds for 72 hours (assumed).
- **Assumptions to confirm with the client:** whether a cancellation reason should be required
  (it is optional here); the notice period; who may cancel; whether names appear in the history;
  and "start a new request" after a rejection or cancellation prefills the venue and, if still in
  the future, the window, but not the event details (copying those would need a `copyFrom` option
  on the draft). Added to the contract beyond the brief: `GET /bookings/summary`, and
  `actions`, `history`, `holdExpiresAt` and friends on the booking.

## Approval queue

`/approvals` and `/approvals/:itemId`. The contract is in `src/shared/api/contracts/approvals.ts`.
This is an internal tool for someone who works in it every day, so it optimises for throughput, not
first-time clarity: a queue beside the selected request, a compact density, and the keyboard as a
first class path.

- **Two kinds of work.** A _new request_ and a _change of date_ (a reschedule of an approved
  booking) share the queue but are told apart by pattern, icon and words, and a change of date
  carries both windows: "Now" and "Move to" in the row, "Booked now" and "Proposed" in the detail.
  Each is decided at its own endpoint and has its own id. The id of a new request is the booking's.
- **Scope is identity, never a parameter.** An approver sees the facilities they are designated
  against, a system administrator sees all (the route is now open to both). Something outside
  scope is a 404, the same as something that does not exist, and a `facilityId` filter cannot
  widen the scope.
- **Competition is the primary feature, and the server's job.** The API returns, for a pending
  item, the other pending requests that want overlapping time in the same facility or across the
  hierarchy (`competingRequests`, each with relationship `same_facility`, `parent` or `child`
  _from the viewer's side_), the approved bookings already in the way (`blockedBy`) and the
  related facilities approving would take (`affectedFacilities`). The client reads those lists and
  never walks the hierarchy. Two wings of one building do not compete with each other; each
  competes with the whole building. The approve confirmation names every request it makes
  impossible, and the queue row says "Competes with N" before the item is opened.
- **Rivals are stranded, not rejected.** Approving a request does not reject the ones it
  displaces. They stay in the queue, can no longer be approved (the server says why, and the
  screen offers only Reject), and need a reason written by a person, because the reason is the
  only explanation the applicant gets. This is an assumption (Q18 in `docs/facilities-data-gaps.md`).
- **Reasons.** Rejecting needs a reason; the field says it is sent verbatim and is the only
  explanation. The server stores it exactly as typed and the applicant's booking returns it
  unchanged (tested). An approval's internal note is never part of the applicant's booking.
- **Already decided.** A decision on something another approver decided first is a 409 that says
  what was decided, by whom and when. The dialog says so in place, keeps the typed note or reason
  on view (it was not sent) and offers only "Continue", which moves to the next request.
- **After a decision** the screen waits for the queue and counts to refresh, then selects the
  next request (the one below, or the one above if it was last), and puts focus on it. On a phone
  it opens the next request full screen.
- **Keyboard.** `j`/`k` and the arrow keys (arrows only with focus in the queue, so the page still
  scrolls) move through the queue; `a` and `r` open the confirmations; `/` focuses search; `?`
  opens the reference (also a visible button). Shortcuts never fire from a field, with Ctrl, Cmd
  or Alt held, or while a dialog is open. In a dialog Enter confirms, because focus starts on the
  confirm button; **in the reason or note box Enter inserts a line break** (a reason is a
  sentence, not a word) and **Ctrl or Cmd with Enter confirms**. That is the one place the brief's
  "Enter confirms" is adjusted.
- **URL.** Search, status (empty means pending), kind, event dates, facility, sort and page are
  in the URL through the slice 2 hook, and selection is the path, so a link opens a request and
  selecting keeps the view. Moving with `j`/`k` replaces the history entry, so Back leaves the
  queue instead of stepping back through every request.
- **Navigation badge.** The pending count beside "Approvals" refetches when the window regains
  focus and after a decision. There is no polling (tested).
- **Layout.** From 768px the queue and the request sit side by side and scroll independently; below
  that it is one column, the queue or the request full screen with a way back that keeps the
  filters. On a wide screen the first request is selected on arrival. Filters open as a side
  sheet, not a sidebar, because a queue and a detail pane leave no room for one.
- **No bulk actions, deliberately.** Every rejection carries a reason and every approval can
  strand a competing request, and both are poor fits for a multi-select. Revisit once there is
  evidence from real volumes.
- **Thresholds that are this screen's, not the API's:** a request is "approaching" its target
  within 24 hours of it, and a hold is "ending soon" within 24 hours (`features/approvals/urgency.ts`).
  The target itself (5 days) comes from the API and is absent for the committee room, to exercise
  that case.
- **Withdrawn requests leave the queue.** A cancelled or draft booking is not work. A decided
  item is reviewed by adding Approved or Rejected to the status filter.

### Reviewing it with the mock API

The default mock approver is designated against City Hall, Mitchell Wing, Loch Wing, the committee
room, Rothdene Hall and Lakeside Hall. The seeded requests (listed at the top of
`src/mocks/data/approvalSeeds.ts`) cover: City Hall, Mitchell Wing and Loch Wing for one
Saturday (a parent and two children), two requests for Rothdene Hall at once, a request over its
target, a hold ending within a day, a capacity and a resource warning, two changes of date, a
request that cannot be approved because a booking is already approved over it, and decided items.
Request MVL-…-9115 is one another approver decides first, so your first attempt on it comes back
as already decided. `?mock=empty` empties the queue. In tests, and with a `user:<id>` token,
`approver-vaal` sees only Vaal Marina Hall, `approver-empty` has an empty queue, `mock-sysadmin`
sees everything and an unknown identity sees nothing.

### Additions to the contract beyond the brief

`blockedBy` and `affectedFacilities` (so the screen need not walk the hierarchy), `capacity` (the
numbers behind `capacityWarning`), on each competitor the `workItemId`, `workItemType`, `overlap`
and `inYourQueue` (a competitor outside the caller's scope is named but not linked), `approvable`
and `actions` (the server decides what may be done), `facilities` with pending counts on
`/approvals/counts` (the facility filter), `GET /approvals/:id/documents/:documentId` (an approver
cannot use the applicant's own endpoint), the already-decided problem type, and the history entry
types `reschedule_approved` and `reschedule_declined` on the applicant's booking.

### Design system

**4 components, 1 hook and 1 context added**, all in their own directory,
`src/shared/components/backoffice/`: `MasterDetailLayout`, `QueueItem`, `DecisionDialog`,
`KeyboardShortcutHelp`, `useKeyboardShortcuts` and `DensityProvider`. The competing request list
stayed in the feature because it is about booking competition, not a general pattern. **10 existing
pieces changed**: the density variant is read by eight list primitives (`SearchField`, `SortSelect`,
`ResultsToolbar`, `ResultsGrid`, `Pagination`, `ActiveFilterChips`, `CardSkeleton`, `FilterButton`),
`FilterPanel` gained a `placement`, and `Badge` gained a `warning` tone. Three modules moved to
`shared` because a second feature needed them: the booking status badge, the date helpers and
`saveBlob`. Details in `src/shared/components/README.md`.

### Not verified

Everything here is checked under jsdom, which has no layout. I have not opened it in a browser, so
the sticky and independently scrolling panes, real focus behaviour, the 768px and 360px layouts
and real keyboard use are unconfirmed.

## Facility administration

`/admin/facilities`, `/admin/facilities/new` and `/admin/facilities/:id?section=…`. The contract is in
`src/shared/api/contracts/admin-facilities.ts`. This is the screen through which the municipality's
real register replaces the provisional fixture data: every facility can be created, edited and
arranged into its hierarchy here, and saving a section clears that section's "provisional" marks.

- **Every retroactive change runs an impact check first.** One pattern, used by every change that
  can reach a booking that already exists: the screen posts the proposed change to
  `POST /admin/facilities/:id/impact`; if nothing is affected it makes the change at once, with no
  dialog (a warning on every harmless edit teaches people not to read warnings); if something is,
  a dialog names each booking (reference, applicant, facility, window, status and a sentence saying
  why) and the change is made only on explicit confirmation. The dialog says that confirming does not
  cancel or move anything and notifies nobody: what happens to each booking is a separate human
  decision. It is `useImpactGuard` plus `ImpactDialog` in `shared/components/admin/`, and slice 10
  can use it unchanged.
- **What each change checks**, all on the server, over approved and pending bookings that have not
  ended: a **blackout** (bookings overlapping it, including those in the spaces inside the facility);
  **hours** (bookings that were inside them and now fall outside); **buffers and hierarchy** (pairs
  of bookings that now clash and did not before; the later booking of each pair is named, with the
  one it clashes with); **status to unavailable** and **archive** (every future booking there);
  **capacity** (bookings that now expect more people than the arrangement seats). Details that touch
  no booking (a name, a description) always affect nothing.
- **The hierarchy cannot become a cycle.** The control only lists places a facility can go: the
  server leaves out itself and everything inside it. The server refuses a cycle with 422 as well.
  The screen states the containment rule in words: booking a parent blocks every space inside it,
  booking any space inside blocks the parent, and two spaces in one building do not block each other.
- **Archive, never delete.** There is no delete endpoint and no delete button. Archiving asks by name
  even when it reaches nothing, because the click is the decision; it is refused while the facility
  still contains unarchived spaces; an archived facility is read-only, absent from the public estate
  and from new bookings, and can be restored (it comes back unavailable). A hard delete for a
  facility created in error is a separate decision and is not built.
- **Approvers drive the approval queue.** The approvers designated here are exactly who sees a
  facility's requests in the slice 8 queue. A facility with nobody is flagged in words on the list
  (a banner and a "No approver" mark per row) and on its own screen, cannot be made active, and
  cannot lose its last approver while active. A new facility therefore starts unavailable. The
  fixture's Activity Room, Bantu Bonke Hall and Council Chambers have no approver, on purpose.
- **Images need a caption.** It is the public alternative text, so a file is not uploaded without
  one; the accepted types and limit are stated before a file is chosen; each file shows progress and
  has its own remove and retry; images can be recaptioned (never blanked), reordered and one made the
  main image.
- **Blackouts** are whole days or a time range, in the facility's own zone whatever the browser's.
  The reason is shown to the public, so the form asks for a sentence. A blackout on a parent applies
  to its spaces and shows on them as inherited. Only one that has not started can be deleted. The
  public calendar closes a whole day with the reason, and shows part of a day as a new `closure`
  segment.
- **Sections** are in the URL and each saves on its own. Leaving a section with unsaved edits asks
  first.
- **Permissions.** System administrators and facility administrators, enforced by the mock server
  from the session identity (anyone else gets 403) and by the route guard. Both kinds can do
  everything, so there is nothing to hide between them; whether a facility administrator should be
  limited to their own facilities is a question (Q22).
- **Not here:** resources and amenities (slice 10, linked from each facility), user and role
  administration and the seating arrangement vocabulary (slice 11; capacity rows choose from the
  booking form's list), bulk import and notifying affected applicants.

### How the mock works

The mock's facility estate is now one mutable store (`src/mocks/data/facilityStore.ts`), seeded from
the fixture. The public browse, detail and availability endpoints, the booking handlers and the
approval queue's scope all read from it, so a change made in administration shows everywhere without
a reload of the mock. Two things changed as a result: no facility starts with a set-up or clear-down
buffer (it used to be 30 minutes for halls in the fictional ledger; an administrator sets it), and
approver designations come from the store rather than a constant. `resetFacilityStore` undoes every
change between tests.

In development the sample data gives each retroactive change something to find (references
MVL-…-9201 to 9210 and the list at the top of `src/mocks/data/facilityAdminSeeds.ts`): a closure
across three Rothdene Hall bookings, moving the Activity Room into Rothdene Hall to create a clash,
a thirty minute set-up buffer at Lakeside Hall, closing Vaal Marina Hall at 22:00, archiving the
Vaal Marina Board Room, and reducing Rothdene Hall's banquet seating. City Hall has a closure in
effect now. Changes that affect nothing, like a new description, save without a dialog.

### Additions to the contract beyond the brief

`eligibleParents` (so the screen never offers a cycle), `timeZone` on the facility, `conflictsWith`
and `timeZone` on an impacted booking, `GET /admin/approver-candidates`, `withoutApprover` and
`localities` on the list, and a `closure` segment with a `reason` on the public availability
contract.

### Design system

**7 components and 1 hook added**, in `src/shared/components/admin/` (the brief's likely list, exactly):
`SectionedEditLayout`, `ImpactDialog` (with `ImpactList`), `HierarchySelect`, `ScheduleEditor`,
`DateRangeField`, `ImageManager`, `ArchiveConfirm`, and `useImpactGuard`. **No earlier shared
primitive had to change**: `ConfirmDialog`, `FormField`, `Section`, `DetailHeader`, and the whole list
set at the slice 8 density were reused as they were. That is more additions than a ninth screen
should need, and honestly only three are shared by design (`useImpactGuard`/`ImpactDialog`,
`ArchiveConfirm`, `SectionedEditLayout`); `ScheduleEditor`, `ImageManager`, `HierarchySelect` and
`DateRangeField` have one user so far and should move into the feature if slice 10 and 11 do not
need them. The public availability calendar did change: it learned the `closure` segment.

### Not verified

Checked under jsdom, which has no layout: I have not opened it in a browser, so the real keyboard
and focus behaviour of the dialogs, the date and time inputs, and the layout at tablet and phone
widths are unconfirmed.

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
