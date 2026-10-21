import { lazy, Suspense } from 'react';
import { Link, Outlet } from 'react-router';
import { useCurrentUser } from '@/shared/auth';
import { Footer } from '@/shared/components/Footer';
import { ErrorBoundary } from '@/shared/components/feedback/ErrorBoundary';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { PATHS } from '../access';
import { AppBar } from '../shell/AppBar';

// Only someone signed in needs the account menu, so it is not part of what a visitor downloads.
const UserMenu = lazy(() => import('../shell/UserMenu').then((m) => ({ default: m.UserMenu })));

const barLink = 'rounded-md px-3 py-2 text-sm font-medium hover:bg-white/10';

/** What the bar offers: to sign in or register, or to carry on into the service. */
function SiteAccount() {
  const current = useCurrentUser();
  if (current.status === 'signed-out') {
    return (
      <nav aria-label="Account" className="flex items-center gap-1">
        <Link to={PATHS.signIn} className={barLink}>
          Sign in
        </Link>
        <Link to={PATHS.signUp} className={`${barLink} border border-on-primary/70`}>
          Register
        </Link>
      </nav>
    );
  }
  if (current.status === 'ready') {
    return (
      <div className="flex items-center gap-1">
        <Link to={PATHS.home} className={barLink}>
          Open the service
        </Link>
        <Suspense fallback={null}>
          <UserMenu user={current.user} onSignOut={() => void current.signOut()} />
        </Suspense>
      </div>
    );
  }
  return null;
}

/**
 * The frame of the pages anyone can read: the landing page, the terms, the privacy notice and the
 * rest. The same bar as the app, an account area in place of the navigation, and the footer.
 */
export function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppBar trailing={<SiteAccount />} />
      <main className="min-w-0 flex-1 pt-16 print:pt-0">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 print:max-w-none print:p-0">
          <ErrorBoundary>
            <Suspense fallback={<LoadingState />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <Footer />
    </div>
  );
}
