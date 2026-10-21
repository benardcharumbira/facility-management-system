import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

export interface UnsavedChangesBarProps {
  /** How many things have been changed and not saved. */
  count: number;
  onSave: () => void;
  onDiscard: () => void;
  saving?: boolean;
  /** A failed save, in words. The edits are kept. */
  error?: ReactNode;
  /** What is being changed, in the plural, for the count: "changes" by default. */
  noun?: { one: string; other: string };
}

/**
 * The count of unsaved edits, announced politely as it changes, with a single Save for the lot and
 * a way to discard. Stays at the foot of the screen so it is never scrolled out of reach of a
 * long form or a grid. It stays on the page when there is nothing unsaved, so the announcement has
 * somewhere to be made.
 */
export function UnsavedChangesBar({
  count,
  onSave,
  onDiscard,
  saving = false,
  error,
  noun = { one: 'change', other: 'changes' },
}: UnsavedChangesBarProps) {
  return (
    <section
      aria-label="Unsaved changes"
      className="sticky bottom-0 z-30 -mx-4 mt-4 border-t border-line bg-surface px-4 py-3 shadow-overlay sm:-mx-6 sm:px-6"
    >
      {error && (
        <div role="alert" className="mb-2 text-sm font-medium text-danger">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className={count > 0 ? 'font-semibold' : 'text-muted'}>
          {count === 0
            ? `No unsaved ${noun.other}`
            : `${count} unsaved ${count === 1 ? noun.one : noun.other}`}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={count === 0 || saving} onClick={onDiscard}>
            Discard {count === 1 ? noun.one : noun.other}
          </Button>
          <Button disabled={count === 0 || saving} onClick={onSave}>
            {saving
              ? 'Saving…'
              : count > 0
                ? `Save ${count} ${count === 1 ? noun.one : noun.other}`
                : 'Save'}
          </Button>
        </div>
      </div>
    </section>
  );
}
