import { CalendarDays, CalendarRange, Rows3 } from 'lucide-react';
import { DateTime, Info } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import type { FacilityDetail } from '@/shared/api';
import {
  Alert,
  Button,
  CalendarMonthGrid,
  CalendarSkeleton,
  ErrorBoundary,
  ErrorState,
  Legend,
  MonthNavigator,
  Section,
  SidePanel,
  Swatch,
  useRangeSelect,
  ViewToggle,
  WeekGrid,
  type LegendItem,
  type RangePosition,
} from '@/shared/components';
import { useUrlState } from '@/shared/hooks';
import {
  addMonths,
  formatLongDate,
  formatYearMonth,
  yearMonthOf,
  type YearMonth,
} from '@/shared/utils/calendar';
import { cn } from '@/shared/utils/cn';
import { datesBetween } from '@/shared/utils/availability';
import { AvailabilityDayCell } from './AvailabilityDayCell';
import { RescheduleBanner } from './RescheduleBanner';
import { DayPanel } from './DayPanel';
import { REASONS, rulesOf, type Reason } from './model';
import {
  useMonthAvailability,
  usePrefetchAdjacentMonths,
  usePrefetchAdjacentWeeks,
  useWeekAvailability,
} from './queries';
import { daysProblem } from './span';
import { SpanPanel } from './SpanPanel';
import {
  availabilityCodec,
  requestedMonth,
  requestedWeek,
  selectionDates,
  selectionOf,
  toInstant,
  type CalendarView,
  type Selection,
} from './urlState';
import { axisFor, dayBlocks, hourName } from './WeekView';
import { WeekNavigator } from './WeekNavigator';

const FALLBACK_RANGE_MONTHS = 3;
const MONTH_NAMES = Info.months('long', { locale: 'en' });
const LEGEND_ORDER: Reason[] = [
  'booked',
  'held',
  'buffer',
  'blocked_by_related',
  'closure',
  'closed',
  'past',
  'beyond_horizon',
];

function legendItems(): LegendItem[] {
  return [
    {
      key: 'available',
      label: 'Available',
      description: 'free to request',
      swatch: (
        <span
          aria-hidden
          className="inline-block size-4 rounded-sm border border-line-strong bg-surface"
        />
      ),
    },
    ...LEGEND_ORDER.map((reason) => {
      const info = REASONS[reason];
      const Icon = info.icon;
      return {
        key: reason,
        label: info.label,
        description: info.meaning,
        swatch: (
          <span className="flex items-center gap-1">
            <Swatch pattern={info.pattern} className={info.className} />
            <Icon aria-hidden className={cn('size-4', info.className)} />
          </span>
        ),
      };
    }),
  ];
}

/** The availability section of the facility detail page. */
export function FacilityAvailability({
  facility,
  fromList,
}: {
  facility: FacilityDetail;
  fromList: string;
}) {
  return (
    <Section title="Availability">
      {facility.status === 'unavailable' ? (
        <Alert severity="warning">
          {facility.name} is currently unavailable, so there is no availability to show. Check back
          later.
        </Alert>
      ) : (
        // A failure here is contained: the rest of the page keeps working.
        <ErrorBoundary>
          <AvailabilityCalendar
            facilityId={facility.id}
            facilityName={facility.name}
            fromList={fromList}
          />
        </ErrorBoundary>
      )}
    </Section>
  );
}

function AvailabilityCalendar({
  facilityId,
  facilityName,
  fromList,
}: {
  facilityId: string;
  facilityName: string;
  fromList: string;
}) {
  const [url, update] = useUrlState(availabilityCodec);
  const [notice, setNotice] = useState<string | null>(null);
  const [several, setSeveral] = useState(false);
  const view = url.view;

  const requested = requestedMonth(url);
  const monday = requestedWeek(url);
  const monthQuery = useMonthAvailability(facilityId, requested, view === 'month');
  const weekQuery = useWeekAvailability(facilityId, monday, view === 'week');
  const query = view === 'month' ? monthQuery : weekQuery;
  const availability =
    view === 'month' ? monthQuery.data?.availability : weekQuery.data?.availability;
  const rules = availability ? rulesOf(availability) : null;
  const zone = rules?.timeZone;
  const now = zone ? DateTime.now().setZone(zone) : DateTime.now();
  const switching = query.isPlaceholderData;
  const ready = query.data !== undefined && !switching;

  const currentMonth = yearMonthOf(now);
  const range = {
    min: currentMonth,
    max: rules
      ? yearMonthOf(now.plus({ days: rules.maximumHorizonDays }))
      : addMonths(currentMonth, FALLBACK_RANGE_MONTHS),
  };
  usePrefetchAdjacentMonths(facilityId, requested, range, view === 'month' && ready);
  const thisMonday = now.startOf('day').minus({ days: now.weekday - 1 });
  const lastMonday = rules
    ? now
        .plus({ days: rules.maximumHorizonDays })
        .startOf('day')
        .minus({ days: now.plus({ days: rules.maximumHorizonDays }).weekday - 1 })
    : thisMonday.plus({ weeks: 12 });
  // Mondays are compared as dates, so the zone the week was asked for in does not matter.
  const weekRange = {
    min: DateTime.fromISO(thisMonday.toISODate() ?? '', { zone: 'utc' }),
    max: DateTime.fromISO(lastMonday.toISODate() ?? '', { zone: 'utc' }),
  };
  usePrefetchAdjacentWeeks(facilityId, monday, weekRange, view === 'week' && ready);

  const days = useMemo(() => new Map(availability?.days.map((d) => [d.date, d])), [availability]);
  const selection = selectionOf(url);
  const spanFrom = url.date;
  const spanTo = url.dateTo && url.date && url.dateTo > url.date ? url.dateTo : undefined;
  const panelDay = url.date && !spanTo ? days.get(url.date) : undefined;

  const showMonth = (month: YearMonth) => {
    setNotice(null);
    update({ month: formatYearMonth(month), date: undefined, dateTo: undefined });
  };
  const showWeek = (target: DateTime) => {
    setNotice(null);
    update({ week: target.toISODate() ?? undefined, date: undefined, dateTo: undefined });
  };
  const setView = (next: CalendarView) => {
    if (next === view) return;
    setNotice(null);
    setSeveral(false);
    if (next === 'week') {
      const today = now.toISODate() ?? undefined;
      const inMonth =
        today !== undefined && today.startsWith(formatYearMonth(requested)) ? today : undefined;
      update({
        view: 'week',
        week: url.date ?? inMonth ?? `${formatYearMonth(requested)}-01`,
        date: undefined,
        dateTo: undefined,
      });
    } else {
      // Back to the month this week mostly falls in: the one its Thursday is in.
      const month = monday.plus({ days: 3 });
      update({
        view: 'month',
        week: undefined,
        month: formatYearMonth(yearMonthOf(month)),
        date: undefined,
        dateTo: undefined,
      });
    }
  };
  const choose = (next: Selection) =>
    update({ startsAt: toInstant(next.start), endsAt: toInstant(next.end) }, { replace: true });
  const clear = () => update({ startsAt: undefined, endsAt: undefined }, { replace: true });
  const closePanel = () => update({ date: undefined, dateTo: undefined }, { replace: true });

  // --- choosing several days ------------------------------------------------------------------
  const longDate = (iso: string) => formatLongDate(DateTime.fromISO(iso, { zone: zone ?? 'utc' }));
  const picker = useRangeSelect({
    enabled: several && view === 'month',
    onCommit: ({ from, to }) => {
      setSeveral(false);
      setNotice(null);
      update({
        date: from,
        dateTo: to,
        month: from.slice(0, 7),
        startsAt: undefined,
        endsAt: undefined,
      });
    },
  });

  // Escape drops a run that has been started, wherever the focus is.
  const choosing = picker.anchor !== null;
  const cancelPicking = picker.cancel;
  useEffect(() => {
    if (!choosing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      cancelPicking();
      setNotice('Choosing days cancelled.');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [choosing, cancelPicking]);

  // The run drawn on the grid: the one being chosen, else the one whose times are being chosen,
  // else the one already chosen, when it covers several days.
  const chosenDates = selection && zone ? selectionDates(selection, zone) : null;
  const shownRange =
    picker.range ??
    (spanFrom && spanTo ? { from: spanFrom, to: spanTo } : null) ??
    (chosenDates && chosenDates[0] !== chosenDates[1]
      ? { from: chosenDates[0], to: chosenDates[1] }
      : null);
  const shownDates = shownRange ? datesBetween(shownRange.from, shownRange.to) : [];
  const shownProblem =
    shownRange && rules && shownDates.length > 1
      ? daysProblem(shownDates, (d) => days.get(d), rules, now)
      : null;
  const positionOf = (iso: string): RangePosition | undefined => {
    if (!shownRange || iso < shownRange.from || iso > shownRange.to) return undefined;
    if (shownRange.from === shownRange.to) return 'only';
    return iso === shownRange.from ? 'start' : iso === shownRange.to ? 'end' : 'middle';
  };

  const shown = monthQuery.data?.month ?? requested;
  const label = `${MONTH_NAMES[shown.month - 1]} ${shown.year}`;
  const shownMonday = weekQuery.data
    ? DateTime.fromISO(weekQuery.data.weekStart, { zone: 'utc' })
    : monday;
  const weekDays = Array.from({ length: 7 }, (_, i) =>
    DateTime.fromISO(shownMonday.plus({ days: i }).toISODate() ?? '', { zone: zone ?? 'utc' }),
  );

  const panelOpen = Boolean(availability && rules && (panelDay || (spanFrom && spanTo)));

  return (
    <div className="flex flex-col gap-4">
      {url.reschedule && <RescheduleBanner bookingId={url.reschedule} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {view === 'month' ? (
          <MonthNavigator month={requested} onChange={showMonth} min={range.min} max={range.max} />
        ) : (
          <WeekNavigator
            monday={shownMonday}
            onChange={showWeek}
            min={weekRange.min}
            max={weekRange.max}
            monthLabel={MONTH_NAMES[shownMonday.plus({ days: 3 }).month - 1] ?? 'the month'}
            onBackToMonth={() => setView('month')}
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle
            label="Calendar view"
            value={view}
            onChange={setView}
            options={[
              {
                value: 'month',
                label: 'Month view',
                icon: <CalendarDays aria-hidden className="size-5" />,
              },
              {
                value: 'week',
                label: 'Week view',
                icon: <CalendarRange aria-hidden className="size-5" />,
              },
            ]}
          />
          {view === 'month' && (
            <Button
              variant="secondary"
              aria-pressed={several}
              onClick={() => {
                picker.cancel();
                setNotice(null);
                setSeveral(!several);
              }}
              className={cn(several && 'border-primary bg-primary-soft text-primary')}
            >
              <Rows3 aria-hidden className="size-4" />
              Choose several days
            </Button>
          )}
        </div>
      </div>

      {several && view === 'month' && (
        <p className="rounded-md border border-primary-line bg-primary-soft p-3 text-sm">
          Choose the first day and then the last, or drag across the days. With the keyboard, press
          Enter on the first day, move to the last with the arrow keys and press Enter again. Escape
          cancels. It is one booking for all of the days.
        </p>
      )}

      {query.isError && !query.data ? (
        <ErrorState
          title="We could not load availability"
          problem={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : !query.data || !rules ? (
        <CalendarSkeleton />
      ) : view === 'month' ? (
        <div className={cn('transition-opacity', switching && 'opacity-60')}>
          <CalendarMonthGrid
            month={shown}
            zone={rules.timeZone}
            today={now.startOf('day')}
            initialFocus={url.date}
            label={label}
            busy={switching}
            onMonthChange={showMonth}
            renderDay={(date, context) => {
              const iso = date.toISODate() ?? '';
              return (
                <AvailabilityDayCell
                  date={date}
                  data={days.get(iso)}
                  rules={rules}
                  now={now}
                  context={context}
                  selected={url.date === iso && !spanTo}
                  range={positionOf(iso)}
                  rangeInvalid={shownProblem !== null}
                  rangeHandlers={several ? picker.handlers(iso) : undefined}
                  onSelect={(day, selectable, name) => {
                    if (!selectable) {
                      setNotice(`${name}. This day cannot be requested.`);
                      return;
                    }
                    const taken = picker.select(day);
                    if (taken) {
                      setNotice(
                        taken === 'started'
                          ? `Start day: ${longDate(day)}. Now choose the last day.`
                          : null,
                      );
                      return;
                    }
                    setNotice(null);
                    update({ date: day, dateTo: undefined, month: day.slice(0, 7) });
                  }}
                />
              );
            }}
          />
        </div>
      ) : (
        <div className={cn('transition-opacity', switching && 'opacity-60')}>
          <WeekGrid
            days={weekDays}
            today={now.startOf('day')}
            now={now}
            axis={axisFor(
              weekDays.map((d) => days.get(d.toISODate() ?? '')),
              rules.timeZone,
            )}
            label={`Week of ${weekDays[0]?.setLocale('en').toFormat('d LLLL yyyy')}`}
            busy={switching}
            initialFocus={url.date}
            renderBlocks={(day) =>
              dayBlocks({
                day: days.get(day.toISODate() ?? ''),
                date: day,
                axis: axisFor(
                  weekDays.map((d) => days.get(d.toISODate() ?? '')),
                  rules.timeZone,
                ),
                rules,
                now,
                selection,
              })
            }
            cellName={(day, hour) =>
              hourName({
                day: days.get(day.toISODate() ?? ''),
                date: day,
                hour,
                rules,
                now,
                today: day.hasSame(now, 'day'),
                selected:
                  selection !== null &&
                  day.plus({ minutes: hour }) < selection.end &&
                  day.plus({ minutes: hour + 60 }) > selection.start,
              })
            }
            onSelect={(day) => {
              setNotice(null);
              update({ date: day.toISODate() ?? undefined, dateTo: undefined });
            }}
            onWeekChange={(target) =>
              update({ week: target.toISODate() ?? undefined, date: undefined, dateTo: undefined })
            }
          />
        </div>
      )}

      <p role="status" aria-live="polite" className="min-h-5 text-muted">
        {notice}
      </p>

      <Legend items={legendItems()} />

      {panelOpen && availability && rules && (
        <SidePanel
          open
          title={
            spanFrom && spanTo
              ? `${longDate(spanFrom)} to ${longDate(spanTo)}`
              : formatLongDate(DateTime.fromISO(panelDay?.date ?? '', { zone: rules.timeZone }))
          }
          onClose={closePanel}
          returnFocus={() =>
            document.querySelector<HTMLElement>(
              `[data-date="${spanFrom ?? panelDay?.date}"][tabindex="0"]`,
            ) ?? document.querySelector<HTMLElement>(`[data-date="${spanFrom ?? panelDay?.date}"]`)
          }
        >
          {spanFrom && spanTo ? (
            <SpanPanel
              facilityId={facilityId}
              from={spanFrom}
              to={spanTo}
              now={now}
              onSelect={(next) => {
                update({
                  startsAt: toInstant(next.start),
                  endsAt: toInstant(next.end),
                  date: undefined,
                  dateTo: undefined,
                });
              }}
              onChangeDays={() => {
                update({ date: undefined, dateTo: undefined }, { replace: true });
                setSeveral(true);
              }}
              onDone={closePanel}
            />
          ) : (
            panelDay && (
              <DayPanel
                day={panelDay}
                availability={availability}
                facilityName={facilityName}
                now={now}
                selection={selection}
                fromList={fromList}
                onSelect={choose}
                onClear={clear}
                onDone={closePanel}
              />
            )
          )}
        </SidePanel>
      )}
    </div>
  );
}
