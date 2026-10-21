import { AlertDialog } from 'radix-ui';
import { Button } from '../ui/Button';
import type { ConfirmOptions } from './ConfirmProvider';

/**
 * The dialog behind `useConfirm`. It is loaded the first time something asks for a confirmation,
 * so the dialog library is not part of what a visitor downloads before any page needs it.
 */
export default function ConfirmPrompt({
  options,
  open,
  onSettle,
}: {
  options: ConfirmOptions;
  open: boolean;
  onSettle: (confirmed: boolean) => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !next && onSettle(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-overlay">
          <AlertDialog.Title className="text-lg font-semibold">{options.title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-2 text-muted">{options.message}</div>
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">{options.cancelLabel ?? 'Cancel'}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={options.destructive ? 'danger' : 'primary'}
                onClick={() => onSettle(true)}
              >
                {options.confirmLabel ?? 'Confirm'}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
