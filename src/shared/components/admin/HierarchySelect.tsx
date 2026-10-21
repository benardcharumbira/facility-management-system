import { useId } from 'react';
import { controlStyles, FormField } from '../form/FormField';

export interface HierarchySelectProps {
  label: string;
  value: string | null;
  /**
   * The facilities this one may be placed inside. The server leaves out itself and everything
   * inside it, so a cycle is never offered: the control cannot make one.
   */
  eligible: Array<{ id: string; name: string }>;
  onChange: (parentId: string | null) => void;
  error?: string;
  disabled?: boolean;
  hint?: string;
}

/** Choose the facility this one is part of, or none. Only valid places are listed. */
export function HierarchySelect({
  label,
  value,
  eligible,
  onChange,
  error,
  disabled,
  hint,
}: HierarchySelectProps) {
  const id = useId();
  return (
    <FormField id={id} label={label} error={error} hint={hint}>
      {(control) => (
        <select
          {...control}
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
          className={`${controlStyles} h-10`}
        >
          <option value="">None: a standalone facility</option>
          {eligible.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}
