import { Menu, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router';
import { useCurrentUser } from '@/shared/auth';
import {
  ErrorBoundary,
  IconButton,
  LoadingState,
  PageHeaderProvider,
  ShellBreadcrumbs,
} from '@/shared/components';
import { AppBar } from './AppBar';
import { NavList } from './NavList';
import { UserMenu } from './UserMenu';

export function AppShell() {
  const { user, signOut } = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);

  // ProtectedRoute guarantees a user; this keeps the types honest.
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <AppBar
        leading={
          <IconButton
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
            className="-ml-2 text-on-primary hover:bg-white/10 hover:text-on-primary focus-visible:outline-on-primary lg:hidden"
          >
            <Menu aria-hidden className="size-6" />
          </IconButton>
        }
        trailing={<UserMenu user={user} onSignOut={() => void signOut()} />}
      />

      <aside className="fixed top-16 bottom-0 left-0 hidden w-60 overflow-y-auto border-r border-line bg-surface lg:block">
        <NavList role={user.role} />
      </aside>

      <Dialog.Root open={navOpen} onOpenChange={setNavOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto bg-surface shadow-overlay lg:hidden"
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Dialog.Title className="font-semibold">Navigation</Dialog.Title>
              <Dialog.Close asChild>
                <IconButton aria-label="Close navigation" className="-mr-2">
                  <X aria-hidden className="size-5" />
                </IconButton>
              </Dialog.Close>
            </div>
            <NavList role={user.role} onNavigate={() => setNavOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <main className="min-w-0 pt-16 lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeaderProvider>
            <ShellBreadcrumbs />
            <ErrorBoundary>
              <Suspense fallback={<LoadingState />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </PageHeaderProvider>
        </div>
      </main>
    </div>
  );
}
