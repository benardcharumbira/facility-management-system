import type { DateTime } from 'luxon';
import type { AvailabilityDay } from '@/shared/api';
import { DayCell, type DayBarSegment, type DayRenderContext } from '@/shared/components';
import { cn } from '@/shared/utils/cn';
import {
  REASONS,
  cellCaption,
  dayAccess,
  dayName,
  dayReasons,
  operatingWindow,
  type Rules,
} from './model';

const MAX_ICONS = 3;

function barFor(day: AvailabilityDay, zone: string): DayBarSegment[] {
  const window = operatingWindow(day, zone);
  if (!window || day.segments.length === 0) return [];
  const span = window.end.toMillis() - window.start.toMillis();
  const segments: DayBarSegment[] = [];
  let cursor = window.start.toMillis();
  for (const segment of day.segments) {
    const start = Date.parse(segment.startsAt);
    const end = Date.parse(segment.endsAt);
    if (start > cursor)
      segments.push({
        fraction: (start - cursor) / span,
        pattern: 'faded',
        className: 'text-transparent',
      });
    const info = REASONS[segment.status];
    segments.push({
      fraction: (end - start) / span,
      pattern: info.pattern,
      className: info.className,
    });
    cursor = end;
  }
  if (cursor < window.end.toMillis()) {
    segments.push({
      fraction: (window.end.toMillis() - cursor) / span,
      pattern: 'faded',
      className: 'text-transparent',
    });
  }
  return segments;
}

interface AvailabilityDayCellProps {
  date: DateTime;
  data: AvailabilityDay | undefined;
  rules: Rules;
  now: DateTime;
  context: DayRenderContext;
  selected: boolean;
  onSelect: (date: string, selectable: boolean, reason: string) => void;
}

/** Turns one day of availability into a cell: pattern bar, icons, a short word and a full name. */
export function AvailabilityDayCell({
  date,
  data,
  rules,
  now,
  context,
  selected,
  onSelect,
}: AvailabilityDayCellProps) {
  if (!data) {
    return (
      <DayCell
        date={date}
        name={`${date.toISODate()}, no information`}
        muted
        disabled
        tabIndex={context.tabIndex}
        onSelect={() => {}}
      />
    );
  }

  const access = dayAccess(data, rules, now);
  const reasons = dayReasons(data, access);
  const caption = cellCaption(data, reasons);
  const name = dayName({ day: data, access, rules, today: context.today, selected });
  const unavailable = reasons.length > 0 && data.status !== 'partially_booked';

  return (
    <DayCell
      date={date}
      name={name}
      selected={selected}
      today={context.today}
      muted={!context.inMonth}
      disabled={!access.selectable}
      surface={unavailable ? 'sunken' : 'default'}
      tabIndex={context.tabIndex}
      bar={access.selectable && data.status !== 'closed' ? barFor(data, rules.timeZone) : undefined}
      onSelect={() => onSelect(data.date, access.selectable, name)}
    >
      <span className="flex items-center gap-0.5">
        {reasons.slice(0, MAX_ICONS).map((reason) => {
          const Icon = REASONS[reason].icon;
          return (
            <Icon key={reason} className={cn('size-3.5 shrink-0', REASONS[reason].className)} />
          );
        })}
      </span>
      {caption && <span className="hidden truncate text-muted sm:block">{caption}</span>}
    </DayCell>
  );
}
