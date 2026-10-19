import { Link, useLocation } from 'react-router';
import type { FacilitySummary } from '@/shared/api';
import { Badge, VisuallyHidden } from '@/shared/components';
import { facilityPath } from '../paths';
import { FacilityMedia } from './FacilityMedia';

/** Rows reserved in the compact row; the skeleton mirrors these. */
export const FACILITY_ROW_ROWS = ['text', 'text', 'text', 'text'] as const;

const MAX_AMENITIES_SHOWN = 3;

/** Compact row for scanning many facilities. One link, stretched over the row. */
export function FacilityListItem({ facility }: { facility: FacilitySummary }) {
  const location = useLocation();
  const unavailable = facility.status === 'unavailable';
  const names = facility.amenities.map((a) => a.name);
  const extra = names.length - MAX_AMENITIES_SHOWN;
  const amenityText =
    names.slice(0, MAX_AMENITIES_SHOWN).join(', ') + (extra > 0 ? ` +${extra} more` : '');

  return (
    <article className="relative flex w-full gap-4 rounded-lg border border-line bg-surface p-4 transition-shadow hover:shadow-md has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary">
      <FacilityMedia facility={facility} className="aspect-4/3 w-28 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="h-5 truncate text-base leading-5 font-semibold">
            <Link
              to={facilityPath(facility.id)}
              state={{ fromList: location.search }}
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
              {facility.name}
            </Link>
          </h2>
          {unavailable && <Badge tone="danger">Unavailable</Badge>}
        </div>
        <p className="h-5 truncate text-muted">
          {[
            facility.type.name,
            facility.locality,
            facility.capacity === null ? null : `Capacity ${facility.capacity}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="h-5 truncate text-muted">
          {facility.parentFacility ? `Part of ${facility.parentFacility.name}` : ''}
        </p>
        <p className="h-5 truncate text-subtle">{amenityText}</p>
        {unavailable && <VisuallyHidden>This facility is currently unavailable.</VisuallyHidden>}
      </div>
    </article>
  );
}
