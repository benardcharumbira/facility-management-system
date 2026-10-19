import type { DateTime } from 'luxon';
import { useId } from 'react';
import { formatClock } from '@/shared/utils/calendar';

export interface UnavailableRange {
  start: DateTime;
  end: DateTime;
  /** Why, in words. Shown when it limits the choice. */
  reason: string;
}

export interface TimeRange {
  start: DateTime;
  end: DateTime;
}

export interface TimeRangeSelectProps {
  /** The span that may be chosen from, e.g. a day's operating hours. */
  window: TimeRange;
  /** Time that cannot be chosen, with the reason. */
  unavailable: UnavailableRange[];
  /** Nothing before this can be chosen. */
  earliest?: { at: DateTime; reason: string };
  minDurationMinutes: number;
  stepMinutes?: number;
  value: TimeRange | null;
  onChange: (value: TimeRange) => void;
}

const DEFAULT_STEP = 30;

function describeDuration(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'}`;
  return `${minutes} minutes`;
}

/**
 * Start and end selectors that offer only valid choices: nothing outside the window, inside
 * unavailable time, before the earliest allowed start, shorter than the minimum, or reaching
 * across unavailable time. Options that fail are disabled, and the constraint that limits the
 * current choice is stated in words beneath, so a blocked attempt is explained.
 */
export function TimeRangeSelect({
  window,
  unavailable,
  earliest,
  minDurationMinutes,
  stepMinutes = DEFAULT_STEP,
  value,
  onChange,
}: TimeRangeSelectProps) {
  const id = useId();
  const stepMs = stepMinutes * 60_000;
  const minMs = minDurationMinutes * 60_000;
  const windowStart = window.start.toMillis();
  const windowEnd = window.end.toMillis();

  const times: DateTime[] = [];
  for (let t = windowStart; t <= windowEnd; t += stepMs)
    times.push(window.start.plus({ milliseconds: t - windowStart }));

  /** The first unavailable range that begins at or after `from`. */
  const nextBlock = (from: number) =>
    [...unavailable]
      .sort((a, b) => a.start.toMillis() - b.start.toMillis())
      .find((u) => u.start.toMillis() >= from);
  const insideBlock = (t: number) =>
    unavailable.some((u) => u.start.toMillis() <= t && t < u.end.toMillis());
  /** The furthest a booking starting at `from` can run. */
  const limitFor = (from: number) =>
    Math.min(windowEnd, nextBlock(from)?.start.toMillis() ?? windowEnd);

  const startOk = (t: DateTime) => {
    const ms = t.toMillis();
    if (ms + minMs > windowEnd) return false;
    if (earliest && ms < earliest.at.toMillis()) return false;
    if (insideBlock(ms)) return false;
    return limitFor(ms) - ms >= minMs;
  };
  const startMs = value?.start.toMillis();
  const endOk = (t: DateTime) => {
    if (startMs === undefined) return false;
    const ms = t.toMillis();
    return ms - startMs >= minMs && ms <= limitFor(startMs);
  };

  const notes: string[] = [
    `Opening hours ${formatClock(window.start)} to ${formatClock(window.end)}.`,
    `Bookings must be at least ${describeDuration(minDurationMinutes)}.`,
  ];
  if (earliest && earliest.at > window.start) {
    notes.push(`Earliest start ${formatClock(earliest.at)}: ${earliest.reason}.`);
  }
  if (startMs !== undefined) {
    const block = nextBlock(startMs);
    notes.push(
      block
        ? `Latest end ${formatClock(block.start)}: ${block.reason} from ${formatClock(block.start)}.`
        : `Latest end ${formatClock(window.end)}: closing time.`,
    );
  }

  const field =
    'h-10 w-full rounded-md border border-line-strong bg-surface px-2 tabular-nums disabled:opacity-50';
  const notesId = `${id}-notes`;

  const chooseStart = (clock: string) => {
    const start = times.find((t) => formatClock(t) === clock);
    if (!start || !startOk(start)) return;
    const keep =
      value &&
      value.end.toMillis() - start.toMillis() >= minMs &&
      value.end.toMillis() <= limitFor(start.toMillis());
    onChange({ start, end: keep ? value.end : start.plus({ minutes: minDurationMinutes }) });
  };
  const chooseEnd = (clock: string) => {
    const end = times.find((t) => formatClock(t) === clock);
    if (!end || !value || !endOk(end)) return;
    onChange({ start: value.start, end });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-start`} className="mb-1 block text-sm font-medium">
            Start time
          </label>
          <select
            id={`${id}-start`}
            aria-describedby={notesId}
            value={value ? formatClock(value.start) : ''}
            onChange={(event) => chooseStart(event.target.value)}
            className={field}
          >
            <option value="" disabled>
              Choose
            </option>
            {times.map((t) => (
              <option key={t.toMillis()} value={formatClock(t)} disabled={!startOk(t)}>
                {formatClock(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-end`} className="mb-1 block text-sm font-medium">
            End time
          </label>
          <select
            id={`${id}-end`}
            aria-describedby={notesId}
            value={value ? formatClock(value.end) : ''}
            disabled={!value}
            onChange={(event) => chooseEnd(event.target.value)}
            className={field}
          >
            <option value="" disabled>
              Choose
            </option>
            {times.map((t) => (
              <option key={t.toMillis()} value={formatClock(t)} disabled={!endOk(t)}>
                {formatClock(t)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ul id={notesId} className="m-0 list-none p-0 text-sm text-muted">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
