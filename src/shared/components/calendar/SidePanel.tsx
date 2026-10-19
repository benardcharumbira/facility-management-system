import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { IconButton } from '../ui/IconButton';

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Where focus goes when the panel closes, e.g. the control that opened it. */
  returnFocus?: () => HTMLElement | null;
}

/**
 * A panel beside the content from `lg`, and a bottom sheet below it. Modal on both: focus is
 * trapped while open, Escape closes it, and focus returns to the opener.
 */
export function SidePanel({ open, onClose, title, children, returnFocus }: SidePanelProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            const target = returnFocus?.();
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-xl bg-surface shadow-overlay lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-96 lg:rounded-none"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label="Close panel" className="-mr-2">
                <X aria-hidden className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
