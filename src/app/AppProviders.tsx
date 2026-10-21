import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/shared/api';
import { ConfirmProvider } from '@/shared/components/dialogs/ConfirmProvider';
import { SnackbarProvider, useSnackbar } from '@/shared/components/feedback/SnackbarProvider';

interface AppProvidersProps {
  children: ReactNode;
  /** Supply a client (tests); otherwise one is created with the standard defaults. */
  queryClient?: QueryClient;
}

export function AppProviders({ children, queryClient }: AppProvidersProps) {
  return (
    <SnackbarProvider>
      <ConfirmProvider>
        <QueryProvider queryClient={queryClient}>{children}</QueryProvider>
      </ConfirmProvider>
    </SnackbarProvider>
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
