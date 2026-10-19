import { SlidersHorizontal } from 'lucide-react';
import type { Ref } from 'react';
import { Button } from '../ui/Button';

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
      variant="secondary"
      aria-haspopup="dialog"
      onClick={onClick}
      className="xl:hidden"
    >
      <SlidersHorizontal aria-hidden className="size-4" />
      {activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
    </Button>
  );
}
