import { SelectionSummaryBar } from '@/shared/components';
import { useUrlState } from '@/shared/hooks';
import { formatClock, formatLongDate } from '@/shared/utils/calendar';
import { useMonthAvailability } from './queries';
import { availabilityCodec, requestedMonth, selectionOf, type Selection } from './urlState';
import type { ReactNode } from 'react';

/** Shows the chosen window, with a way to change or clear it. Renders only when one is chosen. */
export function SelectionSummary({
  facilityId,
  facilityName,
  children,
}: {
  facilityId: string;
  facilityName: string;
  children?: ReactNode;
}) {
  const [url, update] = useUrlState(availabilityCodec);
  const selection = selectionOf(url);
  if (!selection) return null;
  return (
    <ChosenWindow
      facilityId={facilityId}
      facilityName={facilityName}
      selection={selection}
      onChange={(date) => update({ date, month: date.slice(0, 7) })}
      onClear={() => update({ startsAt: undefined, endsAt: undefined })}
    >
      {children}
    </ChosenWindow>
  );
}

function ChosenWindow({
  facilityId,
  facilityName,
  selection,
  onChange,
  onClear,
  children,
}: {
  facilityId: string;
  facilityName: string;
  selection: Selection;
  onChange: (date: string) => void;
  onClear: () => void;
  children?: ReactNode;
}) {
  const [url] = useUrlState(availabilityCodec);
  // Shares the calendar's cache entry; only needed here for the facility's time zone.
  const zone = useMonthAvailability(facilityId, requestedMonth(url)).data?.availability.timeZone;
  const start = zone ? selection.start.setZone(zone) : null;
  const end = zone ? selection.end.setZone(zone) : null;

  return (
    <SelectionSummaryBar
      onChange={start ? () => onChange(start.toISODate() ?? '') : undefined}
      onClear={onClear}
      summary={
        start && end ? (
          <p>
            <span className="font-semibold">{facilityName}</span>
            {` · ${formatLongDate(start)} · `}
            <span className="tabular-nums">
              {formatClock(start)} to {formatClock(end)}
            </span>
          </p>
        ) : (
          <p className="font-semibold">{facilityName}: time selected</p>
        )
      }
    >
      {children}
    </SelectionSummaryBar>
  );
}
