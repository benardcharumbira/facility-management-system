import { cn } from '@/shared/utils/cn';
import { useDensity } from '../backoffice/Density';
import { Skeleton } from '../ui/Skeleton';
import { ResultsGrid } from './ResultsGrid';

/** A line of text, a two line title, or a row of chips; each matches the real element's height. */
export type SkeletonRow = 'title' | 'text' | 'chips';

const ROW_CLASSES: Record<SkeletonRow, string> = {
  title: 'h-12 w-4/5',
  text: 'h-5 w-3/5',
  chips: 'h-6 w-2/5',
};

export interface CardSkeletonProps {
  /** `row` is the compact list presentation. */
  layout?: 'card' | 'row';
  hasMedia?: boolean;
  rows?: SkeletonRow[];
}

const DEFAULT_ROWS: SkeletonRow[] = ['text', 'title', 'text', 'text', 'chips'];

export function CardSkeleton({
  layout = 'card',
  hasMedia = true,
  rows = DEFAULT_ROWS,
}: CardSkeletonProps) {
  const compact = useDensity() === 'compact';
  const lines = rows.map((row, index) => (
    <Skeleton key={index} className={cn(ROW_CLASSES[row], row === 'chips' && 'mt-2')} />
  ));

  if (layout === 'row') {
    return (
      <div
        aria-hidden
        className={cn(
          'flex w-full rounded-lg border border-line bg-surface',
          compact ? 'gap-2 p-2' : 'gap-4 p-4',
        )}
      >
        {hasMedia && <Skeleton className="aspect-4/3 w-28 shrink-0" />}
        <div className="flex flex-1 flex-col gap-1">{lines}</div>
      </div>
    );
  }

  return (
    <div aria-hidden className="w-full overflow-hidden rounded-lg border border-line bg-surface">
      {hasMedia && <Skeleton className="aspect-video w-full rounded-none" />}
      <div className="flex flex-col gap-1 p-4">{lines}</div>
    </div>
  );
}

export interface SkeletonGridProps extends CardSkeletonProps {
  count?: number;
}

/** Placeholder cards laid out in the same grid as the real results. */
export function SkeletonGrid({ count = 8, layout = 'card', ...card }: SkeletonGridProps) {
  return (
    <ResultsGrid layout={layout === 'row' ? 'rows' : 'cards'} label="Loading results">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} layout={layout} {...card} />
      ))}
    </ResultsGrid>
  );
}
