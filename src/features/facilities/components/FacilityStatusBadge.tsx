import type { FacilityStatus } from '@/shared/api';
import { Badge } from '@/shared/components';

/** Status in words, never colour alone. */
export function FacilityStatusBadge({ status }: { status: FacilityStatus }) {
  return status === 'unavailable' ? (
    <Badge tone="danger">Unavailable</Badge>
  ) : (
    <Badge tone="primary">Available to book</Badge>
  );
}
