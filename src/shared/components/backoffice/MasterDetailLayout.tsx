import type { ReactNode } from 'react';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

/** From this width the list and the selected item sit side by side. Below it, one at a time. */
export const SPLIT_VIEW_QUERY = '(min-width: 48rem)';

export function useSplitView(): boolean {
  return useMediaQuery(SPLIT_VIEW_QUERY);
}

export interface MasterDetailLayoutProps {
  master: ReactNode;
  detail: ReactNode;
  /** Whether something is selected. On a narrow screen this decides which of the two is shown. */
  hasSelection: boolean;
  masterLabel: string;
  detailLabel: string;
}

/**
 * A list beside the selected item, so a repeat user works down the list without a round trip
 * through navigation for each one. Each side scrolls on its own. On a narrow screen it becomes a
 * single column: the list, or the selected item full screen when there is one.
 */
export function MasterDetailLayout({
  master,
  detail,
  hasSelection,
  masterLabel,
  detailLabel,
}: MasterDetailLayoutProps) {
  const split = useSplitView();

  if (!split) {
    return hasSelection ? (
      <section aria-label={detailLabel}>{detail}</section>
    ) : (
      <section aria-label={masterLabel}>{master}</section>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
      <section
        aria-label={masterLabel}
        className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-line bg-surface p-2"
      >
        {master}
      </section>
      <section
        aria-label={detailLabel}
        className="sticky top-20 max-h-[calc(100vh-6rem)] min-w-0 overflow-y-auto rounded-lg border border-line bg-surface"
      >
        {detail}
      </section>
    </div>
  );
}
