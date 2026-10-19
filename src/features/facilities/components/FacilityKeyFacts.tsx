import { Link } from 'react-router';
import type { FacilityDetail } from '@/shared/api';
import { Badge, KeyFacts, type KeyFact } from '@/shared/components';
import { facilityPath } from '../paths';
import { plural } from '../plural';

const HEADLINE_AMENITIES = 4;

export function FacilityKeyFacts({
  facility,
  fromList,
}: {
  facility: FacilityDetail;
  fromList: string;
}) {
  const { capacity, capacityByArrangement: arrangements } = facility;
  const amenities = facility.amenities.slice(0, HEADLINE_AMENITIES);
  const more = facility.amenities.length - amenities.length;

  const items: KeyFact[] = [
    {
      label: 'Capacity',
      value:
        capacity === null ? (
          'Not specified'
        ) : (
          <>
            <span>Up to {capacity} people</span>
            {arrangements && arrangements.length > 0 && (
              <ul
                aria-label="Capacity by seating arrangement"
                className="m-0 mt-1 list-none p-0 text-muted"
              >
                {arrangements.map((a) => (
                  <li key={a.arrangement} className="flex justify-between gap-4">
                    <span>{a.arrangement}</span>
                    <span className="tabular-nums">{a.capacity}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ),
    },
    { label: 'Type', value: facility.type.name },
    { label: 'Locality', value: facility.locality },
    { label: 'Managed by', value: facility.managedBy },
    {
      label: 'Amenities',
      value:
        amenities.length === 0 ? (
          'None listed'
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {amenities.map((a) => (
              <Badge key={a.id}>{a.name}</Badge>
            ))}
            {more > 0 && <Badge>{`+${more} more`}</Badge>}
          </span>
        ),
    },
    {
      label: 'Status',
      value: facility.status === 'active' ? 'Available to book' : 'Currently unavailable',
    },
  ];

  if (facility.parentFacility) {
    items.push({
      label: 'Part of',
      value: (
        <Link
          to={facilityPath(facility.parentFacility.id)}
          state={{ fromList }}
          className="text-primary underline-offset-2 hover:underline"
        >
          {facility.parentFacility.name}
        </Link>
      ),
    });
  }
  if (facility.childFacilities.length > 0) {
    items.push({
      label: 'Contains',
      value: plural(facility.childFacilities.length, 'separately bookable space'),
    });
  }

  return <KeyFacts items={items} />;
}
