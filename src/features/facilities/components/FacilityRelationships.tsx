import { Layers } from 'lucide-react';
import { Link } from 'react-router';
import type { FacilityDetail } from '@/shared/api';
import { RelatedItems, Section } from '@/shared/components';
import { facilityPath } from '../paths';
import { plural } from '../plural';

/**
 * How a venue relates to others is the central idea of this screen: some venues contain
 * separately bookable spaces, and booking the whole venue takes all of them. These pieces say
 * so in plain words in the header, the key facts and a dedicated section, in both directions.
 */

/** One line under the title, shown for a parent or a child (nothing for a standalone venue). */
export function FacilityRelationshipSummary({
  facility,
  fromList,
}: {
  facility: FacilityDetail;
  fromList: string;
}) {
  const { parentFacility, childFacilities } = facility;

  if (parentFacility) {
    return (
      <p className="flex items-center gap-2 font-medium">
        <Layers aria-hidden className="size-5 shrink-0 text-primary" />
        <span>
          Part of{' '}
          <Link
            to={facilityPath(parentFacility.id)}
            state={{ fromList }}
            className="text-primary underline underline-offset-2"
          >
            {parentFacility.name}
          </Link>
        </span>
      </p>
    );
  }
  if (childFacilities.length > 0) {
    return (
      <p className="flex items-center gap-2 font-medium">
        <Layers aria-hidden className="size-5 shrink-0 text-primary" />
        <span>Comprises {plural(childFacilities.length, 'separately bookable space')}</span>
      </p>
    );
  }
  return null;
}

/** For a parent venue: the spaces inside it, and what booking the whole venue means. */
export function FacilityChildSpaces({
  facility,
  fromList,
}: {
  facility: FacilityDetail;
  fromList: string;
}) {
  const { childFacilities, name } = facility;
  if (childFacilities.length === 0) return null;

  return (
    <Section
      title={`Spaces within ${name}`}
      description={`${name} comprises ${plural(childFacilities.length, 'separately bookable space')}. Each can be booked on its own. Booking the whole of ${name} includes all of them, so none of these spaces can be booked by anyone else for that time.`}
    >
      <RelatedItems
        label={`Spaces within ${name}`}
        items={childFacilities.map((child) => ({
          id: child.id,
          label: child.name,
          description: [child.type, child.capacity === null ? null : `Capacity ${child.capacity}`]
            .filter(Boolean)
            .join(' · '),
          to: facilityPath(child.id),
          state: { fromList },
        }))}
      />
    </Section>
  );
}

/** For a child space: the parent, the siblings, and what a whole-venue booking would do to it. */
export function FacilityParentContext({
  facility,
  fromList,
}: {
  facility: FacilityDetail;
  fromList: string;
}) {
  const { parentFacility, siblingFacilities, name } = facility;
  if (!parentFacility) return null;
  const parent = parentFacility.name;
  const total = siblingFacilities.length + 1;

  return (
    <Section
      title={`Part of ${parent}`}
      description={`${name} is one of ${plural(total, 'separately bookable space')} in ${parent}. ${
        siblingFacilities.length > 0 ? 'The other spaces can be booked independently of it. ' : ''
      }A booking of the whole of ${parent} would make ${name} unavailable for that time.`}
    >
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="mb-1 text-sm font-semibold">The whole venue</h3>
          <RelatedItems
            label="The whole venue"
            items={[
              {
                id: parentFacility.id,
                label: parent,
                description: `Booking ${parent} includes all of its spaces`,
                to: facilityPath(parentFacility.id),
                state: { fromList },
              },
            ]}
          />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">{`Other spaces in ${parent}`}</h3>
          {siblingFacilities.length === 0 ? (
            <p className="text-muted">{`There are no other spaces in ${parent}.`}</p>
          ) : (
            <RelatedItems
              label={`Other spaces in ${parent}`}
              items={siblingFacilities.map((sibling) => ({
                id: sibling.id,
                label: sibling.name,
                description: sibling.type,
                to: facilityPath(sibling.id),
                state: { fromList },
              }))}
            />
          )}
        </div>
      </div>
    </Section>
  );
}
