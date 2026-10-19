import { DateTime } from 'luxon';
import {
  CalendarRange,
  DoorClosed,
  History,
  Hourglass,
  Layers,
  Lock,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { AvailabilityDay } from '@/shared/api';
import type { Pattern } from '@/shared/components';
import {
  earliestStart,
  operatingWindow,
  segmentPhrase,
  type Rules,
} from '@/shared/utils/availability';
import { formatLongDate } from '@/shared/utils/calendar';

/**
 * The reasons a day or a stretch of time cannot be booked. The first four come from the API's
 * segments; the last three are decided here from the day itself and the booking rules.
 */
export type Reason =
  'booked' | 'held' | 'buffer' | 'blocked_by_related' | 'closed' | 'past' | 'beyond_horizon';

interface ReasonInfo {
  label: string;
  /** For the legend. */
  meaning: string;
  pattern: Pattern;
  className: string;
  icon: LucideIcon;
}

export const REASONS: Record<Reason, ReasonInfo> = {
  booked: {
    label: 'Booked',
    meaning: 'an approved booking exists',
    pattern: 'solid',
    className: 'text-primary',
    icon: Lock,
  },
  held: {
    label: 'Held',
    meaning: 'a pending request is holding the time',
    pattern: 'striped',
    className: 'text-warning',
    icon: Hourglass,
  },
  buffer: {
    label: 'Set-up or clear-down',
    meaning: 'time reserved around a neighbouring booking',
    pattern: 'dotted',
    className: 'text-muted',
    icon: Wrench,
  },
  blocked_by_related: {
    label: 'Blocked by a related space',
    meaning: 'another space in the same building is booked',
    pattern: 'crosshatch',
    className: 'text-danger',
    icon: Layers,
  },
  closed: {
    label: 'Closed',
    meaning: 'outside operating hours, a blackout or a public holiday',
    pattern: 'outline',
    className: 'text-subtle',
    icon: DoorClosed,
  },
  past: {
    label: 'Too soon or past',
    meaning: 'before the minimum notice period',
    pattern: 'faded',
    className: 'text-subtle',
    icon: History,
  },
  beyond_horizon: {
    label: 'Too far ahead',
    meaning: 'later than bookings are accepted',
    pattern: 'dashed',
    className: 'text-subtle',
    icon: CalendarRange,
  },
};

/**
 * Whether a day can be chosen at all. `past` and `beyond_horizon` days are not selectable.
 * Everything else can be opened, even when nothing on it is free, so its reasons can be read.
 */
export function dayAccess(
  day: AvailabilityDay,
  rules: Rules,
  now: DateTime,
): { selectable: boolean; reason: 'past' | 'beyond_horizon' | null } {
  const start = DateTime.fromISO(day.date, { zone: rules.timeZone }).startOf('day');
  const window = operatingWindow(day, rules.timeZone);
  const end = window?.end ?? start.endOf('day');
  if (end <= earliestStart(rules, now)) return { selectable: false, reason: 'past' };
  const horizonEnd = now
    .setZone(rules.timeZone)
    .startOf('day')
    .plus({ days: rules.maximumHorizonDays });
  if (start > horizonEnd) return { selectable: false, reason: 'beyond_horizon' };
  return { selectable: true, reason: null };
}

/** The reasons present on a day, once each, in a stable order. */
export function dayReasons(day: AvailabilityDay, access: ReturnType<typeof dayAccess>): Reason[] {
  if (access.reason) return [access.reason];
  if (day.status === 'closed') return ['closed'];
  const order: Reason[] = ['booked', 'held', 'blocked_by_related', 'buffer'];
  return order.filter((reason) => day.segments.some((s) => s.status === reason));
}

/** The short word shown in a day cell. */
export function cellCaption(day: AvailabilityDay, reasons: Reason[]): string | null {
  const first = reasons[0];
  if (first === undefined) return null;
  if (first === 'closed') {
    return day.closedReason?.startsWith('Public holiday')
      ? 'Holiday'
      : (day.closedReason ?? 'Closed');
  }
  if (first === 'blocked_by_related') {
    const related = day.segments.find((s) => s.status === 'blocked_by_related')?.relatedFacility;
    return related?.name ?? REASONS[first].label;
  }
  return REASONS[first].label;
}

/** The full accessible name of a day cell: date, state and reasons. */
export function dayName({
  day,
  access,
  rules,
  today,
  selected,
}: {
  day: AvailabilityDay;
  access: ReturnType<typeof dayAccess>;
  rules: Rules;
  today: boolean;
  selected: boolean;
}): string {
  const date = formatLongDate(DateTime.fromISO(day.date, { zone: rules.timeZone }));
  let state: string;
  if (access.reason === 'past') {
    state = `not bookable, in the past or inside the ${rules.minimumNoticeHours} hour minimum notice`;
  } else if (access.reason === 'beyond_horizon') {
    state = `not bookable yet, more than ${rules.maximumHorizonDays} days ahead`;
  } else if (day.status === 'closed') {
    state = `closed, ${day.closedReason ?? 'closed'}`;
  } else if (day.status === 'available') {
    state = 'available';
  } else {
    const phrases = [...new Set(day.segments.map(segmentPhrase))].join(', ');
    state = `${day.status === 'fully_booked' ? 'unavailable' : 'partly available'}, ${phrases}`;
  }
  return [date, today ? 'today' : null, state, selected ? 'selected' : null]
    .filter(Boolean)
    .join(', ');
}

export {
  clockOn,
  earliestStart,
  operatingWindow,
  rulesOf,
  segmentPhrase,
} from '@/shared/utils/availability';
export type { Rules } from '@/shared/utils/availability';
