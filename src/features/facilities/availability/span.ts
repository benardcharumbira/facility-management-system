import { DateTime } from 'luxon';
import type { AvailabilityDay } from '@/shared/api';
import {
  earliestStart,
  operatingWindow,
  segmentPhrase,
  spanLengthProblem,
  type Rules,
  type WindowProblem,
} from '@/shared/utils/availability';
import { formatLongDate } from '@/shared/utils/calendar';

export const SPAN_STEP_MINUTES = 30;

const longDate = (date: string, zone: string) => formatLongDate(DateTime.fromISO(date, { zone }));

const ceilTo = (value: DateTime, step: number): DateTime => {
  const base =
    value.second || value.millisecond ? value.startOf('minute').plus({ minutes: 1 }) : value;
  const rem = base.minute % step;
  return rem === 0 ? base : base.plus({ minutes: step - rem });
};

/**
 * The times a span could start on its first day: from opening, after anything already on the day,
 * and not before the minimum notice. A span occupies the rest of its first day, so a start is only
 * possible after the day's last unavailable stretch.
 */
export function startOptions(day: AvailabilityDay, rules: Rules, now: DateTime): DateTime[] {
  const window = operatingWindow(day, rules.timeZone);
  if (!window) return [];
  const lastTaken = day.segments.reduce(
    (latest, s) => Math.max(latest, Date.parse(s.endsAt)),
    window.start.toMillis(),
  );
  let from: DateTime = DateTime.fromMillis(lastTaken, { zone: rules.timeZone });
  const earliest = earliestStart(rules, now);
  if (earliest > from) from = earliest;
  const options: DateTime[] = [];
  for (
    let t = ceilTo(from, SPAN_STEP_MINUTES);
    t < window.end;
    t = t.plus({ minutes: SPAN_STEP_MINUTES })
  ) {
    options.push(t);
  }
  return options;
}

/**
 * The times a span could end on its last day: after opening and before anything already on the
 * day, since the span has occupied the day from its start.
 */
export function endOptions(day: AvailabilityDay, rules: Rules): DateTime[] {
  const window = operatingWindow(day, rules.timeZone);
  if (!window) return [];
  const firstTaken = day.segments.reduce(
    (earliest, s) => Math.min(earliest, Date.parse(s.startsAt)),
    window.end.toMillis(),
  );
  const limit = DateTime.fromMillis(firstTaken, { zone: rules.timeZone });
  const options: DateTime[] = [];
  for (
    let t = window.start.plus({ minutes: SPAN_STEP_MINUTES });
    t <= window.end && t <= limit;
    t = t.plus({ minutes: SPAN_STEP_MINUTES })
  ) {
    options.push(t);
  }
  return options;
}

/**
 * Whether these days can be requested together, before any time is chosen: not too long, a first
 * day that can still be started on, a last that can be ended on, no blackout anywhere, and nothing
 * in the way on the days between. It names the day that breaks it and says why. Days not loaded yet
 * are not judged.
 */
export function daysProblem(
  dates: string[],
  dayOf: (date: string) => AvailabilityDay | undefined,
  rules: Rules,
  now: DateTime,
): WindowProblem | null {
  const zone = rules.timeZone;
  const tooLong = spanLengthProblem(dates, rules);
  if (tooLong) return tooLong;

  const firstDate = dates[0] ?? '';
  const lastDate = dates[dates.length - 1] ?? firstDate;
  for (const date of dates) {
    const day = dayOf(date);
    if (!day) continue;
    const name = longDate(date, zone);
    if (day.status === 'closed' && day.closedBy !== 'schedule' && day.closedBy !== 'holiday') {
      return {
        message: `${name} is closed${day.closedReason ? `: ${day.closedReason}` : ''}, and a booking cannot run across a closure.`,
        day: date,
      };
    }
    if (date === firstDate) {
      if (day.status === 'closed') {
        return {
          message: `${name} is closed${day.closedReason ? `: ${day.closedReason}` : ''}, so a booking cannot start on it.`,
          day: date,
        };
      }
      if (startOptions(day, rules, now).length === 0) {
        const cause = day.segments.at(-1);
        return {
          message: cause
            ? `${name} has no time left to start a booking: ${segmentPhrase(cause)}.`
            : `${name} has no time left to start a booking, inside the ${rules.minimumNoticeHours} hours notice.`,
          day: date,
        };
      }
    } else if (date === lastDate) {
      if (day.status === 'closed') {
        return {
          message: `${name} is closed${day.closedReason ? `: ${day.closedReason}` : ''}, so a booking cannot end on it.`,
          day: date,
        };
      }
      if (endOptions(day, rules).length === 0) {
        const cause = day.segments[0];
        return {
          message: `${name} has no time free at the start of the day for a booking to end in${cause ? `: ${segmentPhrase(cause)}` : ''}.`,
          day: date,
        };
      }
    } else if (day.segments.length > 0) {
      return {
        message: `${name} is not free: ${segmentPhrase(day.segments[0] as NonNullable<(typeof day.segments)[0]>)}, so a booking cannot run across it.`,
        segment: day.segments[0],
        day: date,
      };
    }
  }
  return null;
}
