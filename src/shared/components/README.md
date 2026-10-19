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
