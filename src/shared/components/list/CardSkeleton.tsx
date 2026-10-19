import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import type { TypographyVariant } from '@mui/material/styles';
import { ResultsGrid, type GridColumns } from './ResultsGrid';

export interface CardSkeletonProps {
  /** `row` is the compact list presentation. */
  layout?: 'card' | 'row';
  hasMedia?: boolean;
  /**
   * One line per entry. A typography variant gives a text line of the same height as the real
   * text; a number gives a block of that many theme spacing units (e.g. a chip row).
   */
  rows?: Array<TypographyVariant | number>;
}

const DEFAULT_ROWS: Array<TypographyVariant | number> = [
  'h6',
  'h6',
  'body2',
  'body2',
  'body2',
  'body2',
];

export function CardSkeleton({
  layout = 'card',
  hasMedia = true,
  rows = DEFAULT_ROWS,
}: CardSkeletonProps) {
  const lines = rows.map((row, index) =>
    typeof row === 'number' ? (
      <Skeleton key={index} variant="rounded" sx={{ height: (theme) => theme.spacing(row) }} />
    ) : (
      <Skeleton key={index} variant="text" sx={{ typography: row }} />
    ),
  );

  if (layout === 'row') {
    return (
      <Card variant="outlined" sx={{ width: '100%' }} aria-hidden>
        <Stack direction="row" spacing={2} sx={{ p: 2 }}>
          {hasMedia && (
            <Skeleton
              variant="rectangular"
              sx={{
                width: (theme) => theme.spacing(14),
                flexShrink: 0,
                aspectRatio: '4 / 3',
                height: 'auto',
              }}
            />
          )}
          <Stack sx={{ flexGrow: 1 }}>{lines}</Stack>
        </Stack>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ width: '100%' }} aria-hidden>
      {hasMedia && (
        <Skeleton
          variant="rectangular"
          sx={{ width: '100%', aspectRatio: '16 / 9', height: 'auto' }}
        />
      )}
      <CardContent>{lines}</CardContent>
    </Card>
  );
}

export interface SkeletonGridProps extends CardSkeletonProps {
  count?: number;
  columns?: GridColumns;
}

/** Placeholder cards laid out in the same grid as the real results. */
export function SkeletonGrid({ count = 8, columns, ...card }: SkeletonGridProps) {
  return (
    <ResultsGrid columns={columns} label="Loading results">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} {...card} />
      ))}
    </ResultsGrid>
  );
}
