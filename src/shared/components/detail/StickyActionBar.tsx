import type { ReactNode } from 'react';

/**
 * Holds a page's primary action. Pinned to the bottom of the viewport on small screens so it
 * stays reachable while scrolling; from `lg` it sits in normal flow (typically inside a sticky
 * sidebar). One element serves both, so the action is never duplicated in the page. Pages using
 * it should leave bottom padding on small screens: see `STICKY_ACTION_CLEARANCE`.
 */
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 border-t border-line bg-surface p-3 shadow-overlay lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
      {children}
    </div>
  );
}

/** Bottom padding that keeps content clear of the bar on small screens. */
export const STICKY_ACTION_CLEARANCE = 'pb-28 lg:pb-0';
