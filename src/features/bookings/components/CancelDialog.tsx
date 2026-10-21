import { useState } from 'react';
import type { Booking } from '@/shared/api';
import { ConfirmDialog, controlStyles, FormField } from '@/shared/components';
import { describeWindow } from '@/shared/utils/format';

/**
 * Cancelling a request and cancelling a confirmed booking are different acts, and the words say
 * so. The reason is optional (to confirm with the client whether it should be required).
 */
export function CancelDialog({
  booking,
  open,
  onOpenChange,
  onConfirm,
}: {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const window = describeWindow(booking.startsAt, booking.endsAt, booking.facility.timeZone);
  const approved = booking.status === 'approved';

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      destructive
      title={approved ? 'Cancel this confirmed booking?' : 'Cancel this request?'}
      confirmLabel={approved ? 'Cancel booking' : 'Cancel request'}
      cancelLabel={approved ? 'Keep my booking' : 'Keep my request'}
      description={
        approved ? (
          <>
            <p>
              {booking.facility.name} is confirmed for you on {window.text}. If you cancel, your
              booking ends and the venue is released to other people straight away.
            </p>
            <p className="mt-2 font-medium text-ink">
              This cannot be undone. To book again you would have to submit a new request, which may
              not be approved.
            </p>
            {booking.rescheduleRequest && (
              <p className="mt-2">Your open request to change the date will be withdrawn too.</p>
            )}
          </>
        ) : (
          <>
            <p>
              The municipality will stop reviewing your request for {booking.facility.name} on{' '}
              {window.date}, and the time being held for you will be released.
            </p>
            <p className="mt-2 font-medium text-ink">
              This cannot be undone. You can send a new request later, but the time may no longer be
              free.
            </p>
          </>
        )
      }
      onConfirm={() => onConfirm(reason)}
    >
      <FormField
        id="cancel-reason"
        label="Reason (optional)"
        hint="Tell us why, if you would like to."
      >
        {(control) => (
          <textarea
            {...control}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={`${controlStyles} py-2`}
          />
        )}
      </FormField>
    </ConfirmDialog>
  );
}
