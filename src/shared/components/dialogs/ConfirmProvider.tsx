import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm action as destructive. */
  destructive?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((next) => {
    resolver.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setOpen(false);
  }, []);

  const api = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext value={api}>
      {children}
      <Dialog open={open} onClose={() => settle(false)} aria-labelledby="confirm-dialog-title">
        <DialogTitle id="confirm-dialog-title">{options?.title}</DialogTitle>
        {options?.message && (
          <DialogContent>
            <DialogContentText>{options.message}</DialogContentText>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => settle(false)}>{options?.cancelLabel ?? 'Cancel'}</Button>
          <Button
            onClick={() => settle(true)}
            color={options?.destructive ? 'error' : 'primary'}
            variant="contained"
          >
            {options?.confirmLabel ?? 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext>
  );
}

/** `const confirm = useConfirm(); if (await confirm({ title: 'Delete?' })) { ... }` */
export function useConfirm(): Confirm {
  const confirm = use(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used within ConfirmProvider');
  return confirm;
}
