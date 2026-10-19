import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode, RefObject } from 'react';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';

/** At and above this width filters are a sidebar; below it they are a full screen drawer. */
export const FILTER_PANEL_QUERY = '(min-width: 80rem)';

export interface FilterPanelProps {
  title?: string;
  children: ReactNode;
  /** Drawer state. Ignored in the sidebar layout. */
  open: boolean;
  onClose: () => void;
  /** Label for the drawer's primary action, e.g. "Show 12 results". */
  closeLabel?: string;
  /** When provided, the drawer footer offers "Clear all". */
  onClearAll?: () => void;
  /** The button that opened the drawer; focus is returned to it once the drawer closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function FilterPanel({
  title = 'Filters',
  children,
  open,
  onClose,
  closeLabel = 'Show results',
  onClearAll,
  returnFocusRef,
}: FilterPanelProps) {
  const isSidebar = useMediaQuery(FILTER_PANEL_QUERY);

  if (isSidebar) {
    return (
      <aside
        aria-label={title}
        className="sticky top-20 max-h-[calc(100vh-6rem)] w-70 shrink-0 self-start overflow-y-auto rounded-lg border border-line bg-surface px-4 py-3"
      >
        <h2 className="mb-1 text-base font-semibold">{title}</h2>
        {children}
      </aside>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (returnFocusRef?.current) {
              event.preventDefault();
              returnFocusRef.current.focus();
            }
          }}
          className="fixed inset-0 z-50 flex flex-col bg-surface"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label="Close filters" className="-mr-2">
                <X aria-hidden className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-4">{children}</div>
          <div className="flex justify-end gap-2 border-t border-line p-4">
            {onClearAll && (
              <Button variant="secondary" onClick={onClearAll}>
                Clear all
              </Button>
            )}
            <Button onClick={onClose}>{closeLabel}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
