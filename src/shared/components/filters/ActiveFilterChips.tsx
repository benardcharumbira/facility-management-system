import { X } from 'lucide-react';
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
  if (filters.length === 0) return null;

  return (
    <ul aria-label="Active filters" className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
      {filters.map((filter) => (
        <li key={filter.key}>
          <button
            type="button"
            onClick={filter.onRemove}
            aria-label={`Remove filter: ${filter.label}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary-line bg-primary-soft pr-2 pl-3 text-sm font-medium text-primary hover:bg-primary-line/60"
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
