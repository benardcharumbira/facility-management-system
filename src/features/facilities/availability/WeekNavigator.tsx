import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DateTime } from 'luxon';
import { Button, IconButton } from '@/shared/components';

export interface WeekNavigatorProps {
  /** The Monday of the week shown. */
  monday: DateTime;
  onChange: (monday: DateTime) => void;
  /** The earliest and latest Mondays that can be reached. */
  min: DateTime;
  max: DateTime;
  /** Back to the month grid, on the month this week mostly falls in. */
  monthLabel: string;
  onBackToMonth: () => void;
}

/** "2 to 8 November 2026", or "26 October to 1 November 2026" when the week straddles months. */
export function weekLabel(monday: DateTime): string {
  const sunday = monday.plus({ days: 6 });
  const en = (d: DateTime, format: string) => d.setLocale('en').toFormat(format);
  if (monday.month === sunday.month) {
    return `${monday.day} to ${en(sunday, 'd LLLL yyyy')}`;
  }
  return `${en(monday, monday.year === sunday.year ? 'd LLLL' : 'd LLLL yyyy')} to ${en(sunday, 'd LLLL yyyy')}`;
}

/**
 * Previous and next week, a way back to the month, and the week in words. The change is announced
 * politely, as with the month.
 */
export function WeekNavigator({
  monday,
  onChange,
  min,
  max,
  monthLabel,
  onBackToMonth,
}: WeekNavigatorProps) {
  const label = weekLabel(monday);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <IconButton
        aria-label="Previous week"
        disabled={monday.toMillis() <= min.toMillis()}
        onClick={() => onChange(monday.minus({ weeks: 1 }))}
        className="border border-line-strong disabled:opacity-40"
      >
        <ChevronLeft aria-hidden className="size-5" />
      </IconButton>
      <p className="min-w-44 text-center text-sm font-semibold">{label}</p>
      <IconButton
        aria-label="Next week"
        disabled={monday.toMillis() >= max.toMillis()}
        onClick={() => onChange(monday.plus({ weeks: 1 }))}
        className="border border-line-strong disabled:opacity-40"
      >
        <ChevronRight aria-hidden className="size-5" />
      </IconButton>
      <Button variant="secondary" size="sm" onClick={onBackToMonth}>
        Back to {monthLabel}
      </Button>
      <p role="status" aria-live="polite" className="sr-only">
        Showing the week of {label}
      </p>
    </div>
  );
}
