import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { ImpactedBooking, ImpactResult } from '@/shared/api';
import { ImpactDialog } from './ImpactDialog';

export interface GuardRequest {
  /** Asks the server what the change would reach. Decides nothing. */
  check: () => Promise<ImpactResult>;
  /** Makes the change. Called at once if nothing is affected, otherwise only after confirmation. */
  apply: () => Promise<void>;
  title: string;
  summary: ReactNode;
  confirmLabel: string;
  describeReason?: (item: ImpactedBooking) => string;
  /**
   * Whether to ask. By default only when a booking is affected. A change that loses something that
   * is not a booking, like discarded allocations, asks regardless.
   */
  requiresConfirmation?: (impact: ImpactResult) => boolean;
  /** What else is lost, shown above the bookings. */
  details?: (impact: ImpactResult) => ReactNode;
}

export type GuardOutcome = 'applied' | 'cancelled';

interface Pending {
  request: GuardRequest;
  impact: ImpactResult;
  settle: (outcome: GuardOutcome) => void;
}

/**
 * The impact check pattern, once. `guard` runs a change in two steps: check what it reaches, and
 * if that is nothing make it straight away (a warning on every harmless edit teaches people not to
 * read warnings); otherwise show what it reaches and make it only on explicit confirmation.
 * Render `dialog` once on the screen. A failure of either step is thrown to the caller.
 */
export function useImpactGuard(): {
  guard: (request: GuardRequest) => Promise<GuardOutcome>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);
  const [open, setOpen] = useState(false);
  const applied = useRef(false);

  const guard = useCallback(async (request: GuardRequest): Promise<GuardOutcome> => {
    const impact = await request.check();
    if (!(request.requiresConfirmation?.(impact) ?? impact.totalAffected > 0)) {
      await request.apply();
      return 'applied';
    }
    applied.current = false;
    return new Promise<GuardOutcome>((settle) => {
      setPending({ request, impact, settle });
      setOpen(true);
    });
  }, []);

  const dialog = pending && (
    <ImpactDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Closing without having confirmed is a cancel.
        if (!next && !applied.current) pending.settle('cancelled');
      }}
      title={pending.request.title}
      summary={pending.request.summary}
      impact={pending.impact}
      confirmLabel={pending.request.confirmLabel}
      describeReason={pending.request.describeReason}
      details={pending.request.details?.(pending.impact)}
      onConfirm={async () => {
        await pending.request.apply();
        applied.current = true;
        pending.settle('applied');
      }}
    />
  );

  return { guard, dialog };
}
