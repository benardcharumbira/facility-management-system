import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

/** What every focusable thing in the grid must carry, so the grid can move focus between them. */
export interface GridFocusProps {
  tabIndex: 0 | -1;
  'data-grid-r': number;
  'data-grid-c': number;
}

export interface GridGroup<R> {
  id: string;
  label: string;
  /** Said beside the label, e.g. "14 resources". */
  summary?: string;
  collapsed: boolean;
  onToggle: () => void;
  rows: R[];
}

export interface EditableGridProps<R extends { id: string }, C extends { id: string }> {
  /** Names the table for assistive technology. */
  caption: string;
  /** The heading of the first column, e.g. "Resource". */
  cornerLabel: string;
  columns: C[];
  groups: Array<GridGroup<R>>;
  /** The content of a column header. Put the focus props on its one interactive element, if any. */
  renderColumnHeader: (column: C, focus: GridFocusProps) => ReactNode;
  renderRowHeader: (row: R, focus: GridFocusProps) => ReactNode;
  /** The editable control of a cell. Put the focus props on it, and give it a name carrying both headers. */
  renderCell: (row: R, column: C, focus: GridFocusProps) => ReactNode;
}

interface Position {
  r: number;
  c: number;
}

const isTextInput = (el: Element): el is HTMLInputElement =>
  el instanceof HTMLInputElement &&
  (el.type === 'text' || el.type === 'number' || el.type === 'search');

/**
 * A table of editable cells, usable without a mouse. Real table semantics (every cell is under its
 * column header and row header), sticky first column and header row, rows in collapsible groups.
 *
 * Keyboard: the whole grid is one tab stop, and the arrow keys move between its controls, the
 * cells, the column headers and the row headers. In a text field the arrow keys move the caret
 * until it reaches the end, then move on, so typing and moving do not fight. Home and End jump to
 * the ends of a row.
 */
export function EditableGrid<R extends { id: string }, C extends { id: string }>({
  caption,
  cornerLabel,
  columns,
  groups,
  renderColumnHeader,
  renderRowHeader,
  renderCell,
}: EditableGridProps<R, C>) {
  const table = useRef<HTMLTableElement>(null);

  // Lay out coordinates: row 0 is the header, then each group's heading row and its rows if open.
  // Column 0 is the row header and columns 1 to n the data.
  const layout: Array<{
    group: GridGroup<R>;
    headingRow: number;
    rows: Array<{ row: R; r: number }>;
  }> = [];
  let cursor = 1;
  for (const group of groups) {
    const headingRow = cursor;
    cursor += 1;
    const rows: Array<{ row: R; r: number }> = [];
    if (!group.collapsed) {
      for (const row of group.rows) {
        rows.push({ row, r: cursor });
        cursor += 1;
      }
    }
    layout.push({ group, headingRow, rows });
  }
  const next = cursor;
  const width = columns.length;
  const firstDataRow = layout.flatMap((g) => g.rows)[0]?.r;

  const valid = ({ r, c }: Position): boolean => {
    if (c < 0 || c > width) return false;
    if (r === 0) return c >= 1;
    if (layout.some((g) => g.headingRow === r)) return c === 0;
    return layout.some((g) => g.rows.some((x) => x.r === r));
  };

  const fallback: Position =
    firstDataRow !== undefined ? { r: firstDataRow, c: 1 } : { r: 0, c: 1 };
  const [active, setActive] = useState<Position>(fallback);
  const current = valid(active) ? active : fallback;

  const focusProps = (r: number, c: number): GridFocusProps => ({
    tabIndex: r === current.r && c === current.c ? 0 : -1,
    'data-grid-r': r,
    'data-grid-c': c,
  });

  const focusAt = (position: Position) => {
    const el = table.current?.querySelector<HTMLElement>(
      `[data-grid-r="${position.r}"][data-grid-c="${position.c}"]`,
    );
    if (!el) return;
    el.focus();
    if (isTextInput(el)) el.select();
  };

  const lastRow = next - 1;
  /** The nearest valid position in a direction, skipping over places with nothing to focus. */
  const step = (from: Position, dr: number, dc: number): Position | null => {
    let at = { r: from.r + dr, c: from.c + dc };
    while (at.r >= 0 && at.r <= lastRow && at.c >= 0 && at.c <= width) {
      if (valid(at)) return at;
      at = { r: at.r + dr, c: at.c + dc };
    }
    return null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement;
    // Menus and dialogs opened from a cell are portalled but still bubble through React.
    if (!table.current?.contains(target)) return;
    const holder = target.closest<HTMLElement>('[data-grid-r]');
    if (!holder || event.ctrlKey || event.metaKey || event.altKey) return;
    const here = { r: Number(holder.dataset.gridR), c: Number(holder.dataset.gridC) };

    const text = isTextInput(target) ? target : null;
    const caretAtStart = !text || (text.selectionStart === 0 && text.selectionEnd === 0);
    const caretAtEnd =
      !text ||
      (text.selectionStart === text.value.length && text.selectionEnd === text.value.length);
    // A selected value (as when arriving in a cell) is replaced by typing; moving on is still fine.
    const wholeSelected =
      !!text && text.selectionStart === 0 && text.selectionEnd === text.value.length;

    let to: Position | null | undefined;
    switch (event.key) {
      case 'ArrowDown':
        to = step(here, 1, 0);
        break;
      case 'ArrowUp':
        to = step(here, -1, 0);
        break;
      case 'ArrowRight':
        if (caretAtEnd || wholeSelected) to = step(here, 0, 1);
        break;
      case 'ArrowLeft':
        if (caretAtStart || wholeSelected) to = step(here, 0, -1);
        break;
      case 'Home':
        if (caretAtStart || wholeSelected) {
          to = [0, 1].map((c) => ({ r: here.r, c })).find(valid) ?? null;
        }
        break;
      case 'End':
        if (caretAtEnd || wholeSelected) {
          to = [width, 0].map((c) => ({ r: here.r, c })).find(valid) ?? null;
        }
        break;
      default:
        return;
    }
    if (to === undefined) return; // let the field have the key
    event.preventDefault();
    if (to) focusAt(to);
  };

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-line bg-surface">
      <table
        ref={table}
        role="grid"
        aria-label={caption}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          const holder = (event.target as HTMLElement).closest<HTMLElement>('[data-grid-r]');
          if (holder)
            setActive({ r: Number(holder.dataset.gridR), c: Number(holder.dataset.gridC) });
        }}
        className="w-max min-w-full border-separate border-spacing-0 text-sm"
      >
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky top-0 left-0 z-30 min-w-52 border-r border-b border-line bg-sunken px-3 py-2 text-left font-semibold"
            >
              {cornerLabel}
            </th>
            {columns.map((column, index) => (
              <th
                key={column.id}
                scope="col"
                className="sticky top-0 z-20 min-w-28 border-b border-line bg-sunken px-2 py-2 text-left align-bottom font-semibold"
              >
                {renderColumnHeader(column, focusProps(0, index + 1))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {layout.map(({ group, headingRow, rows }) => (
            <Fragment key={group.id}>
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={width + 1}
                  className="sticky left-0 border-b border-line bg-primary-soft px-3 py-1.5 text-left"
                >
                  <button
                    type="button"
                    {...focusProps(headingRow, 0)}
                    aria-expanded={!group.collapsed}
                    onClick={group.onToggle}
                    className="inline-flex items-center gap-1.5 rounded-sm font-semibold text-primary"
                  >
                    {group.collapsed ? (
                      <ChevronRight aria-hidden className="size-4" />
                    ) : (
                      <ChevronDown aria-hidden className="size-4" />
                    )}
                    {group.label}
                    {group.summary && (
                      <span className="font-normal text-muted"> ({group.summary})</span>
                    )}
                  </button>
                </th>
              </tr>
              {rows.map(({ row, r }) => (
                <tr key={row.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-r border-b border-line bg-surface px-3 py-1 text-left font-medium"
                  >
                    {renderRowHeader(row, focusProps(r, 0))}
                  </th>
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      role="gridcell"
                      className={cn('border-b border-line px-2 py-1 text-center align-middle')}
                    >
                      {renderCell(row, column, focusProps(r, index + 1))}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
