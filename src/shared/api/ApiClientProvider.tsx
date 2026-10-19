import { createContext, use, useMemo, type ReactNode } from 'react';
import { createApiClient, type ApiClient } from './client';

const ApiClientContext = createContext<ApiClient | null>(null);

interface ApiClientProviderProps {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  children: ReactNode;
}

export function ApiClientProvider({ baseUrl, getToken, children }: ApiClientProviderProps) {
  const client = useMemo(() => createApiClient({ baseUrl, getToken }), [baseUrl, getToken]);
  return <ApiClientContext value={client}>{children}</ApiClientContext>;
}

export function useApiClient(): ApiClient {
  const client = use(ApiClientContext);
  if (!client) throw new Error('useApiClient must be used within ApiClientProvider');
  return client;
}
