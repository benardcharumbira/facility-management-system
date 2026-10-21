import { Minus, Plus } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { useDensity } from '../backoffice/Density';
import { IconButton } from '../ui/IconButton';

export interface QuantityStepperProps {
  /** What is being counted, e.g. "Chairs". Used to name the controls. */
  name: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** The most that can be asked for. Larger entries are capped and the cap is stated. */
  max?: number;
  id?: string;
  /** The accessible name of the number. Defaults to the name followed by "quantity". */
  label?: string;
  /** Passed to the input, e.g. what a grid needs to move focus between cells. */
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'type' | 'id' | 'aria-label'
  >;
}

/**
 * A number with minus and plus buttons and direct numeric entry. Arrow keys step the number in
 * the field. Entries are committed on blur or Enter, then clamped to the limits, and a cap is
 * explained in text.
 *
 * At the compact density (a grid cell) it is the number alone: no buttons, no note, and the arrow
 * keys are left to whatever moves between cells.
 */
export function QuantityStepper({
  name,
  value,
  onChange,
  min = 1,
  max,
  id,
  label,
  inputProps,
}: QuantityStepperProps) {
  const compact = useDensity() === 'compact';
  const generated = useId();
  const inputId = id ?? `${generated}-qty`;
  const noteId = `${inputId}-note`;
  const [draft, setDraft] = useState<string | null>(null);
  const [capped, setCapped] = useState(false);

  const commit = (next: number) => {
    const clamped = Math.max(min, max === undefined ? next : Math.min(max, next));
    setCapped(max !== undefined && next > max);
    onChange(clamped);
  };
  const commitDraft = () => {
    if (draft === null) return;
    const parsed = Number.parseInt(draft, 10);
    setDraft(null);
    if (Number.isFinite(parsed)) commit(parsed);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    inputProps?.onKeyDown?.(event);
    if (compact) {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitDraft();
      }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      commit((draft === null ? value : Number.parseInt(draft, 10) || value) + 1);
      setDraft(null);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      commit((draft === null ? value : Number.parseInt(draft, 10) || value) - 1);
      setDraft(null);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
    }
  };

  const input = (
    <input
      {...inputProps}
      id={inputId}
      type="text"
      inputMode="numeric"
      aria-label={label ?? `${name} quantity`}
      aria-describedby={max !== undefined && !compact ? noteId : undefined}
      value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
      onBlur={(event) => {
        commitDraft();
        inputProps?.onBlur?.(event);
      }}
      onKeyDown={onKeyDown}
      className={
        compact
          ? 'h-8 w-16 rounded-md border border-line-strong bg-surface px-1.5 text-center text-sm tabular-nums'
          : 'h-10 w-16 rounded-md border border-line-strong bg-surface px-2 text-center tabular-nums'
      }
    />
  );

  if (compact) return input;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label htmlFor={inputId} className="mr-2 text-sm text-muted">
          Quantity
        </label>
        <IconButton
          aria-label={`Decrease ${name}`}
          disabled={value <= min}
          onClick={() => commit(value - 1)}
          className="border border-line-strong disabled:opacity-40"
        >
          <Minus aria-hidden className="size-4" />
        </IconButton>
        {input}
        <IconButton
          aria-label={`Increase ${name}`}
          disabled={max !== undefined && value >= max}
          onClick={() => commit(value + 1)}
          className="border border-line-strong disabled:opacity-40"
        >
          <Plus aria-hidden className="size-4" />
        </IconButton>
      </div>
      {max !== undefined && (
        <p
          id={noteId}
          className={capped ? 'text-sm font-medium text-warning' : 'text-sm text-muted'}
        >
          {capped
            ? `Only ${max} available, so the quantity was set to ${max}.`
            : `Up to ${max} available.`}
        </p>
      )}
    </div>
  );
}
