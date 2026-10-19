import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import type { ApiProblem } from './problem';

const MAX_RETRIES = 2;
const STALE_TIME_MS = 30_000;
const RETRYABLE_CLIENT_STATUSES = new Set([408, 429]);

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiProblem;
  }
}

/** Retry transient failures only. A 4xx means retrying will not change the answer. */
export function shouldRetry(failureCount: number, error: ApiProblem): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (error.kind === 'aborted') return false;
  if (error.status >= 400 && error.status < 500) return RETRYABLE_CLIENT_STATUSES.has(error.status);
  return true;
}

export interface QueryClientOptions {
  /** Called for failed mutations and for failed background refetches of already loaded data. */
  onError?: (problem: ApiProblem) => void;
}

export function createQueryClient({ onError }: QueryClientOptions = {}): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Queries without data render their own error state. Only surface stale-data failures.
        if (query.state.data !== undefined) onError?.(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // A mutation whose caller presents its own failure (e.g. a form) sets `meta: { silent: true }`.
        if (mutation.meta?.silent) return;
        onError?.(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
