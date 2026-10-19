import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/shared/api';
import { ConfirmProvider, SnackbarProvider, useSnackbar } from '@/shared/components';
import { theme } from './theme';

interface AppProvidersProps {
  children: ReactNode;
  /** Supply a client (tests); otherwise one is created with the standard defaults. */
  queryClient?: QueryClient;
}

export function AppProviders({ children, queryClient }: AppProvidersProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterLuxon}>
        <SnackbarProvider>
          <ConfirmProvider>
            <QueryProvider queryClient={queryClient}>{children}</QueryProvider>
          </ConfirmProvider>
        </SnackbarProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

function QueryProvider({
  children,
  queryClient: provided,
}: {
  children: ReactNode;
  queryClient?: QueryClient;
}) {
  const { notify } = useSnackbar();
  const [created] = useState(() =>
    createQueryClient({ onError: (problem) => notify(problem.detail ?? problem.title, 'error') }),
  );
  return <QueryClientProvider client={provided ?? created}>{children}</QueryClientProvider>;
}
