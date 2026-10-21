import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Paginated } from '@/shared/types/pagination';
import { cn } from '@/shared/utils/cn';
import { useDensity } from '../backoffice/Density';

export interface PaginationProps {
  /** The response envelope, or anything with its page fields. */
  envelope: Pick<Paginated<unknown>, 'page' | 'totalPages'>;
  onChange: (page: number) => void;
}

const SIBLINGS = 1;

/** Page numbers to show: first, last, the current page and its neighbours, with gaps as null. */
function visiblePages(page: number, total: number): Array<number | null> {
  const wanted = new Set(
    [1, total, ...Array.from({ length: SIBLINGS * 2 + 1 }, (_, i) => page - SIBLINGS + i)].filter(
      (n) => n >= 1 && n <= total,
    ),
  );
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - (sorted[i - 1] ?? 0) > 1 ? [null, n] : [n]));
}

const item =
  'flex items-center justify-center rounded-md px-2 text-sm font-medium disabled:opacity-40';
const SIZES = { comfortable: 'h-10 min-w-10', compact: 'h-8 min-w-8' } as const;

/** Renders nothing when everything fits on one page. */
export function Pagination({ envelope, onChange }: PaginationProps) {
  const { page, totalPages } = envelope;
  const density = useDensity();
  if (totalPages <= 1) return null;
  const size = SIZES[density];

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex justify-center', density === 'compact' ? 'mt-2' : 'mt-6')}
    >
      <ul className="flex items-center gap-1">
        <li>
          <button
            type="button"
            aria-label="Go to previous page"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            className={cn(item, size, 'text-muted hover:bg-sunken')}
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
        </li>
        {visiblePages(page, totalPages).map((n, index) =>
          n === null ? (
            <li key={`gap-${index}`} aria-hidden className="px-1 text-subtle">
              …
            </li>
          ) : (
            <li key={n}>
              <button
                type="button"
                aria-label={`Go to page ${n}`}
                aria-current={n === page ? 'page' : undefined}
                onClick={() => onChange(n)}
                className={cn(
                  item,
                  size,
                  n === page ? 'bg-primary text-on-primary' : 'text-ink hover:bg-sunken',
                )}
              >
                {n}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            aria-label="Go to next page"
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
            className={cn(item, size, 'text-muted hover:bg-sunken')}
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
