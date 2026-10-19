import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export interface CheckboxFieldProps {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
  error?: string;
  disabled?: boolean;
}

/** A labelled checkbox with an optional hint and error, tied together for assistive technology. */
export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  hint,
  error,
  disabled,
}: CheckboxFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          className="mt-1 size-5 shrink-0 accent-primary"
        />
        <div>
          <label htmlFor={id} className="text-base">
            {label}
          </label>
          {hint && (
            <p id={hintId} className="text-sm text-muted">
              {hint}
            </p>
          )}
        </div>
      </div>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm font-medium text-danger"
        >
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
