import type { DateTime } from 'luxon';
import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import { patternClass, type Pattern } from './patterns';

export interface DayBarSegment {
  /** Share of the day, 0 to 1. */
  fraction: number;
  pattern: Pattern;
  /** Text colour class: the pattern draws in it. */
  className?: string;
}

/**
 * Where a day sits in a chosen run of days. The run is drawn as one continuous band, tinted across
 * the cells and joined at the ends of each row, not as separately highlighted days.
 */
export type RangePosition = 'only' | 'start' | 'middle' | 'end';

export interface DayCellProps {
  date: DateTime;
  /** The full accessible name: date, state and reasons. */
  name: string;
  selected?: boolean;
  today?: boolean;
  /** Outside the displayed month. */
  muted?: boolean;
  /** Not selectable. Stays focusable so its name can explain why. */
  disabled?: boolean;
  /** Fill treatment for the whole cell. */
  surface?: 'default' | 'sunken';
  tabIndex: number;
  onSelect: () => void;
  /** How much of the day is taken, as proportional bands. */
  bar?: DayBarSegment[];
  /** Compact visual indicators, such as icons and a short word. */
  children?: ReactNode;
  /** Set when the day is part of a run of days being chosen or chosen. */
  range?: RangePosition;
  /** The run cannot stand: drawn in the danger tone. */
  rangeInvalid?: boolean;
  onFocus?: () => void;
  onPointerEnter?: () => void;
  onPointerDown?: () => void;
}

/** Fixed cell height, shared with the skeleton so the grid never shifts. */
export const CELL_HEIGHT = 'h-20 sm:h-24';

export function DayCell({
  date,
  name,
  selected = false,
  today = false,
  muted = false,
  disabled = false,
  surface = 'default',
  tabIndex,
  onSelect,
  bar,
  children,
  range,
  rangeInvalid = false,
  onFocus,
  onPointerEnter,
  onPointerDown,
}: DayCellProps) {
  return (
    <button
      type="button"
      data-date={date.toISODate()}
      aria-label={name}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      tabIndex={tabIndex}
      onClick={onSelect}
      onFocus={onFocus}
      onPointerEnter={onPointerEnter}
      onPointerDown={onPointerDown}
      className={cn(
        'relative flex w-full flex-col items-stretch gap-1 overflow-hidden p-1 text-left -outline-offset-2',
        CELL_HEIGHT,
        range
          ? rangeInvalid
            ? 'bg-danger-soft'
            : 'bg-primary-soft'
          : surface === 'sunken'
            ? 'bg-sunken'
            : 'bg-surface',
        muted && 'opacity-60',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-primary-soft',
        selected && !range && 'ring-2 ring-primary ring-inset',
      )}
    >
      {range && (
        <span
          aria-hidden
          data-range={range}
          className={cn(
            'absolute inset-x-0 top-0 h-1.5',
            rangeInvalid ? 'bg-danger' : 'bg-primary',
            (range === 'start' || range === 'only') && 'rounded-l-full',
            (range === 'end' || range === 'only') && 'rounded-r-full',
          )}
        />
      )}
      <span
        aria-hidden
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-sm font-medium',
          today ? 'bg-primary text-on-primary' : 'text-ink',
        )}
      >
        {date.day}
      </span>
      <span aria-hidden className="flex min-h-0 flex-1 flex-col justify-end gap-0.5 text-xs">
        {children}
      </span>
      {bar && bar.length > 0 && (
        <span
          aria-hidden
          className="flex h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-line"
        >
          {bar.map((segment, index) => (
            <span
              key={index}
              style={{ width: `${segment.fraction * 100}%` }}
              className={cn('h-full', patternClass(segment.pattern), segment.className)}
            />
          ))}
        </span>
      )}
    </button>
  );
}
