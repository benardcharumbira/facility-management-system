import { Minus, Plus } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
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
}

/**
 * A number with minus and plus buttons and direct numeric entry. Arrow keys step the number in
 * the field. Entries are committed on blur or Enter, then clamped to the limits, and a cap is
 * explained in text.
 */
export function QuantityStepper({ name, value, onChange, min = 1, max, id }: QuantityStepperProps) {
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
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          aria-label={`${name} quantity`}
          aria-describedby={max !== undefined ? noteId : undefined}
          value={draft ?? String(value)}
          onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
          onBlur={commitDraft}
          onKeyDown={onKeyDown}
          className="h-10 w-16 rounded-md border border-line-strong bg-surface px-2 text-center tabular-nums"
        />
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
