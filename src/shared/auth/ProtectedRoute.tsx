import { Navigate, Outlet, useLocation } from 'react-router';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { useCurrentUser } from './useCurrentUser';

export const SIGN_IN_PATH = '/sign-in';

/** Requires a signed in user whose role has been resolved. Otherwise redirects to sign in. */
export function ProtectedRoute() {
  const current = useCurrentUser();
  const location = useLocation();

  switch (current.status) {
    case 'loading':
      return <LoadingState fullPage />;
    case 'signed-out':
      return <Navigate to={SIGN_IN_PATH} state={{ from: location }} replace />;
    case 'error':
      return (
        <ErrorState
          title="We could not load your account"
          problem={current.error}
          onRetry={current.refetch}
        />
      );
    case 'ready':
      return <Outlet />;
  }
}
