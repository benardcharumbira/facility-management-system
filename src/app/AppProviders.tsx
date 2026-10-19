import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/shared/api';
import { ConfirmProvider, SnackbarProvider, useSnackbar } from '@/shared/components';
import { theme } from './theme';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterLuxon}>
        <SnackbarProvider>
          <ConfirmProvider>
            <QueryProvider>{children}</QueryProvider>
          </ConfirmProvider>
        </SnackbarProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

function QueryProvider({ children }: { children: ReactNode }) {
  const { notify } = useSnackbar();
  const [queryClient] = useState(() =>
    createQueryClient({ onError: (problem) => notify(problem.detail ?? problem.title, 'error') }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
