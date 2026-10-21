import { DateTime } from 'luxon';
import { useId } from 'react';
import { controlStyles, FormField } from '../form/FormField';

export interface DateRangeValue {
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
}

export const EMPTY_DATE_RANGE: DateRangeValue = {
  startDate: '',
  endDate: '',
  allDay: true,
  startTime: '08:00',
  endTime: '17:00',
};

/**
 * The instants a range means in a time zone. A whole day range runs from the start of the first
 * day to the start of the day after the last, so the last day is included. Null while incomplete.
 */
export function rangeToInstants(
  value: DateRangeValue,
  zone: string,
): { startsAt: string; endsAt: string; allDay: boolean } | null {
  if (!value.startDate || !value.endDate) return null;
  const at = (date: string, time: string) =>
    DateTime.fromISO(`${date}T${time}`, { zone }).toUTC().toISO({ suppressMilliseconds: true });
  const startsAt = value.allDay
    ? at(value.startDate, '00:00')
    : at(value.startDate, value.startTime);
  const endsAt = value.allDay
    ? DateTime.fromISO(value.endDate, { zone })
        .plus({ days: 1 })
        .toUTC()
        .toISO({ suppressMilliseconds: true })
    : at(value.endDate, value.endTime);
  return startsAt && endsAt ? { startsAt, endsAt, allDay: value.allDay } : null;
}

export interface DateRangeFieldProps {
  legend: string;
  hint?: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  startError?: string;
  endError?: string;
  /** The earliest date that can be chosen, YYYY-MM-DD. */
  min?: string;
}

/** A date range, whole days or with times. The dates and times are the facility's, not the browser's. */
export function DateRangeField({
  legend,
  hint,
  value,
  onChange,
  startError,
  endError,
  min,
}: DateRangeFieldProps) {
  const id = useId();
  const set = (patch: Partial<DateRangeValue>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {hint && <p className="-mt-1 text-sm text-muted">{hint}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id={`${id}-from`} label="First day" error={startError} required>
          {(control) => (
            <input
              {...control}
              type="date"
              min={min}
              value={value.startDate}
              onChange={(e) =>
                set({ startDate: e.target.value, endDate: value.endDate || e.target.value })
              }
              className={`${controlStyles} h-10`}
            />
          )}
        </FormField>
        <FormField id={`${id}-to`} label="Last day" error={endError} required>
          {(control) => (
            <input
              {...control}
              type="date"
              min={value.startDate || min}
              value={value.endDate}
              onChange={(e) => set({ endDate: e.target.value })}
              className={`${controlStyles} h-10`}
            />
          )}
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={value.allDay}
          onChange={(e) => set({ allDay: e.target.checked })}
          className="size-4"
        />
        Closed all day
      </label>
      {!value.allDay && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id={`${id}-from-time`} label="From">
            {(control) => (
              <input
                {...control}
                type="time"
                value={value.startTime}
                onChange={(e) => set({ startTime: e.target.value })}
                className={`${controlStyles} h-10`}
              />
            )}
          </FormField>
          <FormField id={`${id}-to-time`} label="Until">
            {(control) => (
              <input
                {...control}
                type="time"
                value={value.endTime}
                onChange={(e) => set({ endTime: e.target.value })}
                className={`${controlStyles} h-10`}
              />
            )}
          </FormField>
        </div>
      )}
    </fieldset>
  );
}
