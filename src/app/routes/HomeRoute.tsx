import { lazy } from 'react';
import { Navigate } from 'react-router';
import { useCurrentUser } from '@/shared/auth';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { homePathForRole, LANDING_ACTION } from '../access';

// The landing page is a route of its own, so a visitor downloads it and nothing of the signed in app.
const LandingPage = lazy(() => import('@/features/public/pages/LandingPage'));

/**
 * The root. Someone signed in goes on to the home of their role, as before. Someone who is not gets
 * the landing page, where they would otherwise have been sent to sign in by a role they do not have.
 */
export function HomeRoute() {
  const current = useCurrentUser();
  switch (current.status) {
    case 'loading':
      return <LoadingState />;
    case 'error':
      return (
        <ErrorState
          title="We could not load your account"
          problem={current.error}
          onRetry={current.refetch}
        />
      );
    case 'ready':
      return <Navigate to={homePathForRole(current.user.role)} replace />;
    case 'signed-out':
      return <LandingPage action={LANDING_ACTION} />;
  }
}
