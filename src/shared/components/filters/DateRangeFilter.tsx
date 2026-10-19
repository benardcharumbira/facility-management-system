import { useId } from 'react';

export interface DateRange {
  /** ISO dates (YYYY-MM-DD). Undefined means unbounded. */
  from: string | undefined;
  to: string | undefined;
}

export interface DateRangeFilterProps {
  /** Programmatic label for the pair, e.g. "Event date". */
  label: string;
  value: DateRange;
  onChange: (value: DateRange) => void;
}

/** Two native date inputs, from and to. The end cannot be set before the start. */
export function DateRangeFilter({ label, value, onChange }: DateRangeFilterProps) {
  const id = useId();
  const field = 'h-10 w-full rounded-md border border-line-strong bg-surface px-2';
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3">
      <div>
        <label htmlFor={`${id}-from`} className="mb-1 block text-xs text-muted">
          From
        </label>
        <input
          id={`${id}-from`}
          type="date"
          value={value.from ?? ''}
          max={value.to}
          onChange={(event) => onChange({ ...value, from: event.target.value || undefined })}
          className={field}
        />
      </div>
      <div>
        <label htmlFor={`${id}-to`} className="mb-1 block text-xs text-muted">
          To
        </label>
        <input
          id={`${id}-to`}
          type="date"
          value={value.to ?? ''}
          min={value.from}
          onChange={(event) => onChange({ ...value, to: event.target.value || undefined })}
          className={field}
        />
      </div>
    </div>
  );
}
