import { AlertDialog } from 'radix-ui';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, in plain words. */
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Extra fields, such as an optional reason. */
  children?: ReactNode;
  /**
   * Does the work. While it runs the dialog shows progress and cannot be dismissed. If it throws,
   * the message is shown in the dialog and the dialog stays open; if it resolves, the dialog closes.
   */
  onConfirm: () => Promise<void>;
}

/**
 * A controlled confirmation with room for fields and for a failure. Focus is trapped while open,
 * Escape closes it (unless working), and focus returns to whatever opened it.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Go back',
  destructive = false,
  children,
  onConfirm,
}: ConfirmDialogProps) {
  const [working, setWorking] = useState(false);
  // The control that opened the dialog, captured before focus moves into it, so it can be restored.
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null;
  }, [open]);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setWorking(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (working) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <AlertDialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-6 shadow-overlay"
        >
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="text-base text-muted">{description}</div>
          </AlertDialog.Description>
          {children}
          {error && (
            <Alert severity="error" title="That did not work">
              {error}
            </Alert>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={working}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              onClick={() => void run()}
              disabled={working}
            >
              {working ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
