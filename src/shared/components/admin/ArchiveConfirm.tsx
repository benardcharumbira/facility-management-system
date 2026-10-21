import type { ImpactResult } from '@/shared/api';
import { ConfirmDialog } from '../dialogs/ConfirmDialog';
import { ImpactList } from './ImpactDialog';

export interface ArchiveConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityName: string;
  /** What archiving reaches. Null while it is being worked out. */
  impact: ImpactResult | null;
  onConfirm: () => Promise<void>;
}

/**
 * Archiving is asked for by name even when it reaches nothing, because the click itself is the
 * decision, not an edit. It says what archiving does and, where there are any, names the bookings.
 */
export function ArchiveConfirm({
  open,
  onOpenChange,
  facilityName,
  impact,
  onConfirm,
}: ArchiveConfirmProps) {
  const count = impact?.totalAffected ?? 0;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      destructive
      title={`Archive ${facilityName}?`}
      description={
        <div className="flex flex-col gap-2">
          <p>
            {facilityName} will leave the public estate and cannot be chosen for new bookings. Its
            history and its bookings are kept, and you can restore it later.
          </p>
          {count > 0 && (
            <p className="font-medium text-ink">
              {count === 1 ? '1 booking is affected:' : `${count} bookings are affected:`}
            </p>
          )}
        </div>
      }
      confirmLabel="Archive"
      cancelLabel="Keep it"
      onConfirm={onConfirm}
    >
      {impact && count > 0 && (
        <>
          <ImpactList impact={impact} />
          <p className="text-sm text-muted">
            Archiving does not cancel or move these bookings, and nobody is notified. What happens
            to each one is a separate decision for you to make.
          </p>
        </>
      )}
      {impact && count === 0 && (
        <p className="text-sm text-muted">No upcoming bookings are affected.</p>
      )}
    </ConfirmDialog>
  );
}
