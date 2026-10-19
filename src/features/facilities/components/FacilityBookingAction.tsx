import { Link } from 'react-router';
import type { FacilityDetail } from '@/shared/api';
import { Button, buttonStyles, StickyActionBar } from '@/shared/components';
import { useUrlState } from '@/shared/hooks';
import { SelectionSummary } from '../availability/SelectionSummary';
import { availabilityCodec, bookingHref, selectionOf } from '../availability/urlState';

const REASON_ID = 'booking-unavailable-reason';

/**
 * The primary action. Sticky on small screens. It carries the chosen window, if any, to the
 * booking request as UTC instants. Unavailable facilities explain why it is off.
 */
export function FacilityBookingAction({ facility }: { facility: FacilityDetail }) {
  const [url] = useUrlState(availabilityCodec);
  const className = 'h-12 w-full text-base';

  if (facility.status === 'unavailable') {
    return (
      <StickyActionBar>
        <Button disabled aria-describedby={REASON_ID} className={className}>
          Request booking
        </Button>
        <p id={REASON_ID} className="text-sm text-muted">
          {facility.name} is currently unavailable, so booking requests cannot be made for it.
        </p>
      </StickyActionBar>
    );
  }

  return (
    <StickyActionBar>
      <SelectionSummary facilityId={facility.id} facilityName={facility.name} />
      <Link to={bookingHref(facility.id, selectionOf(url))} className={buttonStyles({ className })}>
        Request booking
      </Link>
      <p className="text-xs text-muted">
        Availability is not a reservation. The time is held only when you submit your request.
      </p>
    </StickyActionBar>
  );
}
