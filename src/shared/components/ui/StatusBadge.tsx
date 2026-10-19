import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import { Swatch } from '../calendar/Swatch';
import type { Pattern } from '../calendar/patterns';

export interface StatusBadgeProps {
  /** The status in words. Always shown: the pattern and icon support it, never replace it. */
  label: string;
  icon: ReactNode;
  /** A fill pattern, so statuses differ in greyscale (see theme.css). */
  pattern: Pattern;
  /** Text colour class for the pattern, icon and label. */
  className?: string;
  size?: 'md' | 'lg';
}

/**
 * A status as a labelled mark: pattern, icon and text together, in the same pattern vocabulary
 * the calendar uses, so a status is never told apart by colour alone.
 */
export function StatusBadge({ label, icon, pattern, className, size = 'md' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-md border border-current bg-surface font-semibold whitespace-nowrap',
        size === 'lg' ? 'px-3 py-1.5 text-base' : 'px-2 py-1 text-sm',
        className,
      )}
    >
      <Swatch pattern={pattern} />
      <span aria-hidden className="flex">
        {icon}
      </span>
      <span className="text-ink">{label}</span>
    </span>
  );
}
