import {
  createContext,
  lazy,
  Suspense,
  use,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const ConfirmPrompt = lazy(() => import('./ConfirmPrompt'));

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

  return (
    <ConfirmContext value={confirm}>
      {children}
      {options && (
        <Suspense fallback={null}>
          <ConfirmPrompt options={options} open={open} onSettle={settle} />
        </Suspense>
      )}
    </ConfirmContext>
  );
}

/** `const confirm = useConfirm(); if (await confirm({ title: 'Delete?' })) { ... }` */
export function useConfirm(): Confirm {
  const confirm = use(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used within ConfirmProvider');
  return confirm;
}
