import { DateTime } from 'luxon';
import type { AvailabilityDay, AvailabilitySegment } from '@/shared/api';
import { patternClass, WeekBlock, type WeekAxis } from '@/shared/components';
import { operatingWindow, segmentPhrase, type Rules } from '@/shared/utils/availability';
import { formatClock, formatLongDate } from '@/shared/utils/calendar';
import { cn } from '@/shared/utils/cn';
import { REASONS, dayAccess, type Reason } from './model';
import type { Selection } from './urlState';

const DEFAULT_AXIS: WeekAxis = { start: 7 * 60, end: 23 * 60 };

const minutesOf = (value: DateTime) => value.diff(value.startOf('day'), 'minutes').minutes;

/**
 * The hours the week's axis covers: from the earliest opening to the latest closing among its
 * open days, in whole hours. A week with no open day falls back to a working day.
 */
export function axisFor(days: Array<AvailabilityDay | undefined>, zone: string): WeekAxis {
  let start = Infinity;
  let end = -Infinity;
  for (const day of days) {
    const window = day ? operatingWindow(day, zone) : null;
    if (!window) continue;
    start = Math.min(start, minutesOf(window.start));
    end = Math.max(end, minutesOf(window.end) || 24 * 60);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return DEFAULT_AXIS;
  return { start: Math.floor(start / 60) * 60, end: Math.ceil(end / 60) * 60 };
}

/** What an hour of a day is, in words: the cell's accessible name, as in the month grid. */
export function hourName({
  day,
  date,
  hour,
  rules,
  now,
  today,
  selected,
}: {
  day: AvailabilityDay | undefined;
  date: DateTime;
  hour: number;
  rules: Rules;
  now: DateTime;
  today: boolean;
  selected: boolean;
}): string {
  const zone = rules.timeZone;
  const from = date.startOf('day').plus({ minutes: hour });
  const to = from.plus({ hours: 1 });
  const when = `${formatLongDate(date)}${today ? ', today' : ''}, ${formatClock(from)} to ${formatClock(to)}`;
  let state: string;
  if (!day) {
    state = 'no information';
  } else {
    const access = dayAccess(day, rules, now);
    const window = operatingWindow(day, zone);
    const hit = day.segments.filter(
      (s) => Date.parse(s.startsAt) < to.toMillis() && Date.parse(s.endsAt) > from.toMillis(),
    );
    if (access.reason === 'past') state = 'too soon or past, not bookable';
    else if (access.reason === 'beyond_horizon') state = 'too far ahead, not bookable yet';
    else if (day.status === 'closed') state = `closed, ${day.closedReason ?? 'closed'}`;
    else if (!window || to <= window.start || from >= window.end)
      state =
        day.segments.length > 0
          ? `unavailable, ${segmentPhrase(day.segments[0] as AvailabilitySegment)}`
          : 'closed, outside opening hours';
    else if (hit.length === 0) state = 'available';
    else {
      const covers = hit.some(
        (s) => Date.parse(s.startsAt) <= from.toMillis() && Date.parse(s.endsAt) >= to.toMillis(),
      );
      const phrases = [...new Set(hit.map(segmentPhrase))].join(', ');
      state = `${covers ? 'unavailable' : 'partly available'}, ${phrases}`;
    }
  }
  return [when, state, selected ? 'in your selection' : null].filter(Boolean).join(', ');
}

const SEGMENT_REASON: Record<AvailabilitySegment['status'], Reason> = {
  booked: 'booked',
  held: 'held',
  buffer: 'buffer',
  blocked_by_related: 'blocked_by_related',
  closure: 'closure',
};

/**
 * One day's column of blocks: the closed hours, and each unavailable stretch with the same six
 * treatments and the same words as the month. A stretch that belongs to a booking spanning days
 * joins its neighbours, so a span reads as one continuous block across the columns.
 */
export function dayBlocks({
  day,
  date,
  axis,
  rules,
  now,
  selection,
}: {
  day: AvailabilityDay | undefined;
  date: DateTime;
  axis: WeekAxis;
  rules: Rules;
  now: DateTime;
  selection: Selection | null;
}) {
  const zone = rules.timeZone;
  const dayStart = date.startOf('day');
  const midnight = dayStart.plus({ days: 1 });
  const minutes = (instant: DateTime) =>
    instant >= midnight ? 24 * 60 : Math.max(0, instant.diff(dayStart, 'minutes').minutes);
  const blocks: React.ReactNode[] = [];

  if (!day) return blocks;
  const access = dayAccess(day, rules, now);
  if (access.reason) {
    const info = REASONS[access.reason];
    blocks.push(
      <WeekBlock
        key="access"
        axis={axis}
        startMinutes={axis.start}
        endMinutes={axis.end}
        joinBefore
        joinAfter
        className={cn('opacity-70', patternClass(info.pattern), info.className)}
      />,
    );
    return blocks;
  }

  const window = operatingWindow(day, zone);
  if (day.status === 'closed') {
    const info = REASONS.closed;
    blocks.push(
      <WeekBlock
        key="closed"
        axis={axis}
        startMinutes={axis.start}
        endMinutes={axis.end}
        joinBefore
        joinAfter
        className={cn(patternClass(info.pattern), info.className)}
      >
        <span className="block text-center font-medium text-ink">
          {day.closedReason?.startsWith('Public holiday') ? 'Holiday' : 'Closed'}
        </span>
      </WeekBlock>,
    );
  } else if (window) {
    // The hours the venue is not open, inside the axis other days set.
    const opens = minutesOf(window.start);
    const closes = minutesOf(window.end) || 24 * 60;
    for (const [from, to, key] of [
      [axis.start, opens, 'before'],
      [closes, axis.end, 'after'],
    ] as const) {
      if (to > from) {
        blocks.push(
          <WeekBlock
            key={key}
            axis={axis}
            startMinutes={from}
            endMinutes={to}
            joinBefore
            joinAfter
            className={cn('opacity-60', patternClass('faded'), 'text-subtle')}
          />,
        );
      }
    }
  }

  for (const segment of day.segments) {
    const info = REASONS[SEGMENT_REASON[segment.status]];
    const Icon = info.icon;
    const start = DateTime.fromISO(segment.startsAt, { zone });
    const end = DateTime.fromISO(segment.endsAt, { zone });
    // A block that carries on past the day's own hours reaches the edge of the column to join.
    const joinBefore = segment.continuesBefore === true;
    const joinAfter = segment.continuesAfter === true;
    blocks.push(
      <WeekBlock
        key={`${segment.status}:${segment.startsAt}`}
        axis={axis}
        startMinutes={minutes(start)}
        endMinutes={minutes(end)}
        joinBefore={joinBefore}
        joinAfter={joinAfter}
        className={cn('border border-current', patternClass(info.pattern), info.className)}
      >
        <span className="flex items-start gap-0.5 rounded-sm bg-surface/85 px-0.5 font-medium text-ink">
          <Icon className={cn('size-3 shrink-0', info.className)} />
          <span className="hidden truncate sm:inline">
            {segment.status === 'blocked_by_related'
              ? (segment.relatedFacility?.name ?? info.label)
              : info.label}
          </span>
        </span>
      </WeekBlock>,
    );
  }

  if (selection) {
    const first = selection.start.setZone(zone);
    const last = selection.end.setZone(zone);
    if (first < midnight && last > dayStart) {
      const clockStart = first > dayStart ? minutes(first) : axis.start;
      const clockEnd = last < midnight ? minutes(last) : axis.end;
      blocks.push(
        <WeekBlock
          key="selection"
          axis={axis}
          startMinutes={clockStart}
          endMinutes={clockEnd}
          joinBefore={first < dayStart}
          joinAfter={last > midnight}
          className="border-2 border-primary bg-primary/10 text-primary"
        />,
      );
    }
  }
  return blocks;
}
