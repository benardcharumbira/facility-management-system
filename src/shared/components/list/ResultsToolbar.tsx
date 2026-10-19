import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface ResultsToolbarProps {
  /** e.g. "28 facilities". Announced politely whenever it changes. Omit while there is no count yet. */
  countLabel?: string;
  /** Leading control, typically the mobile filters button. */
  leading?: ReactNode;
  sort?: ReactNode;
  viewToggle?: ReactNode;
}

export function ResultsToolbar({ countLabel, leading, sort, viewToggle }: ResultsToolbarProps) {
  return (
    <Stack
      direction="row"
      sx={{ flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
        {leading}
        {/* The live region stays mounted so changes to its text are announced. */}
        <Typography role="status" aria-live="polite" color="text.secondary">
          {countLabel}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        {sort}
        {viewToggle}
      </Stack>
    </Stack>
  );
}
