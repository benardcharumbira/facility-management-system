import { useEffect, useId, useState } from 'react';
import { useApiClient, type FacilitySchedule } from '@/shared/api';
import {
  Alert,
  Button,
  controlStyles,
  FormField,
  ScheduleEditor,
  Section,
  useSnackbar,
} from '@/shared/components';
import { checkImpact, saveSchedule } from '../api';
import { explain, fieldErrors } from '../errors';
import { useRefreshAfterChange } from '../hooks';
import type { SectionProps } from './types';

interface Numbers {
  setupMinutes: string;
  teardownMinutes: string;
  minimumNoticeHours: string;
  maximumHorizonDays: string;
  maximumBookingDays: string;
}

const numbersOf = (s: FacilitySchedule): Numbers => ({
  setupMinutes: String(s.setupMinutes),
  teardownMinutes: String(s.teardownMinutes),
  minimumNoticeHours: String(s.minimumNoticeHours),
  maximumHorizonDays: String(s.maximumHorizonDays),
  maximumBookingDays: String(s.maximumBookingDays),
});

const FIELDS: Array<{ key: keyof Numbers; label: string; hint: string }> = [
  {
    key: 'setupMinutes',
    label: 'Set-up time before each booking (minutes)',
    hint: 'Held clear so the venue can be prepared. It blocks the same time in related spaces.',
  },
  {
    key: 'teardownMinutes',
    label: 'Clear-down time after each booking (minutes)',
    hint: 'Held clear so the venue can be cleaned and reset.',
  },
  {
    key: 'minimumNoticeHours',
    label: 'Minimum notice (hours)',
    hint: 'A booking cannot start sooner than this from now.',
  },
  {
    key: 'maximumHorizonDays',
    label: 'Furthest ahead a booking can be made (days)',
    hint: 'Applicants cannot book beyond this many days from today.',
  },
  {
    key: 'maximumBookingDays',
    label: 'Longest single booking (days)',
    hint: 'One request can cover up to this many days in a row, such as a wedding from Friday to Sunday. 1 keeps every booking within a single day. Opening hours bind only the first day’s start and the last day’s end; days in between are held in full.',
  },
];

export function ScheduleSection({ facility, guard, onDirtyChange }: SectionProps) {
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterChange();
  const id = useId();
  const initial = facility.schedule;
  const archived = facility.status === 'archived';

  const [days, setDays] = useState(initial.days);
  const [numbers, setNumbers] = useState(numbersOf(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const proposed = (): FacilitySchedule => ({
    days,
    setupMinutes: Number(numbers.setupMinutes),
    teardownMinutes: Number(numbers.teardownMinutes),
    minimumNoticeHours: Number(numbers.minimumNoticeHours),
    maximumHorizonDays: Number(numbers.maximumHorizonDays),
    maximumBookingDays: Number(numbers.maximumBookingDays),
  });
  const dirty =
    JSON.stringify(days) !== JSON.stringify(initial.days) ||
    JSON.stringify(numbers) !== JSON.stringify(numbersOf(initial));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = async () => {
    setErrors({});
    setFormError(null);
    setSaving(true);
    const schedule = proposed();
    try {
      const outcome = await guard({
        check: () => checkImpact(api, facility.id, { kind: 'schedule', schedule }),
        apply: async () => {
          try {
            await saveSchedule(api, facility.id, schedule);
          } catch (failure) {
            throw new Error(explain(failure));
          }
        },
        title: 'Save these hours and rules?',
        summary: `These changes to the hours or the set-up and clear-down time at ${facility.name} reach bookings that already exist.`,
        confirmLabel: 'Save and keep these bookings',
      });
      if (outcome === 'applied') {
        await refresh();
        notify('Schedule saved.', 'success');
      }
    } catch (failure) {
      const fields = fieldErrors(failure);
      if (Object.keys(fields).length > 0) setErrors(fields);
      else setFormError(explain(failure));
    } finally {
      setSaving(false);
    }
  };

  const dayErrors = Object.fromEntries(
    Object.entries(errors).flatMap(([key, message]) => {
      const match = /^days\.(\d)$/.exec(key);
      return match ? [[Number(match[1]) + 1, message]] : [];
    }),
  );

  return (
    <Section
      title="Schedule"
      description="When the facility can be booked, and the rules around a booking. Times are the facility's own."
    >
      <form
        className="flex max-w-3xl flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {formError && <Alert severity="error">{formError}</Alert>}
        <ScheduleEditor value={days} onChange={setDays} errors={dayErrors} disabled={archived} />
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <FormField
              key={field.key}
              id={`${id}-${field.key}`}
              label={field.label}
              hint={field.hint}
              error={errors[field.key]}
            >
              {(control) => (
                <input
                  {...control}
                  type="number"
                  inputMode="numeric"
                  min={
                    field.key === 'maximumHorizonDays' || field.key === 'maximumBookingDays' ? 1 : 0
                  }
                  value={numbers[field.key]}
                  disabled={archived}
                  onChange={(e) => setNumbers({ ...numbers, [field.key]: e.target.value })}
                  className={`${controlStyles} h-10`}
                />
              )}
            </FormField>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={archived || !dirty || saving}>
            {saving ? 'Saving…' : 'Save schedule'}
          </Button>
          <Button
            variant="secondary"
            disabled={!dirty || saving}
            onClick={() => {
              setDays(initial.days);
              setNumbers(numbersOf(initial));
              setErrors({});
            }}
          >
            Discard changes
          </Button>
        </div>
      </form>
    </Section>
  );
}
