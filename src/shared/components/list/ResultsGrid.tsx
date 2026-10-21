import { Children, type ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import { useDensity } from '../backoffice/Density';

export interface ResultsGridProps {
  children: ReactNode;
  /** `cards` adapts from one to four columns; `rows` is a single column list. */
  layout?: 'cards' | 'rows';
  /** Accessible name for the list. */
  label?: string;
}

// Columns follow the width available to the results, not the viewport, so the shell's
// navigation and the filter sidebar never squeeze cards below a usable width.
const LAYOUTS = {
  cards: 'grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-4',
  rows: 'grid-cols-1',
} as const;

/**
 * Responsive grid of equal height cells, rendered as a list. Loading and loaded content
 * share this component so the layout does not shift between them.
 */
export function ResultsGrid({ children, layout = 'cards', label }: ResultsGridProps) {
  const compact = useDensity() === 'compact';
  return (
    <div className="@container">
      <ul
        aria-label={label}
        className={cn('grid list-none p-0', compact ? 'gap-1' : 'gap-4', LAYOUTS[layout])}
      >
        {Children.map(children, (child) => (
          <li className="flex min-w-0">{child}</li>
        ))}
      </ul>
    </div>
  );
}
