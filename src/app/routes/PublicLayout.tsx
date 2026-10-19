import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { LoadingState } from '@/shared/components';
import { AppBar } from '../shell/AppBar';

/** Same app bar as the shell, without navigation, so sign in does not look detached. */
export function PublicLayout() {
  return (
    <div className="min-h-screen">
      <AppBar />
      <main className="flex min-w-0 justify-center px-4 pt-24 pb-10">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
