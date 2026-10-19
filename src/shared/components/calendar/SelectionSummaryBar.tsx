import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

export interface SelectionSummaryBarProps {
  /** What is chosen, in words: the thing, the date and the time window. */
  summary: ReactNode;
  /** Reopens the place where the choice is made. */
  onChange?: () => void;
  onClear: () => void;
  /** The action the selection leads to. */
  children?: ReactNode;
}

/** A persistent summary of a choice with a clear way to change or clear it. */
export function SelectionSummaryBar({
  summary,
  onChange,
  onClear,
  children,
}: SelectionSummaryBarProps) {
  return (
    <section
      aria-label="Your selection"
      className="flex flex-col gap-2 rounded-lg border border-primary-line bg-primary-soft p-3"
    >
      <div className="text-sm">{summary}</div>
      <div className="flex gap-2">
        {onChange && (
          <Button variant="secondary" size="sm" onClick={onChange}>
            Change
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
      {children}
    </section>
  );
}
