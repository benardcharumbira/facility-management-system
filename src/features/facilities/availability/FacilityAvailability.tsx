import { DateTime, Info } from 'luxon';
import { useMemo, useState } from 'react';
import type { FacilityDetail } from '@/shared/api';
import {
  Alert,
  CalendarMonthGrid,
  CalendarSkeleton,
  ErrorBoundary,
  ErrorState,
  Legend,
  MonthNavigator,
  Section,
  SidePanel,
  Swatch,
  type LegendItem,
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
import { AvailabilityDayCell } from './AvailabilityDayCell';
import { DayPanel } from './DayPanel';
import { REASONS, rulesOf, type Reason } from './model';
import { useMonthAvailability, usePrefetchAdjacentMonths } from './queries';
import {
  availabilityCodec,
  requestedMonth,
  selectionOf,
  toInstant,
  type Selection,
} from './urlState';

const FALLBACK_RANGE_MONTHS = 3;
const MONTH_NAMES = Info.months('long', { locale: 'en' });
const LEGEND_ORDER: Reason[] = [
  'booked',
  'held',
  'buffer',
  'blocked_by_related',
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

  const requested = requestedMonth(url);
  const query = useMonthAvailability(facilityId, requested);
  const data = query.data;
  const availability = data?.availability;
  const rules = availability ? rulesOf(availability) : null;
  const zone = rules?.timeZone;
  const now = zone ? DateTime.now().setZone(zone) : DateTime.now();
  const switching = query.isPlaceholderData;

  const currentMonth = yearMonthOf(now);
  const range = {
    min: currentMonth,
    max: rules
      ? yearMonthOf(now.plus({ days: rules.maximumHorizonDays }))
      : addMonths(currentMonth, FALLBACK_RANGE_MONTHS),
  };
  usePrefetchAdjacentMonths(facilityId, requested, range, data !== undefined && !switching);

  const days = useMemo(() => new Map(availability?.days.map((d) => [d.date, d])), [availability]);
  const selection = selectionOf(url);
  const panelDay = url.date ? days.get(url.date) : undefined;

  const showMonth = (month: YearMonth) => {
    setNotice(null);
    update({ month: formatYearMonth(month), date: undefined });
  };
  const choose = (next: Selection) =>
    update({ startsAt: toInstant(next.start), endsAt: toInstant(next.end) }, { replace: true });
  const clear = () => update({ startsAt: undefined, endsAt: undefined }, { replace: true });

  const shown = data?.month ?? requested;
  const label = `${MONTH_NAMES[shown.month - 1]} ${shown.year}`;

  return (
    <div className="flex flex-col gap-4">
      <MonthNavigator month={requested} onChange={showMonth} min={range.min} max={range.max} />

      {query.isError && !data ? (
        <ErrorState
          title="We could not load availability"
          problem={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : !data || !rules ? (
        <CalendarSkeleton />
      ) : (
        <div className={cn('transition-opacity', switching && 'opacity-60')}>
          <CalendarMonthGrid
            month={shown}
            zone={rules.timeZone}
            today={now.startOf('day')}
            initialFocus={url.date}
            label={label}
            busy={switching}
            onMonthChange={showMonth}
            renderDay={(date, context) => (
              <AvailabilityDayCell
                date={date}
                data={days.get(date.toISODate() ?? '')}
                rules={rules}
                now={now}
                context={context}
                selected={url.date === date.toISODate()}
                onSelect={(iso, selectable, name) => {
                  if (!selectable) {
                    setNotice(`${name}. This day cannot be requested.`);
                    return;
                  }
                  setNotice(null);
                  update({ date: iso, month: iso.slice(0, 7) });
                }}
              />
            )}
          />
        </div>
      )}

      <p role="status" aria-live="polite" className="min-h-5 text-muted">
        {notice}
      </p>

      <Legend items={legendItems()} />

      {availability && rules && panelDay && (
        <SidePanel
          open
          title={formatLongDate(DateTime.fromISO(panelDay.date, { zone: rules.timeZone }))}
          onClose={() => update({ date: undefined }, { replace: true })}
          returnFocus={() => document.querySelector<HTMLElement>(`[data-date="${panelDay.date}"]`)}
        >
          <DayPanel
            day={panelDay}
            availability={availability}
            facilityName={facilityName}
            now={now}
            selection={selection}
            fromList={fromList}
            onSelect={choose}
            onClear={clear}
            onDone={() => update({ date: undefined }, { replace: true })}
          />
        </SidePanel>
      )}
    </div>
  );
}
