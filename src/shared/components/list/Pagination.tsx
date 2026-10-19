import MuiPagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import type { Paginated } from '@/shared/types/pagination';

export interface PaginationProps {
  /** The response envelope, or anything with its page fields. */
  envelope: Pick<Paginated<unknown>, 'page' | 'totalPages'>;
  onChange: (page: number) => void;
}

/** Renders nothing when everything fits on one page. */
export function Pagination({ envelope, onChange }: PaginationProps) {
  if (envelope.totalPages <= 1) return null;

  return (
    <Stack component="nav" aria-label="Pagination" sx={{ alignItems: 'center', mt: 3 }}>
      <MuiPagination
        count={envelope.totalPages}
        page={envelope.page}
        onChange={(_, page) => onChange(page)}
        showFirstButton
        showLastButton
      />
    </Stack>
  );
}
