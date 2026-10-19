import type { ReactNode } from 'react';

/** Content that appears on screen but is left out of the printed page: navigation, buttons, chrome. */
export function ScreenOnly({ children }: { children: ReactNode }) {
  return <div className="print:hidden">{children}</div>;
}

/**
 * A clean version of a record for the printed page, hidden on screen. Pair it with `ScreenOnly`
 * around the interactive page, so printing gives one tidy sheet and a PDF comes free from the browser.
 */
export function PrintOnly({ children }: { children: ReactNode }) {
  return <div className="hidden print:block">{children}</div>;
}
