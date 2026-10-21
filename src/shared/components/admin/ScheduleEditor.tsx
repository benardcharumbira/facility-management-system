import { Copy } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useId, useState } from 'react';
import type { OperatingDay } from '@/shared/api';
import { controlStyles } from '../form/FormField';
import { Button } from '../ui/Button';

export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const DEFAULT_OPEN = { opensAt: '08:00', closesAt: '17:00' };

export interface ScheduleEditorProps {
  value: OperatingDay[];
  onChange: (days: OperatingDay[]) => void;
  /** A problem with a day, keyed by its day of week (1 to 7). */
  errors?: Record<number, string>;
  disabled?: boolean;
}

/**
 * Operating hours for each day of the week. Closed is a choice of its own, not blank times.
 * "Copy to other days" applies one day's hours to the days picked, since most venues keep the
 * same hours from Monday to Friday.
 */
export function ScheduleEditor({ value, onChange, errors = {}, disabled }: ScheduleEditorProps) {
  const [copyFrom, setCopyFrom] = useState<number | null>(null);

  const update = (dayOfWeek: number, patch: Partial<OperatingDay>) =>
    onChange(value.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));

  return (
    <>
      <ul aria-label="Operating hours" className="m-0 flex list-none flex-col gap-2 p-0">
        {value.map((day) => (
          <DayRow
            key={day.dayOfWeek}
            day={day}
            error={errors[day.dayOfWeek]}
            disabled={disabled}
            onChange={(patch) => update(day.dayOfWeek, patch)}
            onCopy={() => setCopyFrom(day.dayOfWeek)}
          />
        ))}
      </ul>
      {copyFrom !== null && (
        <CopyDialog
          from={value.find((d) => d.dayOfWeek === copyFrom)}
          onClose={() => setCopyFrom(null)}
          onCopy={(targets) => {
            const source = value.find((d) => d.dayOfWeek === copyFrom);
            if (source) {
              onChange(
                value.map((d) =>
                  targets.includes(d.dayOfWeek)
                    ? { ...d, opensAt: source.opensAt, closesAt: source.closesAt }
                    : d,
                ),
              );
            }
            setCopyFrom(null);
          }}
        />
      )}
    </>
  );
}

function DayRow({
  day,
  error,
  disabled,
  onChange,
  onCopy,
}: {
  day: OperatingDay;
  error?: string;
  disabled?: boolean;
  onChange: (patch: Partial<OperatingDay>) => void;
  onCopy: () => void;
}) {
  const id = useId();
  const name = DAY_NAMES[day.dayOfWeek - 1] ?? '';
  const open = day.opensAt !== null && day.closesAt !== null;
  return (
    <li className="rounded-md border border-line bg-surface p-3">
      <fieldset className="m-0 flex flex-wrap items-center gap-x-4 gap-y-2 border-0 p-0">
        <legend className="sr-only">{name}</legend>
        <span aria-hidden className="w-24 font-medium">
          {name}
        </span>
        <div role="radiogroup" aria-label={`${name} is`} className="flex gap-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={`${id}-state`}
              checked={open}
              disabled={disabled}
              onChange={() => onChange(DEFAULT_OPEN)}
            />
            Open
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={`${id}-state`}
              checked={!open}
              disabled={disabled}
              onChange={() => onChange({ opensAt: null, closesAt: null })}
            />
            Closed
          </label>
        </div>
        {open ? (
          <div className="flex items-center gap-2">
            <input
              type="time"
              aria-label={`${name} opens`}
              value={day.opensAt ?? ''}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              onChange={(e) => onChange({ opensAt: e.target.value })}
              className={`${controlStyles} h-9 w-32`}
            />
            <span aria-hidden>to</span>
            <input
              type="time"
              aria-label={`${name} closes`}
              value={day.closesAt ?? ''}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              onChange={(e) => onChange({ closesAt: e.target.value })}
              className={`${controlStyles} h-9 w-32`}
            />
          </div>
        ) : (
          <span className="text-muted">Closed all day</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onCopy}
          aria-label={`Copy ${name} to other days`}
          className="ml-auto"
        >
          <Copy aria-hidden className="size-4" />
          Copy to other days
        </Button>
      </fieldset>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {name}: {error}
        </p>
      )}
    </li>
  );
}

function CopyDialog({
  from,
  onClose,
  onCopy,
}: {
  from: OperatingDay | undefined;
  onClose: () => void;
  onCopy: (targets: number[]) => void;
}) {
  const source = from?.dayOfWeek ?? 1;
  const weekday = source <= 5;
  const [picked, setPicked] = useState<number[]>(
    DAY_NAMES.map((_, i) => i + 1).filter((d) => d !== source && (weekday ? d <= 5 : true)),
  );
  const name = DAY_NAMES[source - 1] ?? '';
  const hours = from?.opensAt && from.closesAt ? `${from.opensAt} to ${from.closesAt}` : 'closed';

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-surface p-6 shadow-overlay"
        >
          <Dialog.Title className="text-lg font-semibold">Copy {name}</Dialog.Title>
          <p className="text-muted">
            Give the days you choose the same hours as {name}: {hours}.
          </p>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1 text-sm font-medium">Copy to</legend>
            {DAY_NAMES.map((dayName, index) => {
              const dayOfWeek = index + 1;
              if (dayOfWeek === source) return null;
              return (
                <label key={dayName} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={picked.includes(dayOfWeek)}
                    onChange={(e) =>
                      setPicked(
                        e.target.checked
                          ? [...picked, dayOfWeek]
                          : picked.filter((d) => d !== dayOfWeek),
                      )
                    }
                    className="size-4"
                  />
                  {dayName}
                </label>
              );
            })}
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={picked.length === 0} onClick={() => onCopy(picked)}>
              Copy hours
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
