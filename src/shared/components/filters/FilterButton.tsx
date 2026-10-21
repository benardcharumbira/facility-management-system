import { SlidersHorizontal } from 'lucide-react';
import type { Ref } from 'react';
import { useDensity } from '../backoffice/Density';
import { Button } from '../ui/Button';

export interface FilterButtonProps {
  activeCount: number;
  onClick: () => void;
  /** Show it at every width, for a screen whose filters are never a sidebar. */
  alwaysVisible?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** Opens the filter drawer. Hidden where filters are shown as a sidebar. */
export function FilterButton({ activeCount, onClick, alwaysVisible, ref }: FilterButtonProps) {
  const compact = useDensity() === 'compact';
  return (
    <Button
      ref={ref}
      variant="secondary"
      size={compact ? 'sm' : 'md'}
      aria-haspopup="dialog"
      onClick={onClick}
      className={alwaysVisible ? undefined : 'xl:hidden'}
    >
      <SlidersHorizontal aria-hidden className="size-4" />
      {activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
    </Button>
  );
}
