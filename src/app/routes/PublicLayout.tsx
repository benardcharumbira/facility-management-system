import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { Footer } from '@/shared/components/Footer';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { AppBar } from '../shell/AppBar';

/** Same app bar as the shell, without navigation, so sign in does not look detached. */
export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppBar />
      <main className="flex min-w-0 flex-1 justify-center px-4 pt-24 pb-10">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
