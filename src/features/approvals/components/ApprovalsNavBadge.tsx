import { VisuallyHidden } from '@/shared/components';
import { useApprovalCounts } from '../hooks';

/**
 * How many requests are waiting for the signed in approver, beside "Approvals" in the navigation.
 * Refreshed when the window regains focus, never polled. Says nothing while nothing is waiting.
 */
export function ApprovalsNavBadge() {
  const pending = useApprovalCounts().data?.pending ?? 0;
  if (pending === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
      <span aria-hidden>{pending}</span>
      <VisuallyHidden>{`, ${pending} waiting`}</VisuallyHidden>
    </span>
  );
}
