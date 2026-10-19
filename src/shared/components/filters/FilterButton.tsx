import FilterListIcon from '@mui/icons-material/FilterList';
import Button from '@mui/material/Button';
import type { Ref } from 'react';
import { FILTER_PANEL_BREAKPOINT } from './FilterPanel';

export interface FilterButtonProps {
  activeCount: number;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/** Opens the filter drawer. Hidden where filters are shown as a sidebar. */
export function FilterButton({ activeCount, onClick, ref }: FilterButtonProps) {
  return (
    <Button
      ref={ref}
      variant="outlined"
      startIcon={<FilterListIcon />}
      aria-haspopup="dialog"
      onClick={onClick}
      sx={{ display: { xs: 'inline-flex', [FILTER_PANEL_BREAKPOINT]: 'none' } }}
    >
      {activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
    </Button>
  );
}
