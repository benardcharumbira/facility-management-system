import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import { useDensity } from '../backoffice/Density';

export interface ResultsToolbarProps {
  /** e.g. "28 facilities". Announced politely whenever it changes. Omit while there is no count yet. */
  countLabel?: string;
  /** Leading control, typically the mobile filters button. */
  leading?: ReactNode;
  sort?: ReactNode;
  viewToggle?: ReactNode;
}

export function ResultsToolbar({ countLabel, leading, sort, viewToggle }: ResultsToolbarProps) {
  const compact = useDensity() === 'compact';
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4',
        compact ? 'gap-y-1 text-sm' : 'gap-y-2',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        {/* The live region stays mounted so changes to its text are announced. */}
        <p role="status" aria-live="polite" className="font-medium">
          {countLabel}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {sort}
        {viewToggle}
      </div>
    </div>
  );
}
