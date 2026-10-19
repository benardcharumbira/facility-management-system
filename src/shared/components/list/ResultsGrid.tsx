import Box from '@mui/material/Box';
import { Children, type ReactNode } from 'react';

export interface GridColumns {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

export interface ResultsGridProps {
  children: ReactNode;
  columns?: GridColumns;
  /** Accessible name for the list. */
  label?: string;
}

const DEFAULT_COLUMNS: GridColumns = { xs: 1, sm: 2, md: 3, lg: 4 };

/**
 * Responsive grid of equal height cells, rendered as a list. Use `columns={{ xs: 1 }}`
 * for a single column list. Loading and loaded content share this component so the layout
 * does not shift between them.
 */
export function ResultsGrid({ children, columns = DEFAULT_COLUMNS, label }: ResultsGridProps) {
  const templates = Object.fromEntries(
    Object.entries(columns).map(([breakpoint, count]) => [
      breakpoint,
      `repeat(${count}, minmax(0, 1fr))`,
    ]),
  );

  return (
    <Box
      component="ul"
      aria-label={label}
      sx={{
        display: 'grid',
        gridTemplateColumns: templates,
        gap: 2,
        listStyle: 'none',
        m: 0,
        p: 0,
      }}
    >
      {Children.map(children, (child) => (
        <Box component="li" sx={{ display: 'flex', minWidth: 0 }}>
          {child}
        </Box>
      ))}
    </Box>
  );
}
