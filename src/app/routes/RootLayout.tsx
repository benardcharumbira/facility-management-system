import { ClerkProvider } from '@clerk/react';
import { Outlet, useNavigate } from 'react-router';
import { ApiClientProvider } from '@/shared/api';
import { useSessionTokenGetter } from '@/shared/auth';
import { ErrorBoundary } from '@/shared/components';
import { getEnv } from '../env';
import { PATHS } from '../access';

/**
 * Root of the route tree. Clerk lives here, rather than above the router, so it can
 * navigate through React Router instead of forcing full page loads.
 */
export function RootLayout() {
  const navigate = useNavigate();
  const env = getEnv();

  return (
    <ClerkProvider
      publishableKey={env.clerkPublishableKey}
      signInUrl={PATHS.signIn}
      signUpUrl={PATHS.signUp}
      signInFallbackRedirectUrl={PATHS.home}
      signUpFallbackRedirectUrl={PATHS.home}
      routerPush={(to) => void navigate(to)}
      routerReplace={(to) => void navigate(to, { replace: true })}
    >
      <AuthenticatedApi baseUrl={env.apiBaseUrl} />
    </ClerkProvider>
  );
}

function AuthenticatedApi({ baseUrl }: { baseUrl: string }) {
  const getToken = useSessionTokenGetter();
  return (
    <ApiClientProvider baseUrl={baseUrl} getToken={getToken}>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </ApiClientProvider>
  );
}
