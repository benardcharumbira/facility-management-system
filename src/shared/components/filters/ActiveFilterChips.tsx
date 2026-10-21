import { X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useDensity } from '../backoffice/Density';
import { Button } from '../ui/Button';

export interface ActiveFilter {
  /** Unique across all filters. */
  key: string;
  label: string;
  onRemove: () => void;
}

export interface ActiveFilterChipsProps {
  filters: ActiveFilter[];
  onClearAll: () => void;
}

/** One removable chip per applied filter value, plus "Clear all" while any are applied. */
export function ActiveFilterChips({ filters, onClearAll }: ActiveFilterChipsProps) {
  const compact = useDensity() === 'compact';
  if (filters.length === 0) return null;

  return (
    <ul aria-label="Active filters" className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
      {filters.map((filter) => (
        <li key={filter.key}>
          <button
            type="button"
            onClick={filter.onRemove}
            aria-label={`Remove filter: ${filter.label}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border border-primary-line bg-primary-soft font-medium text-primary hover:bg-primary-line/60',
              compact ? 'h-6 pr-1.5 pl-2.5 text-xs' : 'h-8 pr-2 pl-3 text-sm',
            )}
          >
            {filter.label}
            <X aria-hidden className="size-4" />
          </button>
        </li>
      ))}
      <li>
        <Button variant="ghost" size="sm" onClick={onClearAll}>
          Clear all
        </Button>
      </li>
    </ul>
  );
}
