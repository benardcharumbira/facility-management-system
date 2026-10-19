import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Info } from 'luxon';
import { addMonths, compareYearMonth, type YearMonth } from '@/shared/utils/calendar';
import { IconButton } from '../ui/IconButton';

export interface MonthNavigatorProps {
  month: YearMonth;
  onChange: (month: YearMonth) => void;
  /** Earliest month that can be reached. */
  min: YearMonth;
  /** Latest month that can be reached. */
  max: YearMonth;
}

const MONTH_NAMES = Info.months('long', { locale: 'en' });
const select = 'h-10 rounded-md border border-line-strong bg-surface px-2 text-sm font-medium';

/**
 * Previous and next buttons plus direct month and year selectors, so a date months away is one
 * step rather than many. The change is announced politely.
 */
export function MonthNavigator({ month, onChange, min, max }: MonthNavigatorProps) {
  const years = Array.from({ length: max.year - min.year + 1 }, (_, i) => min.year + i);
  const clamp = (target: YearMonth): YearMonth =>
    compareYearMonth(target, min) < 0 ? min : compareYearMonth(target, max) > 0 ? max : target;
  const label = `${MONTH_NAMES[month.month - 1]} ${month.year}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <IconButton
        aria-label="Previous month"
        disabled={compareYearMonth(month, min) <= 0}
        onClick={() => onChange(addMonths(month, -1))}
        className="border border-line-strong disabled:opacity-40"
      >
        <ChevronLeft aria-hidden className="size-5" />
      </IconButton>
      <select
        aria-label="Month"
        value={month.month}
        onChange={(event) =>
          onChange(clamp({ year: month.year, month: Number(event.target.value) }))
        }
        className={select}
      >
        {MONTH_NAMES.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Year"
        value={month.year}
        onChange={(event) =>
          onChange(clamp({ year: Number(event.target.value), month: month.month }))
        }
        className={select}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
      <IconButton
        aria-label="Next month"
        disabled={compareYearMonth(month, max) >= 0}
        onClick={() => onChange(addMonths(month, 1))}
        className="border border-line-strong disabled:opacity-40"
      >
        <ChevronRight aria-hidden className="size-5" />
      </IconButton>
      <p role="status" aria-live="polite" className="sr-only">
        Showing {label}
      </p>
    </div>
  );
}
