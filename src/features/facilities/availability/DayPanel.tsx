import { DateTime } from 'luxon';
import { Link } from 'react-router';
import type { AvailabilityDay, AvailabilitySegment, FacilityAvailability } from '@/shared/api';
import {
  Alert,
  Button,
  Timeline,
  TimeRangeSelect,
  type TimelineEntry,
  type UnavailableRange,
} from '@/shared/components';
import { spanProblem } from '@/shared/utils/availability';
import { formatClock, formatLongDate } from '@/shared/utils/calendar';
import { facilityPath } from '../paths';
import {
  REASONS,
  earliestStart,
  operatingWindow,
  rulesOf,
  segmentPhrase,
  type Reason,
} from './model';
import type { Selection } from './urlState';

const STEP_MINUTES = 30;

function ceilToStep(value: DateTime, step: number): DateTime {
  const base =
    value.second || value.millisecond ? value.startOf('minute').plus({ minutes: 1 }) : value;
  const rem = base.minute % step;
  return rem === 0 ? base : base.plus({ minutes: step - rem });
}

/** Why a stretch is unavailable, in a sentence that names the cause. */
function explain(segment: AvailabilitySegment, facilityName: string): string {
  switch (segment.status) {
    case 'booked':
      return 'An approved booking exists for this time.';
    case 'held':
      return 'A booking request is pending and is holding this time for now. It is released if the request lapses.';
    case 'buffer':
      return 'Set-up or clear-down time for a neighbouring booking, so the venue is occupied even though no event is running.';
    case 'closure':
      return segment.reason
        ? `Closed for this time: ${segment.reason}`
        : 'The venue is closed for this time.';
    case 'blocked_by_related': {
      const related = segment.relatedFacility;
      if (!related) return 'A related space is booked.';
      return related.relationship === 'parent'
        ? `${related.name} is the larger venue that contains ${facilityName}, so ${facilityName} cannot be booked while ${related.name} is.`
        : `${related.name} is a space inside ${facilityName}, so the whole of ${facilityName} cannot be booked while ${related.name} is.`;
    }
  }
}

function labelFor(segment: AvailabilitySegment): string {
  return segment.status === 'blocked_by_related'
    ? `Unavailable, ${segment.relatedFacility?.name ?? 'a related space'} is booked`
    : REASONS[segment.status].label;
}

/** A selection that cannot stand on this day, and why, or null if it is fine. */
export function selectionProblem(
  selection: Selection,
  day: AvailabilityDay,
  availability: FacilityAvailability,
  now: DateTime,
): string | null {
  return (
    spanProblem(
      selection,
      (date) => (date === day.date ? day : undefined),
      rulesOf(availability),
      now,
    )?.message ?? null
  );
}

interface DayPanelProps {
  day: AvailabilityDay;
  availability: FacilityAvailability;
  facilityName: string;
  now: DateTime;
  selection: Selection | null;
  fromList: string;
  onSelect: (selection: Selection) => void;
  onClear: () => void;
  onDone: () => void;
}

/** One day in detail: its hours, every unavailable stretch and why, and where a time can be chosen. */
export function DayPanel({
  day,
  availability,
  facilityName,
  now,
  selection,
  fromList,
  onSelect,
  onClear,
  onDone,
}: DayPanelProps) {
  const rules = rulesOf(availability);
  const zone = rules.timeZone;
  const window = operatingWindow(day, zone);

  if (!window) {
    return (
      <div className="flex flex-col gap-4">
        <Alert severity="info" title="Closed">
          {day.closedReason ?? 'The venue is closed on this day.'}
        </Alert>
        <Button onClick={onDone}>Done</Button>
      </div>
    );
  }

  const earliest = earliestStart(rules, now);
  const asZone = (iso: string) => DateTime.fromISO(iso, { zone });

  // Segments and the free gaps between them, in order, covering the whole operating window.
  const entries: TimelineEntry[] = [];
  const gap = (start: DateTime, end: DateTime, key: string) => {
    if (end <= start) return;
    const usableStart = earliest > start ? ceilToStep(earliest, STEP_MINUTES) : start;
    const tooSoon = usableStart > start;
    const usable = end.diff(usableStart, 'minutes').minutes >= rules.minimumDurationMinutes;
    entries.push({
      key,
      start,
      end,
      label: usable ? 'Available' : tooSoon ? 'Inside minimum notice' : 'Too short to book',
      pattern: usable ? null : 'faded',
      className: 'text-subtle',
      detail: usable
        ? tooSoon
          ? `You can request from ${formatClock(usableStart)}: bookings need ${rules.minimumNoticeHours} hours notice.`
          : 'Free to request.'
        : tooSoon
          ? `Bookings need ${rules.minimumNoticeHours} hours notice.`
          : `Shorter than the ${rules.minimumDurationMinutes} minute minimum booking.`,
      action: usable ? (
        <Button variant="secondary" size="sm" onClick={() => onSelect({ start: usableStart, end })}>
          {`Use ${formatClock(usableStart)} to ${formatClock(end)}`}
        </Button>
      ) : undefined,
    });
  };

  let cursor = window.start;
  day.segments.forEach((segment, index) => {
    const start = asZone(segment.startsAt);
    const end = asZone(segment.endsAt);
    gap(cursor, start, `gap-${index}`);
    const info = REASONS[segment.status as Reason];
    const related = segment.relatedFacility;
    entries.push({
      key: `segment-${index}`,
      start,
      end,
      label: labelFor(segment),
      pattern: info.pattern,
      className: info.className,
      detail: (
        <>
          <p>{explain(segment, facilityName)}</p>
          {related && (
            <p className="mt-1">
              <Link
                to={facilityPath(related.id)}
                state={{ fromList }}
                className="font-medium text-primary underline underline-offset-2"
              >
                {`View ${related.name}`}
              </Link>
            </p>
          )}
        </>
      ),
    });
    cursor = end;
  });
  gap(cursor, window.end, 'gap-end');

  const unavailable: UnavailableRange[] = day.segments.map((s) => ({
    start: asZone(s.startsAt),
    end: asZone(s.endsAt),
    reason: segmentPhrase(s).replace(/^./, (c) => c.toUpperCase()),
  }));

  const onThisDay =
    selection !== null && selection.start.setZone(zone).toISODate() === day.date ? selection : null;
  const value = onThisDay
    ? { start: onThisDay.start.setZone(zone), end: onThisDay.end.setZone(zone) }
    : null;
  const problem = onThisDay ? selectionProblem(onThisDay, day, availability, now) : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">
        Open {formatClock(window.start)} to {formatClock(window.end)}. All times are {zone} time.
      </p>

      <Timeline
        window={window}
        entries={entries}
        label={`${formatLongDate(window.start)} timeline`}
      />

      <section aria-labelledby="choose-time" className="flex flex-col gap-3">
        <h3 id="choose-time" className="text-base font-semibold">
          Choose your time
        </h3>
        {problem && (
          <Alert
            severity="warning"
            title="This selection cannot be used"
            action={
              <Button variant="secondary" size="sm" onClick={onClear}>
                Clear
              </Button>
            }
          >
            {problem}
          </Alert>
        )}
        <TimeRangeSelect
          window={window}
          unavailable={unavailable}
          earliest={
            earliest > window.start
              ? { at: earliest, reason: `${rules.minimumNoticeHours} hours minimum notice` }
              : undefined
          }
          minDurationMinutes={rules.minimumDurationMinutes}
          stepMinutes={STEP_MINUTES}
          value={value}
          onChange={onSelect}
        />
      </section>

      <Button onClick={onDone}>Done</Button>
    </div>
  );
}
