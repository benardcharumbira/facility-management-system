import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useApiClient, type FacilityCapacity } from '@/shared/api';
import { Alert, Button, controlStyles, FormField, Section, useSnackbar } from '@/shared/components';
import { checkImpact, saveCapacity } from '../api';
import { explain, fieldErrors } from '../errors';
import { useArrangementNames, useRefreshAfterChange } from '../hooks';
import type { SectionProps } from './types';

interface Row {
  key: number;
  arrangement: string;
  capacity: string;
}

export function CapacitySection({ facility, guard, onDirtyChange }: SectionProps) {
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterChange();
  const id = useId();
  const names = useArrangementNames();
  const archived = facility.status === 'archived';
  const applies = facility.type.capacityApplies;
  const initial = facility.capacity;

  const [maximum, setMaximum] = useState(initial.maximum === null ? '' : String(initial.maximum));
  const [rows, setRows] = useState<Row[]>(
    initial.byArrangement.map((c, key) => ({
      key,
      arrangement: c.arrangement,
      capacity: String(c.capacity),
    })),
  );
  const [nextKey, setNextKey] = useState(initial.byArrangement.length);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const proposed = (): FacilityCapacity => ({
    maximum: maximum.trim() === '' ? null : Number(maximum),
    byArrangement: rows.map((r) => ({ arrangement: r.arrangement, capacity: Number(r.capacity) })),
  });
  const dirty = JSON.stringify(proposed()) !== JSON.stringify(initial);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  if (!applies) {
    return (
      <Section title="Capacity">
        <Alert severity="info">
          Capacity does not apply to a {facility.type.name.toLowerCase()}. You can change that in
          the facility types on the list.
        </Alert>
      </Section>
    );
  }

  const save = async () => {
    setErrors({});
    setFormError(null);
    setSaving(true);
    const capacity = proposed();
    try {
      const outcome = await guard({
        check: () => checkImpact(api, facility.id, { kind: 'capacity', capacity }),
        apply: async () => {
          try {
            await saveCapacity(api, facility.id, capacity);
          } catch (failure) {
            throw new Error(explain(failure));
          }
        },
        title: 'Reduce the capacity?',
        summary: `Fewer people will fit at ${facility.name} than some upcoming bookings expect.`,
        confirmLabel: 'Save and keep these bookings',
      });
      if (outcome === 'applied') {
        await refresh();
        notify('Capacity saved.', 'success');
      }
    } catch (failure) {
      const fields = fieldErrors(failure);
      if (Object.keys(fields).length > 0) setErrors(fields);
      else setFormError(explain(failure));
    } finally {
      setSaving(false);
    }
  };

  const options = (current: string) => {
    const all = names.data ?? [];
    return all.includes(current) || current === '' ? all : [current, ...all];
  };

  return (
    <Section
      title="Capacity"
      description="How many people the facility holds, overall and for each seating arrangement. The booking form warns an applicant who expects more than this."
    >
      <form
        className="flex max-w-2xl flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {formError && <Alert severity="error">{formError}</Alert>}
        <FormField
          id={`${id}-max`}
          label="Most the facility holds"
          hint="The greatest number of people in any arrangement. Leave blank if it is not known."
          error={errors.maximum}
        >
          {(control) => (
            <input
              {...control}
              type="number"
              inputMode="numeric"
              min={1}
              value={maximum}
              disabled={archived}
              onChange={(e) => setMaximum(e.target.value)}
              className={`${controlStyles} h-10 max-w-40`}
            />
          )}
        </FormField>

        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-1 text-sm font-medium">By seating arrangement</legend>
          {rows.length === 0 && (
            <p className="text-muted">No seating arrangements are listed for this facility.</p>
          )}
          {rows.map((row, index) => (
            <div key={row.key} className="flex flex-wrap items-start gap-3">
              <FormField
                id={`${id}-arr-${row.key}`}
                label={`Arrangement ${index + 1}`}
                error={errors[`byArrangement.${index}`]}
                className="min-w-48 flex-1"
              >
                {(control) => (
                  <select
                    {...control}
                    value={row.arrangement}
                    disabled={archived}
                    onChange={(e) =>
                      setRows(
                        rows.map((r) => (r === row ? { ...r, arrangement: e.target.value } : r)),
                      )
                    }
                    className={`${controlStyles} h-10`}
                  >
                    <option value="">Choose an arrangement</option>
                    {options(row.arrangement).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField id={`${id}-cap-${row.key}`} label={`Seats for arrangement ${index + 1}`}>
                {(control) => (
                  <input
                    {...control}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={row.capacity}
                    disabled={archived}
                    onChange={(e) =>
                      setRows(rows.map((r) => (r === row ? { ...r, capacity: e.target.value } : r)))
                    }
                    className={`${controlStyles} h-10 w-28`}
                  />
                )}
              </FormField>
              <Button
                variant="secondary"
                size="sm"
                disabled={archived}
                className="mt-7"
                aria-label={`Remove ${row.arrangement || `arrangement ${index + 1}`}`}
                onClick={() => setRows(rows.filter((r) => r !== row))}
              >
                <Trash2 aria-hidden className="size-4" />
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button
              variant="secondary"
              size="sm"
              disabled={archived}
              onClick={() => {
                setRows([...rows, { key: nextKey, arrangement: '', capacity: '' }]);
                setNextKey(nextKey + 1);
              }}
            >
              <Plus aria-hidden className="size-4" />
              Add an arrangement
            </Button>
          </div>
        </fieldset>

        <div className="flex gap-2">
          <Button type="submit" disabled={archived || !dirty || saving}>
            {saving ? 'Saving…' : 'Save capacity'}
          </Button>
          <Button
            variant="secondary"
            disabled={!dirty || saving}
            onClick={() => {
              setMaximum(initial.maximum === null ? '' : String(initial.maximum));
              setRows(
                initial.byArrangement.map((c, key) => ({
                  key,
                  arrangement: c.arrangement,
                  capacity: String(c.capacity),
                })),
              );
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
