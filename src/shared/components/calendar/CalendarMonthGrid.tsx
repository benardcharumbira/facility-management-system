import type { DateTime } from 'luxon';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import {
  DAYS_PER_WEEK,
  GRID_WEEKS,
  firstOfMonth,
  monthGridDays,
  yearMonthOf,
  type YearMonth,
} from '@/shared/utils/calendar';
import { CELL_HEIGHT } from './DayCell';

export interface DayRenderContext {
  /** Roving tabindex: 0 for the one cell in the tab order, -1 for the rest. */
  tabIndex: 0 | -1;
  inMonth: boolean;
  today: boolean;
}

export interface CalendarMonthGridProps {
  month: YearMonth;
  zone: string;
  /** "Today" in `zone`. */
  today: DateTime;
  /** Where the roving focus starts when it has to pick a cell, e.g. the selected day. */
  initialFocus?: string;
  /** Names the grid, e.g. "November 2026". */
  label: string;
  busy?: boolean;
  /** Draws one day. Everything about what a day means belongs to the caller. */
  renderDay: (day: DateTime, context: DayRenderContext) => ReactNode;
  /** Called when keyboard movement leaves the month. */
  onMonthChange: (month: YearMonth) => void;
}

const WEEKDAYS = [
  ['Mon', 'Monday'],
  ['Tue', 'Tuesday'],
  ['Wed', 'Wednesday'],
  ['Thu', 'Thursday'],
  ['Fri', 'Friday'],
  ['Sat', 'Saturday'],
  ['Sun', 'Sunday'],
] as const;

/**
 * A month as an ARIA grid: six Monday-first weeks, a roving tabindex, and the usual keys.
 * Arrows move by day (left, right) or week (up, down), Home and End go to the start and end of
 * the week, and Page Up and Page Down move by month. Always six rows so the height is constant.
 */
export function CalendarMonthGrid({
  month,
  zone,
  today,
  initialFocus,
  label,
  busy = false,
  renderDay,
  onMonthChange,
}: CalendarMonthGridProps) {
  const days = monthGridDays(month, zone);
  const gridRef = useRef<HTMLTableElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const [focused, setFocused] = useState<string | undefined>(initialFocus);

  const isoOf = (d: DateTime) => d.toISODate() ?? '';
  const visible = new Set(days.map(isoOf));
  const monthStart = isoOf(firstOfMonth(month, zone));
  const todayIso = isoOf(today);
  const inThisMonth = (iso: string) => iso.startsWith(monthStart.slice(0, 7));
  const tabDate =
    focused && visible.has(focused) && inThisMonth(focused)
      ? focused
      : initialFocus && inThisMonth(initialFocus)
        ? initialFocus
        : inThisMonth(todayIso)
          ? todayIso
          : monthStart;

  // After a keyboard move that changed the month, focus lands on the new cell. The cell can move
  // within the table once the new month's grid replaces the old one (which drops focus), so the
  // intent is kept until the target sits in the displayed month, and focus is restored as needed.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-date="${target}"]`);
    if (!el) return;
    if (document.activeElement !== el) el.focus();
    if (inThisMonth(target)) pendingFocus.current = null;
  });

  const move = (from: DateTime, to: DateTime) => {
    const target = isoOf(to);
    setFocused(target);
    pendingFocus.current = target;
    if (from.month !== to.month || from.year !== to.year) onMonthChange(yearMonthOf(to));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const iso = (event.target as HTMLElement).closest<HTMLElement>('[data-date]')?.dataset.date;
    if (!iso) return;
    const from = days.find((d) => isoOf(d) === iso);
    if (!from) return;

    let to: DateTime | undefined;
    switch (event.key) {
      case 'ArrowLeft':
        to = from.minus({ days: 1 });
        break;
      case 'ArrowRight':
        to = from.plus({ days: 1 });
        break;
      case 'ArrowUp':
        to = from.minus({ weeks: 1 });
        break;
      case 'ArrowDown':
        to = from.plus({ weeks: 1 });
        break;
      case 'Home':
        to = from.minus({ days: from.weekday - 1 });
        break;
      case 'End':
        to = from.plus({ days: 7 - from.weekday });
        break;
      case 'PageUp':
        to = from.minus({ months: 1 });
        break;
      case 'PageDown':
        to = from.plus({ months: 1 });
        break;
      default:
        return;
    }
    event.preventDefault();
    move(from, to);
  };

  return (
    <table
      ref={gridRef}
      role="grid"
      aria-label={label}
      aria-busy={busy}
      onKeyDown={onKeyDown}
      className="w-full table-fixed border-collapse"
    >
      <thead>
        <tr>
          {WEEKDAYS.map(([short, full]) => (
            <th
              key={full}
              scope="col"
              abbr={full}
              className="border border-line bg-sunken py-1.5 text-xs font-medium text-muted"
            >
              {short}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: GRID_WEEKS }, (_, week) => (
          <tr key={week}>
            {days.slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK).map((day) => {
              const dayIso = isoOf(day);
              return (
                <td key={dayIso} role="gridcell" className="border border-line p-0 align-top">
                  {renderDay(day, {
                    tabIndex: dayIso === tabDate ? 0 : -1,
                    inMonth: day.month === month.month && day.year === month.year,
                    today: dayIso === todayIso,
                  })}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Placeholder with the grid's exact structure and dimensions, for use while loading. */
export function CalendarSkeleton({ label = 'Loading calendar' }: { label?: string }) {
  return (
    <table aria-busy aria-label={label} className="w-full table-fixed border-collapse">
      <thead>
        <tr>
          {WEEKDAYS.map(([short, full]) => (
            <th
              key={full}
              scope="col"
              className="border border-line bg-sunken py-1.5 text-xs font-medium text-muted"
            >
              {short}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: GRID_WEEKS }, (_, week) => (
          <tr key={week}>
            {Array.from({ length: DAYS_PER_WEEK }, (_, day) => (
              <td key={day} className="border border-line p-0">
                <div className={cn('p-1', CELL_HEIGHT)}>
                  <div className="size-6 rounded-full bg-sunken motion-safe:animate-pulse" />
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
