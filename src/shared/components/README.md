# Shared components

Tailwind based primitives, plus the list screen scaffolding extracted while building the
facilities browse screen. None contain facility logic; the facility composition lives in
`features/facilities`. Hooks and utilities that go with them: `shared/hooks/useUrlState`,
`shared/utils/params-codec`, `shared/hooks/useSessionStorageState`, `shared/hooks/useMediaQuery`.

Styling uses only the semantic tokens in `src/app/theme/theme.css`. Radix UI supplies behaviour
(focus trapping, menus, slider) where native elements fall short; everything else is native HTML.

## Primitives (`ui/`)

`Button` / `buttonStyles` (variants `primary` `secondary` `ghost` `danger`, sizes `sm` `md`;
`buttonStyles` styles links as buttons), `IconButton` (requires `aria-label`), `Badge`, `Alert`,
`Skeleton`, `Spinner`, `VisuallyHidden`.

## List screen scaffolding

| Component                       | Props                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `PageHeader`                    | `title`, `description?`, `meta?` (e.g. count), `actions?`                                |
| `PageLayout`                    | `PageHeader` props + `breadcrumbs?`. Renders the header, publishes breadcrumbs to shell. |
| `SearchField`                   | `value` (committed), `onChange`, `label`, `placeholder?`, `debounceMs?` (300)            |
| `FilterPanel`                   | `open`, `onClose`, `title?`, `closeLabel?`, `onClearAll?`, `returnFocusRef?`, children   |
| `FilterButton`                  | `activeCount`, `onClick`, `ref`. Hidden where the panel is a sidebar.                    |
| `FilterSection`                 | `title`, `activeCount?`, `defaultExpanded?`, children. Native `<details>`.               |
| `CheckboxGroupFilter`           | `label`, `options: {value,label,count?}[]`, `selected`, `onChange`                       |
| `RangeFilter`                   | `label`, `bounds`, `value: {min,max}`, `onChange`. Slider plus numeric inputs.           |
| `SwitchField`                   | `label`, `checked`, `onChange`                                                           |
| `ActiveFilterChips`             | `filters: {key,label,onRemove}[]`, `onClearAll`. Renders nothing when empty.             |
| `ResultsToolbar`                | `countLabel?`, `leading?`, `sort?`, `viewToggle?`. Count is a polite live region.        |
| `SortSelect`                    | `value`, `options`, `onChange`, `label?`. Native `<select>`.                             |
| `ViewToggle`                    | `value`, `options: {value,label,icon}[]`, `onChange`, `label?`                           |
| `ResultsGrid`                   | `layout?: cards \| rows`, `label?`. A `ul` of equal height cells.                        |
| `Pagination`                    | `envelope: {page,totalPages}`, `onChange`. Renders nothing for one page.                 |
| `CardSkeleton` / `SkeletonGrid` | `layout: card \| row`, `hasMedia?`, `rows` (`title` `text` `chips`), `count?`            |
| `EmptyState`                    | `title`, `description?`, `icon?`, `action?`                                              |

`ShellBreadcrumbs` is the shell's breadcrumb region.

## Detail screen primitives (`detail/`)

| Component         | Props                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `Breadcrumbs`     | `items: Crumb[]` (`label`, `to?`, `state?`); the last item has no `to`                                |
| `DetailHeader`    | `breadcrumbs`, `back?`, `title`, `subtitle?`, `status?`, children (free content below)                |
| `KeyFacts`        | `title?`, `items: {label, value: ReactNode}[]`. A definition list in a card.                          |
| `Section`         | `title`, `description?`, children. Labelled by its `h2`.                                              |
| `Disclosure`      | `summary`, `defaultOpen?`, children. Radix collapsible; trigger exposes `aria-expanded`.              |
| `Gallery`         | `images: {url, alt, caption?}[]`, `placeholder`, `label`. Expanded view opens from the primary image. |
| `StickyActionBar` | children. Fixed to the bottom below `lg`, in flow from `lg`. `STICKY_ACTION_CLEARANCE` pads the page. |
| `RelatedItems`    | `label`, `items: {id, label, description?, to, state?}[]`                                             |
| `DetailLayout`    | `aside`, children. Two columns from `lg`, aside sticky; aside first in source order.                  |
| `DetailSkeleton`  | `sections?`. Built on `DetailLayout`, so it matches the loaded page.                                  |
| `NotFoundState`   | `title`, `description?`, `action: {label, to, state?}`                                                |

## Added for My bookings and booking detail

| Component                  | Props                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatusBadge`              | `label`, `icon`, `pattern`, `className`, `size?`. Pattern, icon and words together.                                                                         |
| `ActivityLog`              | `entries: {key,title,when,dateTime?,actor?,detail?,icon?}[]`, `label`. A history.                                                                           |
| `ConfirmDialog`            | `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `cancelLabel?`, `destructive?`, children, `onConfirm` (async; failure stays in the dialog). |
| `DateRangeFilter`          | `label`, `value: {from,to}`, `onChange`. Two native date inputs.                                                                                            |
| `ResultsSection`           | `title`, `count?`, children. A titled group within one list.                                                                                                |
| `ScreenOnly` / `PrintOnly` | children. `print:hidden` and `hidden print:block` wrappers.                                                                                                 |

**How well did the slice 2 list primitives generalise?** Well. My bookings reuses, unchanged,
`PageLayout`/`PageHeader`, `SearchField`, `FilterPanel`, `FilterButton`, `FilterSection`,
`CheckboxGroupFilter`, `ActiveFilterChips`, `ResultsToolbar`, `SortSelect`, `ResultsGrid`
(`rows`), `Pagination`, `EmptyState`, `SkeletonGrid`, `ErrorState` and `useUrlState` with its
codec. Nothing was forked into `features/bookings`. What did not fit, and was added to
`shared/components` rather than worked around: a titled group inside one list
(`ResultsSection`), and a date range filter (`DateRangeFilter`).

**Count for this slice: 6 primitives added** (`StatusBadge`, `ActivityLog`, `ConfirmDialog`,
`DateRangeFilter`, `ResultsSection`, and the `ScreenOnly`/`PrintOnly` pair) and **4 existing pieces
changed**: `params-codec`'s `stringList` became generic over its element type; `useOriginList`
moved from the facilities feature to `shared/hooks` because bookings needed it too; the API client
gained `download`; and the shell, snackbar and breadcrumbs gained `print:hidden`. Of the six, only
`DateRangeFilter` and `ResultsSection` are list primitives; the others serve the record screen.
That is a small number, but not a trivial one: a record screen with history, a status and print
still wanted a status mark, a log and a dialog with fields that the earlier slices lacked.

**Still open, unchanged from earlier slices:** two disclosure primitives, two sheet primitives,
three skeleton patterns, and field errors styled apart from `Alert`. `ConfirmDialog` now sits
beside the older `useConfirm` hook; the hook is simpler (no fields, no failure state) and
nothing in the app uses it yet, so consider retiring it.

## Back-office primitives (`backoffice/`)

For the approval queue: an internal tool used all day by someone who already knows what
everything means. These live in their own directory so the public screens' set stays legible.

| Piece                            | Props                                                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DensityProvider` / `useDensity` | `density: comfortable \| compact`. Set once around a screen; the list primitives read it.                                                                             |
| `MasterDetailLayout`             | `master`, `detail`, `hasSelection`, `masterLabel`, `detailLabel`. Side by side from 768px, each scrolling alone; below it one column. `useSplitView()` reports which. |
| `QueueItem`                      | `to`, `selected`, `label`, `leading?`, `title`, `lines`, `flags?`, `itemId`, `linkRef?`. One link; the selected row is marked by bar and fill and `aria-current`.     |
| `DecisionDialog`                 | `title`, `description`, `tone?`, `confirmLabel`, `field` (label, value, required...), `initialFocus`, `onConfirm`, `describeFailure?`, `onContinue?`, `returnFocus?`. |
| `KeyboardShortcutHelp` / `Kbd`   | `open`, `onOpenChange`, `groups`. The reference opened with `?`.                                                                                                      |
| `useKeyboardShortcuts`           | `bindings: {keys, handler, when?}[]`. Never fires from a field, with Ctrl/Cmd/Alt, or while a dialog is open.                                                         |

**The density variant** is a context, not a prop on each primitive and not a fork. `compact` is
read by `SearchField`, `SortSelect`, `ResultsToolbar`, `ResultsGrid`, `Pagination`,
`ActiveFilterChips`, `CardSkeleton` (row) and `FilterButton`. `FilterPanel` gained
`placement="overlay"` (always a drawer, a side sheet from tablet width) because a queue and a
detail pane leave no room for a sidebar, `FilterButton` gained `alwaysVisible`, `SearchField`
gained `inputRef` (for the `/` shortcut) and `Badge` gained a `warning` tone.

**How well did the list primitives generalise?** Without a fork. The queue reuses `PageLayout`,
`SearchField`, `FilterPanel`, `FilterButton`, `FilterSection`, `CheckboxGroupFilter`,
`DateRangeFilter`, `ActiveFilterChips`, `ResultsToolbar`, `SortSelect`, `ResultsGrid` (rows),
`Pagination`, `EmptyState`, `SkeletonGrid`, `ErrorState`, `ReviewList`, `Alert` and `useUrlState`.

**Count for this slice: 4 components, 1 hook and 1 context added; 10 existing pieces changed**
(the eight density readers, `FilterPanel`, `Badge`); 3 modules moved to `shared` because a second
feature needed them (`BookingStatusBadge` and `STATUS_STYLES` to `ui/`; `describeWindow`,
`elapsed`, `joinNames`, `shortDate`, `dateAndTime` to `shared/utils/format`; `saveBlob` to
`shared/utils`). `DecisionDialog` overlaps `ConfirmDialog` from the last slice: both are an alert
dialog with a field and a failure. The difference is that this one blocks a required field,
treats some failures as final and keeps the text, and takes over where focus returns. If a third
screen needs either, merge them.

**Added for resource administration: 2 components and 1 hook; 5 existing pieces changed.** The
slice 5 `QuantityStepper` does not fit a dense grid cell, so it gained a **compact density variant**
(the bare number, with the arrow keys left to whatever moves between cells) rather than a second
component. `ImpactDialog` and `useImpactGuard` learned the resource reasons, to ask even where no
booking is affected (a catalogue change that discards what facilities hold), and became generic over
the impact type; `ArchiveConfirm`'s sentence can be replaced for something that is not a facility;
`ScheduleEditor`'s copy dialog returns focus. `EditableGrid` is generic and holds no resource logic.

**Added for users, reference data and the audit trail: 0 added, 2 changed, 1 moved.** The four
pieces the brief expected (`RoleAssignment`, `PermissionConfirmDialog`, `VersionedContentEditor`,
`AuditEntry`) were all written, and all stayed in the feature because each has a single user.
`ArchiveConfirm` gained `details`, for a list of what holds a figure against the thing being
archived; `ImpactDialog` gained the `no_approver` and `arrangement_archived` reasons; and
`ROLE_LABELS` moved from the app shell to `shared/auth`. The one strain the abstractions showed is
the unsaved-changes blocker (`useBlocker` plus a `ConfirmDialog`), now written out in six screens: the
next candidate to extract.

**Added for public content, landing and account: 3 components, 1 hook, 1 existing piece changed.**
`Footer` (on every route, and deliberately only the five public links, the municipality and the
year), `ContentPage` with `ContentSection` (a title, a readable measure, headed sections, and a print
masthead) and `PlaceholderNotice` (says on the page that its words are not the municipality's yet).
`useDocumentMeta` sets a route's title and description, and `usePageHeader` now uses it.
`ConfirmProvider` loads its dialog (`ConfirmPrompt`) the first time something asks, so the dialog
library is not part of what a visitor to the landing page downloads. `Hero` and `StepsList`, which
the brief expected, are in `features/public` because each is used once.

**Added for multi day bookings and the week view: 2 additions, 1 changed.** `WeekGrid` (with
`WeekBlock`) is a week as an ARIA grid of hour cells with blocks positioned by time over them; it knows
days, hours and blocks and nothing about availability. `useRangeSelect` chooses a run of days by two
clicks, a drag, or the keyboard, and knows nothing about what a day is. `DayCell` gained the run's
position (`only`, `start`, `middle`, `end`) drawn as one band, `rangeInvalid`, and pointer and focus
handlers. The slice 4 `Timeline` was not generalised for the week: it lists one day's stretches in
order, and the week is seven columns positioned by time.

**Still open, unchanged:** two disclosure primitives, two sheet primitives (the filter side sheet
is a third presentation of one), three skeleton patterns, and field errors styled apart from
`Alert`.

## Admin primitives (`admin/`)

For facility administration, where almost every change reaches bookings that already exist.

| Piece                 | Props                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useImpactGuard`      | Returns `{ guard, dialog }`. `guard({ check, apply, title, summary, confirmLabel })` checks, applies at once if nothing is affected, else asks. Render `dialog` once.  |
| `ImpactDialog`        | `open`, `onOpenChange`, `title`, `summary`, `impact`, `confirmLabel`, `describeReason?`, `onConfirm`. Names each affected booking and says confirming decides nothing. |
| `ImpactList`          | `impact`, `describeReason?`. The list on its own: reference, status, who, where, when and why.                                                                         |
| `ArchiveConfirm`      | `open`, `onOpenChange`, `facilityName`, `impact`, `onConfirm`. Asks even when nothing is affected.                                                                     |
| `SectionedEditLayout` | `sections: {id,label,flag?}[]`, `current`, `hrefFor`, children. Sections are links, so they are in the URL.                                                            |
| `HierarchySelect`     | `label`, `value`, `eligible`, `onChange`. Lists only the places given, so it cannot offer a cycle.                                                                     |
| `ScheduleEditor`      | `value: OperatingDay[]`, `onChange`, `errors?`. Open or Closed per day, times, and "Copy to other days".                                                               |
| `DateRangeField`      | `legend`, `value`, `onChange`, errors. `rangeToInstants(value, zone)` turns it into UTC instants in the facility's zone.                                               |
| `ImageManager`        | Images, pending uploads, accepted types and limits, and the callbacks. Every image needs a caption before it is uploaded.                                              |

**Count for this slice: 7 components and 1 hook added, no earlier primitive changed.** The list set
(`SearchField`, `FilterPanel` as an overlay, `FilterButton`, `FilterSection`, `CheckboxGroupFilter`,
`ActiveFilterChips`, `ResultsToolbar`, `SortSelect`, `ResultsGrid`, `Pagination`, `EmptyState`,
`SkeletonGrid`, `ErrorState`) was reused at the compact density from the last slice, and
`ConfirmDialog`, `FormField`, `Section`, `DetailHeader`, `NotFoundState`, `Alert`, `Badge` and
`StatusBadge` as they were. Only `useImpactGuard`/`ImpactDialog`, `ArchiveConfirm` and
`SectionedEditLayout` are shared by design; the other four have one user and are candidates to move
into the feature if the next slices do not need them. `ImpactDialog` and `ConfirmDialog` overlap (an
alert dialog with a list and a failure); `ImpactDialog` is a thin wrapper over `ConfirmDialog`
rather than a second dialog.

**Still open, unchanged:** two disclosure primitives, two sheet primitives, three skeleton patterns,
and field errors styled apart from `Alert`. `DecisionDialog` and `ConfirmDialog` remain two
confirmation dialogs.

## Form primitives (`form/`)

| Component           | Props                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FormField`         | `id`, `label`, `hint?`, `error?`, `required?`, children `(control) => input`. Links hint and error by `aria-describedby`; error is a live `alert`. |
| `FieldGroup`        | `legend`, `hint?`, children. A `fieldset`.                                                                                                         |
| `CheckboxField`     | `id`, `label`, `checked`, `onChange`, `hint?`, `error?`, `disabled?`                                                                               |
| `ErrorSummary`      | `errors: {fieldId,message}[]`, `title?`, `focusSignal`. Links to fields; takes focus on signal.                                                    |
| `FormStepper`       | `steps: {id,label,status,reachable}[]`, `onSelect`. State of every step in text.                                                                   |
| `QuantityStepper`   | `name`, `value`, `onChange`, `min?`, `max?`. Buttons plus direct entry; a cap is explained.                                                        |
| `FileUpload`        | `acceptedTypes`, `maxFileSizeBytes`, `maxFiles`, `items`, `onSelect`, `onRemove`, `onRetry`. Native input first, drag and drop on top.             |
| `ReviewList`        | `items: {key,label,value,onEdit?}[]`. A definition list with edit actions.                                                                         |
| `ConfirmationPanel` | `title`, `summary?`, `reference`, `status?`, `details`, children, `actions?`                                                                       |
| `AutosaveIndicator` | `status`, `savedAtLabel?`, `onRetry?`. A polite status.                                                                                            |

**Is the shared set stabilising?** Mostly, but not yet enough to start the design language.
The form, calendar and detail families have each settled into a consistent pattern, and this
screen needed no change to any earlier primitive's API (`Disclosure`, `Alert`, `ErrorState`,
`NotFoundState`, `KeyFacts`, `Skeleton` were reused as is). Against that, the three open problems
from the calendar slice are still open and this slice added a fourth: **there are now two
disclosure primitives, two sheet primitives and three skeleton patterns, and a field error is
styled by `FormField` and `CheckboxField` separately from `Alert`.** Resolve those four
(one disclosure, one sheet, one status primitive, one error style) and the set is ready.
Changes made here: `CheckboxField` keeps the hint outside the label so the control's name is just
its label; `useUrlState` now applies updates to the URL as it is at call time (a late asynchronous
update was putting an old URL back); the query client lets a mutation opt out of the global toast
with `meta: { silent: true }`.

## Calendar primitives (`calendar/`)

| Component             | Props                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `CalendarMonthGrid`   | `month`, `zone`, `today`, `label`, `renderDay(day, {tabIndex, inMonth, today})`, `onMonthChange`, `initialFocus?`, `busy?` |
| `CalendarSkeleton`    | `label?`. Same table structure and cell height as the grid.                                                                |
| `DayCell`             | `date`, `name`, `selected?`, `today?`, `muted?`, `disabled?`, `surface?`, `bar?`, `tabIndex`, `onSelect`, children         |
| `MonthNavigator`      | `month`, `onChange`, `min`, `max`. Previous/next, month and year selects, polite live region.                              |
| `Timeline`            | `window`, `entries: {key,start,end,label,pattern,icon?,detail?,action?}[]`, `label`                                        |
| `TimeRangeSelect`     | `window`, `unavailable: {start,end,reason}[]`, `earliest?`, `minDurationMinutes`, `stepMinutes?`, `value`, `onChange`      |
| `Legend`              | `title?`, `items: {key,label,description?,swatch}[]`                                                                       |
| `SidePanel`           | `open`, `onClose`, `title`, `returnFocus?`, children. Panel from `lg`, bottom sheet below.                                 |
| `SelectionSummaryBar` | `summary`, `onChange?`, `onClear`, children (the action)                                                                   |
| `Swatch` / patterns   | `pattern`: `solid striped dotted crosshatch outline dashed faded`, drawn in the text colour                                |

Statuses are told apart by **pattern, icon and words**, never colour alone. The patterns are plain
CSS classes in `theme.css`. `CalendarMonthGrid` knows nothing about availability: the caller says
what a day is and what to draw. The grid is always six weeks, so its height never changes, and
`Timeline` and `TimeRangeSelect` take plain intervals and reasons.

## Where slice 3 and 4 primitives had to change, or did not fit

- **Two sheet primitives now.** `FilterPanel` (full screen drawer, `returnFocusRef`) and
  `SidePanel` (panel or bottom sheet, `returnFocus()` function) are both a modal Radix dialog with
  explicit focus return. Same job, two different APIs. _Recommendation:_ one `Sheet` primitive with
  a placement prop and one focus return convention. This is the clearest sign the abstraction is
  not settled.
- **A status vocabulary exists in three places.** `Badge` tones, `Alert` severities and the
  calendar's `Swatch` patterns each express "state" differently, and only the calendar meets the
  "never colour alone" bar by itself. _Recommendation:_ one status primitive carrying icon, pattern
  and text, used by badges, alerts and the legend.
- **`useUrlState` had to change.** It dropped router state on every update, which lost the "where
  did I come from" state the detail page relies on once the calendar began writing to the query
  string. It now carries the current state through. `params-codec` gained `param.matching(regex)`.
- **`StickyActionBar` clearance grew** (`pb-56`) because the bar now also holds a selection summary
  on small screens. A bar of variable height wants measuring, not a constant.
- **Three skeletons.** `CardSkeleton`, `DetailSkeleton` and `CalendarSkeleton` each mirror one
  layout. They are consistent in approach (reuse the layout's own structure) but share no code.
- **No change was needed** to `Section`, `Alert`, `ErrorState`, `ErrorBoundary` or `Skeleton`. The
  error boundary and `ErrorState` contained a calendar failure with no work, which is a good sign.
  `Disclosure` and `Breadcrumbs` were not used by this screen.

## Where slice 2 primitives had to change, or did not fit

This is the second use of these patterns, so the strain points are the useful signal.

- **`PageLayout` and the shell breadcrumb region do not fit a detail page.** `PageLayout` couples a
  plain header to breadcrumbs published to the shell. A detail header needs its own breadcrumbs,
  a back action, a status and a free slot, so the detail screen bypasses `PageLayout` (it only
  calls `usePageHeader` for the document title) and `DetailHeader` renders `Breadcrumbs` itself.
  The shell region and `PageLayout`'s `breadcrumbs` prop are now redundant with `DetailHeader`.
  _Recommendation:_ drop the shell breadcrumb region and let every header own its crumbs.
  Changed: `Crumb` gained `state`; `ShellBreadcrumbs` now wraps `Breadcrumbs`.
- **Two collapsible primitives.** `FilterSection` (native `<details>`) and `Disclosure` (Radix
  collapsible) do the same job. The disclosure needed an explicit `aria-expanded` and an unmounted
  closed body, which `<details>` does not give; the filter section needs neither. _Recommendation:_
  pick one in the design language pass (Radix everywhere is the safer default).
- **The resource list is generic but lives in the feature.** `FacilityResources` renders a
  "label and quantity" list that every detail screen will want. Left in `features/facilities`
  until a second use proves its shape.
- **`EmptyState` served as the not found state** with an `icon`, via `NotFoundState`, with no
  change. `Alert` was used for notices as is. `Badge` needed no change.
- **`Gallery` focus return.** The brief says focus returns to "the thumbnail that opened" the
  expanded view. Thumbnails here choose the primary image and the expanded view opens from the
  primary image, so focus returns to that control. If thumbnails should open it directly, the
  gallery needs a different interaction model.
- **`StickyActionBar` is one element, not two.** It is fixed on small screens and in flow from `lg`,
  so the action is never duplicated in the DOM. This puts the action inside the sidebar's sticky
  container on desktop, which is why it needs the container to be a normal flow parent.

## Decisions (and the alternative)

- **Page header lives in the page.** `PageLayout` renders `PageHeader` itself; the shell shows only
  breadcrumbs. _Alternative:_ keep the title in the shell and pass extras through context.
- **Drawer state is owned by the page, not `FilterPanel`.** The trigger lives in the toolbar and
  the panel beside the results. `returnFocusRef` restores focus explicitly because Safari does not
  focus buttons on click. _Alternative:_ a `useFilterPanel()` hook returning trigger and panel props.
- **One mounted copy of the filters, chosen by `useMediaQuery`.** Rendering sidebar and drawer
  together would duplicate every control and label. _Alternative:_ CSS only, both mounted.
- **Filters apply immediately,** including in the mobile drawer, whose footer shows the live count.
  _Alternative:_ draft state applied on confirm.
- **Slider commits on release, numeric inputs on blur or Enter,** so dragging fires no requests.
- **Card columns come from container queries,** so the shell navigation and filter sidebar never
  squeeze cards. One column under 28rem, two from there, three from 42rem, four from 56rem of
  results width. _Alternative:_ viewport breakpoints, as briefed; they need per screen overrides.
- **Cards are one link without nesting.** The title anchor stretches over the card; the card shows
  the focus ring through `has-[a:focus-visible]`. _Alternative:_ wrap the card in the anchor.
- **Chips are single buttons** (`aria-label="Remove filter: X"`), so Enter, Space and click all remove.
- **`CardSkeleton` takes row kinds, not a copy of the card.** The card reserves each row's height
  even when empty, so skeleton and card agree and height does not depend on content.
- **`ResultsGrid` renders `ul`/`li`, and list view is `layout="rows"`.** No separate list component.
- **Search commits with `replace`, filters and pagination with `push`.** Back steps through filter
  changes, not through every settled search term.
- **Native elements first:** `<details>` for sections, `<select>` for sort, checkbox inputs for
  filters and the switch. Radix only where focus management or complex keyboard behaviour is needed.
