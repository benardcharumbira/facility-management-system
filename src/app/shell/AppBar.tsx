import { Landmark } from 'lucide-react';
import type { ReactNode } from 'react';

interface AppBarProps {
  leading?: ReactNode;
  trailing?: ReactNode;
}

/** The top bar shared by the signed in shell and the public sign in pages. */
export function AppBar({ leading, trailing }: AppBarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-3 bg-primary px-4 text-on-primary sm:px-6 print:hidden">
      {leading}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Landmark aria-hidden className="size-6 shrink-0" />
        <p className="truncate text-lg font-semibold tracking-tight">Facilities Booking</p>
      </div>
      {trailing}
    </header>
  );
}
