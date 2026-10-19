import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

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
    <Stack
      component="ul"
      direction="row"
      aria-label="Active filters"
      sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center', listStyle: 'none', m: 0, p: 0 }}
    >
      {filters.map((filter) => (
        <li key={filter.key}>
          <Chip
            label={filter.label}
            onClick={filter.onRemove}
            onDelete={filter.onRemove}
            aria-label={`Remove filter: ${filter.label}`}
          />
        </li>
      ))}
      <li>
        <Button size="small" onClick={onClearAll}>
          Clear all
        </Button>
      </li>
    </Stack>
  );
}
