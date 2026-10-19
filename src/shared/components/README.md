# Shared list screen primitives

Extracted while building the facilities browse screen. None contain facility logic; the facility
composition lives in `features/facilities`. Input to the design language review, not a manual.
Hooks and utilities that go with them: `shared/hooks/useUrlState`, `shared/utils/params-codec`,
`shared/hooks/useSessionStorageState`.

## What was extracted

| Primitive                       | Props                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `PageHeader`                    | `title`, `description?`, `meta?` (e.g. count), `actions?`                                |
| `PageLayout` (changed)          | `PageHeader` props + `breadcrumbs?`. Renders the header, publishes breadcrumbs to shell. |
| `SearchField`                   | `value` (committed), `onChange`, `label`, `placeholder?`, `debounceMs?` (300)            |
| `FilterPanel`                   | `open`, `onClose`, `title?`, `closeLabel?`, `onClearAll?`, `returnFocusRef?`, children   |
| `FilterButton`                  | `activeCount`, `onClick`, `ref`. Hidden where the panel is a sidebar.                    |
| `FilterSection`                 | `title`, `activeCount?`, `defaultExpanded?`, children                                    |
| `CheckboxGroupFilter` (extra)   | `label`, `options: {value,label,count?}[]`, `selected`, `onChange`                       |
| `RangeFilter` (extra)           | `label`, `bounds`, `value: {min,max}`, `onChange`. Slider plus numeric inputs.           |
| `ActiveFilterChips`             | `filters: {key,label,onRemove}[]`, `onClearAll`. Renders nothing when empty.             |
| `ResultsToolbar`                | `countLabel?`, `leading?`, `sort?`, `viewToggle?`. Count is a polite live region.        |
| `SortSelect`                    | `value`, `options`, `onChange`, `label?`                                                 |
| `ViewToggle` (extra)            | `value`, `options: {value,label,icon}[]`, `onChange`, `label?`                           |
| `ResultsGrid`                   | `columns?: {xs..xl}`, `label?`. A `ul` of equal height cells.                            |
| `Pagination`                    | `envelope: {page,totalPages}`, `onChange`. Renders nothing for one page.                 |
| `CardSkeleton` / `SkeletonGrid` | `layout: card \| row`, `hasMedia?`, `rows` (typography variants or spacing units)        |
| `EmptyState` (extended)         | `title`, `description?`, `icon?`, `action?`                                              |
| `VisuallyHidden` (extra)        | children. Text for assistive technology only.                                            |

`ShellBreadcrumbs` is the old shell title region reduced to breadcrumbs.

## Decisions (and the alternative)

- **Page header moved into the page.** Slice 1's shell rendered the `h1` from context. Now `PageLayout`
  renders `PageHeader` itself (it needs description, meta and actions) and the shell shows only
  breadcrumbs. _Alternative:_ keep the title in the shell and pass the extras through context.
  Rejected: more indirection for no gain.
- **Drawer state is owned by the page, not `FilterPanel`.** The trigger lives in the toolbar and the
  panel lives beside the results, so neither can own the other. `returnFocusRef` restores focus
  explicitly because Safari does not focus buttons on click. _Alternative:_ a `useFilterPanel()`
  hook returning trigger props and panel props.
- **One mounted copy of the filters, chosen by `useMediaQuery`.** Rendering both sidebar and drawer
  would duplicate every control and label. Cost: a flash on first paint if the viewport differs
  from the initial guess. _Alternative:_ CSS only, with both mounted.
- **Filters apply immediately, with no "Apply" button,** including inside the mobile drawer; the
  footer shows the live count ("Show 12 facilities"). _Alternative:_ draft state applied on confirm.
- **Slider commits on release, number inputs on blur or Enter,** so dragging does not fire requests.
- **Grid columns follow the brief by breakpoint, but the facilities page uses 3 columns at `lg`
  and 4 from `xl`.** At `lg` the shell navigation and the 280px sidebar leave roughly 600px for
  results, too narrow for four cards. The primitive's default is the briefed 1/2/3/4.
  _Alternative:_ container queries, so columns follow available width rather than the viewport.
- **Chips are clickable as well as deletable,** so Enter and Space remove a filter, not only
  Backspace or Delete. Each chip carries `aria-label="Remove filter: X"`.
- **`CardSkeleton` takes rows, not a copy of the card.** The facility card exports its row list so
  skeleton and card agree on height. This is approximate by design; the card also reserves every
  row, even empty ones, so card height does not depend on content. _Alternative:_ render the real
  card with `Skeleton` children.
- **`ResultsGrid` renders `ul`/`li`, and list view reuses it with one column.** There is no separate
  list component.
- **Search commits with `replace`, filters and pagination with `push`.** Back steps through filter
  changes, not through every settled search term.
