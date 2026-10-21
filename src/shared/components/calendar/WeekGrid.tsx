import type { DateTime } from 'luxon';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

/** The vertical axis, in minutes after midnight. Whole hours. */
export interface WeekAxis {
  start: number;
  end: number;
}

export interface WeekGridProps {
  /** The seven days, Monday first, each at the start of its day in the facility zone. */
  days: DateTime[];
  /** "Today" in the same zone, at the start of the day. */
  today: DateTime;
  /** The current instant in the same zone, for the marker on today's column. */
  now: DateTime;
  axis: WeekAxis;
  /** Names the grid, e.g. "2 to 8 November 2026". */
  label: string;
  busy?: boolean;
  /** Where the roving focus starts when it has to pick a cell. */
  initialFocus?: string;
  /** Draws what is on one day, as `WeekBlock`s. Decorative: the cell names carry the meaning. */
  renderBlocks: (day: DateTime) => ReactNode;
  /** The full accessible name of the hour starting at `hour` (minutes after midnight) on a day. */
  cellName: (day: DateTime, hour: number) => string;
  onSelect: (day: DateTime, hour: number) => void;
  /** Keyboard movement left the week: show this Monday, with focus landing on `focus`. */
  onWeekChange: (monday: DateTime, focus: string) => void;
}

const ROW_HEIGHT = 'h-12';
const hourLabel = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Places a block by time on a day's column. Pieces of one span join across columns. */
export function WeekBlock({
  axis,
  startMinutes,
  endMinutes,
  joinBefore = false,
  joinAfter = false,
  className,
  children,
}: {
  axis: WeekAxis;
  startMinutes: number;
  endMinutes: number;
  /** The block continues from the previous day: square off and close the gap on that side. */
  joinBefore?: boolean;
  joinAfter?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const span = axis.end - axis.start;
  const from = Math.max(axis.start, startMinutes);
  const to = Math.min(axis.end, endMinutes);
  if (to <= from) return null;
  return (
    <div
      aria-hidden
      style={{
        top: `${((from - axis.start) / span) * 100}%`,
        height: `${((to - from) / span) * 100}%`,
      }}
      className={cn(
        'absolute overflow-hidden p-0.5 text-xs leading-tight',
        joinBefore ? 'left-0 rounded-l-none border-l-0' : 'left-0.5 rounded-l-md',
        joinAfter ? 'right-0 rounded-r-none border-r-0' : 'right-0.5 rounded-r-md',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A week as an ARIA grid: seven day columns against a time axis, a cell for every hour. The
 * arrow keys move between hours and days, Page Up and Page Down by week, Home and End to the first
 * and last day of the week; leaving the week by the arrows moves to the next or previous one.
 * What is booked is drawn over the cells as blocks positioned by time, so an hourly venue can be
 * read at a glance and a span of days reads as one continuous block. The blocks are a picture; each
 * cell's name says what is there.
 */
export function WeekGrid({
  days,
  today,
  now,
  axis,
  label,
  busy = false,
  initialFocus,
  renderBlocks,
  cellName,
  onSelect,
  onWeekChange,
}: WeekGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const pending = useRef<{ date: string; hour: number } | null>(null);
  const [focused, setFocused] = useState<{ date: string; hour: number } | undefined>();

  const isoOf = (d: DateTime) => d.toISODate() ?? '';
  const dates = days.map(isoOf);
  const hours: number[] = [];
  for (let m = axis.start; m < axis.end; m += 60) hours.push(m);
  const todayIso = isoOf(today);
  const firstHour = hours[0] ?? axis.start;
  const lastHour = hours[hours.length - 1] ?? axis.start;

  const tab = (() => {
    if (focused && dates.includes(focused.date) && hours.includes(focused.hour)) return focused;
    const date =
      initialFocus && dates.includes(initialFocus)
        ? initialFocus
        : dates.includes(todayIso)
          ? todayIso
          : (dates[0] ?? '');
    return { date, hour: firstHour };
  })();

  // After a keyboard move into another week, focus lands once that week's cells are on screen.
  useEffect(() => {
    const target = pending.current;
    if (!target) return;
    const el = gridRef.current?.querySelector<HTMLElement>(
      `[data-date="${target.date}"][data-hour="${target.hour}"]`,
    );
    if (!el) return;
    if (document.activeElement !== el) el.focus();
    if (dates.includes(target.date)) pending.current = null;
  });

  const go = (date: string, hour: number) => {
    const clamped = Math.min(lastHour, Math.max(firstHour, hour));
    setFocused({ date, hour: clamped });
    pending.current = { date, hour: clamped };
    if (!dates.includes(date)) {
      const first = days[0];
      if (!first) return;
      const moved = date < (dates[0] ?? '') ? first.minus({ weeks: 1 }) : first.plus({ weeks: 1 });
      onWeekChange(moved, date);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-date]');
    const date = cell?.dataset.date;
    const hour = Number(cell?.dataset.hour);
    const from = days.find((d) => isoOf(d) === date);
    if (!date || Number.isNaN(hour) || !from) return;

    const shift = (n: number) => isoOf(from.plus({ days: n }));
    switch (event.key) {
      case 'ArrowLeft':
        go(shift(-1), hour);
        break;
      case 'ArrowRight':
        go(shift(1), hour);
        break;
      case 'ArrowUp':
        go(date, hour - 60);
        break;
      case 'ArrowDown':
        go(date, hour + 60);
        break;
      case 'PageUp':
        go(shift(-7), hour);
        break;
      case 'PageDown':
        go(shift(7), hour);
        break;
      case 'Home':
        go(shift(-(from.weekday - 1)), hour);
        break;
      case 'End':
        go(shift(7 - from.weekday), hour);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const span = axis.end - axis.start;
  const nowMinutes = now.diff(now.startOf('day'), 'minutes').minutes;
  const showNow = dates.includes(todayIso) && nowMinutes >= axis.start && nowMinutes <= axis.end;

  return (
    <div className="overflow-x-auto">
      <div
        ref={gridRef}
        role="grid"
        aria-label={label}
        aria-busy={busy}
        aria-rowcount={hours.length + 1}
        aria-colcount={8}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="min-w-lg"
      >
        <div role="row" className="flex border-b border-line bg-sunken">
          <div role="columnheader" aria-label="Time" className="w-12 shrink-0" />
          {days.map((day) => {
            const iso = isoOf(day);
            const isToday = iso === todayIso;
            return (
              <div
                key={iso}
                role="columnheader"
                aria-label={
                  day.setLocale('en').toFormat('cccc d LLLL') + (isToday ? ', today' : '')
                }
                className={cn(
                  'min-w-0 flex-1 border-l border-line py-1.5 text-center text-xs',
                  isToday ? 'font-semibold text-primary' : 'text-muted',
                )}
              >
                <span aria-hidden className="block">
                  {day.setLocale('en').toFormat('ccc')}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'mx-auto flex size-6 items-center justify-center rounded-full text-sm font-medium',
                    isToday ? 'bg-primary text-on-primary' : 'text-ink',
                  )}
                >
                  {day.day}
                </span>
              </div>
            );
          })}
        </div>
        <div className="relative">
          {hours.map((hour) => (
            <div key={hour} role="row" className={cn('flex border-b border-line', ROW_HEIGHT)}>
              <div
                role="rowheader"
                className="w-12 shrink-0 pr-1 text-right text-xs text-muted tabular-nums"
              >
                {hourLabel(hour)}
              </div>
              {days.map((day) => {
                const iso = isoOf(day);
                return (
                  <div key={iso} role="gridcell" className="min-w-0 flex-1 border-l border-line">
                    <button
                      type="button"
                      data-date={iso}
                      data-hour={hour}
                      aria-label={cellName(day, hour)}
                      tabIndex={iso === tab.date && hour === tab.hour ? 0 : -1}
                      onClick={() => {
                        setFocused({ date: iso, hour });
                        onSelect(day, hour);
                      }}
                      className="block size-full cursor-pointer -outline-offset-2 hover:bg-primary-soft/60"
                    />
                  </div>
                );
              })}
            </div>
          ))}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 left-12 flex">
            {days.map((day) => {
              const iso = isoOf(day);
              return (
                <div key={iso} className="relative min-w-0 flex-1">
                  {renderBlocks(day)}
                  {showNow && iso === todayIso && (
                    <div
                      data-now
                      style={{ top: `${((nowMinutes - axis.start) / span) * 100}%` }}
                      className="absolute inset-x-0 z-10 border-t-2 border-danger"
                    >
                      <span className="absolute -top-1.5 -left-1 size-2.5 rounded-full bg-danger" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
