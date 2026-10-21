import { useId } from 'react';
import type { CreateResourceRequest } from '@/shared/api';
import { controlStyles, FormField } from '@/shared/components';
import { CATEGORY_LABELS } from '../labels';

export type ResourceValues = Omit<CreateResourceRequest, 'description'> & { description: string };

export const EMPTY_RESOURCE: ResourceValues = {
  name: '',
  category: 'venue',
  quantified: true,
  description: '',
};

export function validateResource(values: ResourceValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.name.trim() === '') errors.name = 'Enter the name of the resource.';
  return errors;
}

/** The fields of a catalogue entry. A change here changes the vocabulary everywhere. */
export function ResourceForm({
  values,
  onChange,
  errors,
  disabled,
}: {
  values: ResourceValues;
  onChange: (values: ResourceValues) => void;
  errors: Record<string, string>;
  disabled?: boolean;
}) {
  const id = useId();
  const set = (patch: Partial<ResourceValues>) => onChange({ ...values, ...patch });
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <FormField id={`${id}-name`} label="Name" error={errors.name} required>
        {(control) => (
          <input
            {...control}
            value={values.name}
            disabled={disabled}
            maxLength={60}
            onChange={(e) => set({ name: e.target.value })}
            className={`${controlStyles} h-10`}
          />
        )}
      </FormField>
      <FormField
        id={`${id}-category`}
        label="Category"
        hint="Matches the booking form's grouping: venue resources are always shown, kitchen resources sit behind a disclosure."
        error={errors.category}
      >
        {(control) => (
          <select
            {...control}
            value={values.category}
            disabled={disabled}
            onChange={(e) => set({ category: e.target.value as ResourceValues['category'] })}
            className={`${controlStyles} h-10`}
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-medium">How it is recorded</legend>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name={`${id}-quantified`}
            checked={values.quantified}
            disabled={disabled}
            onChange={() => set({ quantified: true })}
            className="mt-1"
          />
          <span>
            <strong>Counted.</strong> Each facility holds a number of them: chairs, cups, an urn.
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name={`${id}-quantified`}
            checked={!values.quantified}
            disabled={disabled}
            onChange={() => set({ quantified: false })}
            className="mt-1"
          />
          <span>
            <strong>Available or not.</strong> A facility has it or it does not, and a number means
            nothing: a stage, a podium, a sound system.
          </span>
        </label>
      </fieldset>
      <FormField
        id={`${id}-description`}
        label="Description (optional)"
        hint="For administrators. It is not shown to applicants."
        error={errors.description}
      >
        {(control) => (
          <textarea
            {...control}
            rows={3}
            value={values.description}
            disabled={disabled}
            maxLength={300}
            onChange={(e) => set({ description: e.target.value })}
            className={`${controlStyles} py-2`}
          />
        )}
      </FormField>
    </div>
  );
}
