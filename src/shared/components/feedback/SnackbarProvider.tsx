import Alert, { type AlertColor } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

interface Notification {
  key: number;
  message: string;
  severity: AlertColor;
}

interface SnackbarApi {
  notify: (message: string, severity?: AlertColor) => void;
}

const SnackbarContext = createContext<SnackbarApi | null>(null);

const AUTO_HIDE_MS = 6000;

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Notification | null>(null);
  const [open, setOpen] = useState(false);

  const notify = useCallback((message: string, severity: AlertColor = 'info') => {
    setCurrent({ key: Date.now(), message, severity });
    setOpen(true);
  }, []);
  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <SnackbarContext value={api}>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={AUTO_HIDE_MS}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setOpen(false);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={current?.severity} variant="filled" onClose={() => setOpen(false)}>
          {current?.message}
        </Alert>
      </Snackbar>
    </SnackbarContext>
  );
}

export function useSnackbar(): SnackbarApi {
  const api = use(SnackbarContext);
  if (!api) throw new Error('useSnackbar must be used within SnackbarProvider');
  return api;
}
