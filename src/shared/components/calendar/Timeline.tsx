import type { DateTime } from 'luxon';
import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import { formatClock } from '@/shared/utils/calendar';
import { patternClass, type Pattern } from './patterns';
import { Swatch } from './Swatch';

export interface TimelineEntry {
  key: string;
  start: DateTime;
  end: DateTime;
  /** The status in words, e.g. "Booked". */
  label: string;
  pattern: Pattern | null;
  /** Text colour class for the pattern. */
  className?: string;
  icon?: ReactNode;
  /** A plain language reason or explanation. */
  detail?: ReactNode;
  /** An action for this entry, e.g. "Use this time". */
  action?: ReactNode;
}

export interface TimelineProps {
  /** The span covered, e.g. a day's operating hours. */
  window: { start: DateTime; end: DateTime };
  /** Chronological and contiguous across the window. */
  entries: TimelineEntry[];
  label: string;
}

/**
 * A proportional bar of the window with, below it, every entry in order: its times, its status
 * in words, and the reason. The bar is a picture; the list carries the meaning.
 */
export function Timeline({ window, entries, label }: TimelineProps) {
  const span = window.end.toMillis() - window.start.toMillis();
  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden className="flex h-3 w-full overflow-hidden rounded-full bg-line">
        {entries.map((entry) => (
          <span
            key={entry.key}
            style={{ width: `${((entry.end.toMillis() - entry.start.toMillis()) / span) * 100}%` }}
            className={cn('h-full', entry.pattern && patternClass(entry.pattern), entry.className)}
          />
        ))}
      </div>
      <ol aria-label={label} className="m-0 flex list-none flex-col gap-2 p-0">
        {entries.map((entry) => (
          <li key={entry.key} className="rounded-md border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium tabular-nums">
                {formatClock(entry.start)} to {formatClock(entry.end)}
              </p>
              <p className="flex items-center gap-1.5 font-medium">
                {entry.pattern && <Swatch pattern={entry.pattern} className={entry.className} />}
                {entry.icon}
                {entry.label}
              </p>
            </div>
            {entry.detail && <div className="mt-1 text-muted">{entry.detail}</div>}
            {entry.action && <div className="mt-2">{entry.action}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}
