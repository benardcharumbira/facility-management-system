import { X } from 'lucide-react';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/shared/utils/cn';
import { IconButton } from '../ui/IconButton';

type Severity = 'info' | 'success' | 'error';

interface Notification {
  key: number;
  message: string;
  severity: Severity;
}

interface SnackbarApi {
  notify: (message: string, severity?: Severity) => void;
}

const SnackbarContext = createContext<SnackbarApi | null>(null);

const AUTO_HIDE_MS = 6000;

const tones: Record<Severity, string> = {
  info: 'bg-ink text-surface',
  success: 'bg-ink text-surface',
  error: 'bg-danger text-on-primary',
};

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Notification | null>(null);

  const notify = useCallback((message: string, severity: Severity = 'info') => {
    setCurrent({ key: Date.now(), message, severity });
  }, []);
  const api = useMemo(() => ({ notify }), [notify]);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setCurrent(null), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [current]);

  return (
    <SnackbarContext value={api}>
      {children}
      {/* Always mounted so a newly inserted message is announced. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden"
      >
        {current && (
          <div
            role={current.severity === 'error' ? 'alert' : undefined}
            className={cn(
              'pointer-events-auto flex max-w-md items-center gap-2 rounded-md py-2 pr-2 pl-4 shadow-overlay',
              tones[current.severity],
            )}
          >
            <p className="text-sm">{current.message}</p>
            <IconButton
              aria-label="Dismiss notification"
              onClick={() => setCurrent(null)}
              className="size-8 text-inherit hover:bg-white/15 hover:text-inherit"
            >
              <X aria-hidden className="size-4" />
            </IconButton>
          </div>
        )}
      </div>
    </SnackbarContext>
  );
}

export function useSnackbar(): SnackbarApi {
  const api = use(SnackbarContext);
  if (!api) throw new Error('useSnackbar must be used within SnackbarProvider');
  return api;
}
