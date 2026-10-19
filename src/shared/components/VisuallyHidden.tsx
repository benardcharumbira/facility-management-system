import Box from '@mui/material/Box';
import { visuallyHidden } from '@mui/utils';
import type { ReactNode } from 'react';

/** Text for assistive technology only. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return (
    <Box component="span" sx={visuallyHidden}>
      {children}
    </Box>
  );
}
