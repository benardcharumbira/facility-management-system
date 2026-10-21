import { DateTime } from 'luxon';
import { useId, useState } from 'react';
import type { FacilityAvailability } from '@/shared/api';
import { Alert, Button, controlStyles, ErrorState, FormField, Spinner } from '@/shared/components';
import { datesBetween, spanProblem } from '@/shared/utils/availability';
import { formatClock, formatLongDate } from '@/shared/utils/calendar';
import { describeWindow } from '@/shared/utils/format';
import { rulesOf } from './model';
import { useSpanAvailability } from './queries';
import { daysProblem, endOptions, startOptions } from './span';
import type { Selection } from './urlState';

interface SpanPanelProps {
  facilityId: string;
  from: string;
  to: string;
  now: DateTime;
  /** Where the days chosen so far came from, so the panel can say what they were. */
  onSelect: (selection: Selection) => void;
  onChangeDays: () => void;
  onDone: () => void;
}

const stampOf = (t: DateTime) => formatClock(t);

/**
 * A run of days, as one booking. Times are chosen here: a start on the first day and an end on the
 * last. The days in between are held in full, so there is nothing to choose for them, and the
 * panel says so. If any day cannot be part of it, it names the day and the reason and offers the
 * way back, rather than leaving the person to find out at the end.
 */
export function SpanPanel({
  facilityId,
  from,
  to,
  now,
  onSelect,
  onChangeDays,
  onDone,
}: SpanPanelProps) {
  const query = useSpanAvailability(facilityId, from, to, true);
  if (query.isError) {
    return (
      <ErrorState
        title="We could not check these days"
        problem={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!query.data) {
    return (
      <p role="status" className="flex items-center gap-2 text-muted">
        <Spinner label="Checking these days" /> Checking these days…
      </p>
    );
  }
  return (
    <Chosen
      availability={query.data}
      from={from}
      to={to}
      now={now}
      onSelect={onSelect}
      onChangeDays={onChangeDays}
      onDone={onDone}
    />
  );
}

function Chosen({
  availability,
  from,
  to,
  now,
  onSelect,
  onChangeDays,
  onDone,
}: Omit<SpanPanelProps, 'facilityId'> & { availability: FacilityAvailability }) {
  const id = useId();
  const rules = rulesOf(availability);
  const zone = rules.timeZone;
  const dates = datesBetween(from, to);
  const dayOf = (date: string) => availability.days.find((d) => d.date === date);
  const first = dayOf(from);
  const last = dayOf(to);
  const problem = daysProblem(dates, dayOf, rules, now);

  const starts = first ? startOptions(first, rules, now) : [];
  const ends = last ? endOptions(last, rules) : [];
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');

  const long = (date: string) => formatLongDate(DateTime.fromISO(date, { zone }));

  if (problem) {
    return (
      <div className="flex flex-col gap-4">
        <Alert severity="warning" title="These days cannot be requested together">
          {problem.message}
        </Alert>
        <p className="text-muted">
          One day that cannot be booked rules out the whole run, because it is a single booking.
        </p>
        <div className="flex gap-2">
          <Button onClick={onChangeDays}>Choose different days</Button>
          <Button variant="secondary" onClick={onDone}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  const startAt = start ? DateTime.fromISO(`${from}T${start}`, { zone }) : null;
  const endAt = end ? DateTime.fromISO(`${to}T${end}`, { zone }) : null;
  const chosen =
    startAt && endAt ? spanProblem({ start: startAt, end: endAt }, dayOf, rules, now) : null;
  const summary =
    startAt && endAt
      ? describeWindow(startAt.toUTC().toISO() ?? '', endAt.toUTC().toISO() ?? '', zone).text
      : null;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted">
        {dates.length} days in a row, as one booking with one approval. The venue’s hours apply to
        your start on {long(from)} and your end on {long(to)}. Days in between are held in full,
        whatever the hours. All times are {zone} time.
      </p>

      <FormField
        id={`${id}-start`}
        label={`Start time on ${long(from)}`}
        hint={
          first?.opensAt
            ? `Open ${first.opensAt} to ${first.closesAt}. The rest of the day is held for you once you start.`
            : undefined
        }
      >
        {(control) => (
          <select
            {...control}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={`${controlStyles} h-10`}
          >
            <option value="">Choose a start</option>
            {starts.map((t) => (
              <option key={stampOf(t)} value={stampOf(t)}>
                {stampOf(t)}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField
        id={`${id}-end`}
        label={`End time on ${long(to)}`}
        hint={
          last?.opensAt
            ? `Open ${last.opensAt} to ${last.closesAt}. The day is held for you until you finish.`
            : undefined
        }
      >
        {(control) => (
          <select
            {...control}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={`${controlStyles} h-10`}
          >
            <option value="">Choose an end</option>
            {ends.map((t) => (
              <option key={stampOf(t)} value={stampOf(t)}>
                {stampOf(t)}
              </option>
            ))}
          </select>
        )}
      </FormField>

      {chosen && (
        <Alert severity="warning" title="This selection cannot be used">
          {chosen.message}
        </Alert>
      )}
      {summary && !chosen && (
        <p
          role="status"
          className="rounded-md border border-primary-line bg-primary-soft p-3 font-medium"
        >
          {summary}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          disabled={!startAt || !endAt || chosen !== null}
          onClick={() => startAt && endAt && onSelect({ start: startAt, end: endAt })}
        >
          Use these times
        </Button>
        <Button variant="secondary" onClick={onChangeDays}>
          Choose different days
        </Button>
      </div>
    </div>
  );
}
