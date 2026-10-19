import { CornerDownRight, Users } from 'lucide-react';
import { useId } from 'react';
import { Link, useLocation } from 'react-router';
import type { FacilitySummary } from '@/shared/api';
import { Badge, VisuallyHidden } from '@/shared/components';
import { facilityPath } from '../paths';
import { FacilityMedia } from './FacilityMedia';

const MAX_AMENITY_CHIPS = 3;

/** Rows reserved in the card, in the order they appear; the skeleton mirrors these. */
export const FACILITY_CARD_ROWS = ['text', 'title', 'text', 'text', 'chips'] as const;

/**
 * The whole card is one link: the title's anchor stretches over the card, so no interactive
 * control is nested inside another. The card shows the focus ring when that anchor has it.
 */
export function FacilityCard({ facility }: { facility: FacilitySummary }) {
  const location = useLocation();
  const titleId = useId();
  const detailsId = useId();
  const unavailable = facility.status === 'unavailable';
  const shown = facility.amenities.slice(0, MAX_AMENITY_CHIPS);
  const overflow = facility.amenities.length - shown.length;

  return (
    <article className="relative flex w-full flex-col overflow-hidden rounded-lg border border-line bg-surface transition-shadow hover:shadow-md has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary">
      <div className="relative">
        <FacilityMedia facility={facility} className="aspect-video" />
        {unavailable && (
          <Badge tone="danger" className="absolute top-2 left-2 bg-surface">
            Unavailable
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="h-5 truncate text-xs leading-5 font-semibold tracking-wide text-primary uppercase">
          {facility.type.name} · {facility.locality}
        </p>
        <h2 id={titleId} className="line-clamp-2 min-h-12 text-base leading-6 font-semibold">
          <Link
            to={facilityPath(facility.id)}
            state={{ fromList: location.search }}
            aria-describedby={detailsId}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {facility.name}
          </Link>
        </h2>
        <div id={detailsId} className="contents">
          <p className="flex h-5 items-center gap-1.5 text-muted">
            {facility.capacity !== null && (
              <>
                <Users aria-hidden className="size-4 shrink-0" />
                Capacity {facility.capacity}
              </>
            )}
          </p>
          <p className="flex h-5 items-center gap-1.5 text-muted">
            {facility.parentFacility && (
              <>
                <CornerDownRight aria-hidden className="size-4 shrink-0" />
                <span className="truncate">Part of {facility.parentFacility.name}</span>
              </>
            )}
          </p>
          <div className="mt-2 flex h-6 gap-1.5 overflow-hidden">
            {shown.map((amenity) => (
              <Badge key={amenity.id}>{amenity.name}</Badge>
            ))}
            {overflow > 0 && <Badge>+{overflow}</Badge>}
          </div>
          {unavailable && <VisuallyHidden>This facility is currently unavailable.</VisuallyHidden>}
          {overflow > 0 && (
            <VisuallyHidden>
              {`Also has ${overflow} more ${overflow === 1 ? 'amenity' : 'amenities'}.`}
            </VisuallyHidden>
          )}
        </div>
      </div>
    </article>
  );
}
