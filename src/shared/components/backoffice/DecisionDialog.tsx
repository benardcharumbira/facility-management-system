import { AlertDialog } from 'radix-ui';
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { controlStyles, FormField } from '../form/FormField';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';

export interface DecisionFailure {
  title: string;
  message: ReactNode;
  /**
   * The decision cannot be retried, for example because someone else has made it. The dialog then
   * keeps what was typed on view and offers only a way to move on.
   */
  final?: boolean;
}

export interface DecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What follows from confirming, in plain words. */
  description: ReactNode;
  tone?: 'primary' | 'danger';
  confirmLabel: string;
  /** The text field. Its value belongs to the caller, so it survives a failure and a reopen. */
  field: {
    label: string;
    hint?: ReactNode;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    requiredMessage?: string;
    rows?: number;
    maxLength?: number;
  };
  /** Where focus starts: on the confirm button (so Enter confirms), or in the field (a reason is needed). */
  initialFocus: 'confirm' | 'field';
  onConfirm: () => Promise<void>;
  describeFailure?: (error: unknown) => DecisionFailure;
  /** Called after a final failure, when the person chooses to move on. */
  onContinue?: () => void;
  continueLabel?: string;
  /** Where focus goes when the dialog closes, if not back to what opened it. Read at close time. */
  returnFocus?: () => HTMLElement | null;
}

/**
 * A decision with consequences: it says what follows, takes a note or a required reason, and
 * keeps the person's text if the decision fails. Enter confirms from anywhere but the text field;
 * Ctrl or Cmd with Enter confirms from the text field too. Escape cancels.
 */
export function DecisionDialog({
  open,
  onOpenChange,
  title,
  description,
  tone = 'primary',
  confirmLabel,
  field,
  initialFocus,
  onConfirm,
  describeFailure,
  onContinue,
  continueLabel = 'Continue',
  returnFocus,
}: DecisionDialogProps) {
  const fieldId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<DecisionFailure | null>(null);
  const [missing, setMissing] = useState(false);

  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null;
  }, [open]);

  const close = () => {
    setFailure(null);
    setMissing(false);
    onOpenChange(false);
  };

  const run = async () => {
    if (working) return;
    if (field.required && field.value.trim() === '') {
      setMissing(true);
      fieldRef.current?.focus();
      return;
    }
    setWorking(true);
    setFailure(null);
    try {
      await onConfirm();
      close();
    } catch (error) {
      setFailure(
        describeFailure?.(error) ?? {
          title: 'That did not work',
          message:
            error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        },
      );
    } finally {
      setWorking(false);
    }
  };

  const moveOn = () => {
    close();
    onContinue?.();
  };

  const settled = failure?.final === true;

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (working) return;
        if (!next) {
          if (settled) onContinue?.();
          close();
          return;
        }
        onOpenChange(next);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <AlertDialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (initialFocus === 'field' ? fieldRef : confirmRef).current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (returnFocus?.() ?? opener.current)?.focus();
          }}
          onKeyDown={(event) => {
            if (
              event.key !== 'Enter' ||
              event.shiftKey ||
              event.altKey ||
              event.nativeEvent.isComposing
            ) {
              return;
            }
            const target = event.target as HTMLElement;
            const modified = event.ctrlKey || event.metaKey;
            if (!modified && ['TEXTAREA', 'BUTTON', 'A'].includes(target.tagName)) return;
            event.preventDefault();
            if (settled) moveOn();
            else void run();
          }}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-6 shadow-overlay"
        >
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="text-base text-muted">{description}</div>
          </AlertDialog.Description>

          {failure && (
            <div role={settled ? 'alert' : undefined}>
              <Alert severity={settled ? 'warning' : 'error'} title={failure.title}>
                {failure.message}
              </Alert>
            </div>
          )}

          <FormField
            id={fieldId}
            label={field.label}
            hint={field.hint}
            required={field.required}
            error={missing && field.value.trim() === '' ? field.requiredMessage : undefined}
          >
            {(control) => (
              <textarea
                {...control}
                ref={fieldRef}
                rows={field.rows ?? 4}
                maxLength={field.maxLength}
                value={field.value}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  setMissing(false);
                }}
                className={`${controlStyles} py-2`}
              />
            )}
          </FormField>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {settled ? (
              <Button ref={confirmRef} onClick={moveOn}>
                {continueLabel}
              </Button>
            ) : (
              <>
                <AlertDialog.Cancel asChild>
                  <Button variant="secondary" disabled={working}>
                    Cancel
                  </Button>
                </AlertDialog.Cancel>
                <Button
                  ref={confirmRef}
                  variant={tone === 'danger' ? 'danger' : 'primary'}
                  onClick={() => void run()}
                  disabled={working}
                >
                  {working ? 'Working…' : confirmLabel}
                </Button>
              </>
            )}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
