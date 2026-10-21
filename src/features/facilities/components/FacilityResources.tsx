import type { FacilityResource } from '@/shared/api';
import { Disclosure, Section } from '@/shared/components';
import { plural } from '../plural';

function ResourceList({ items, label }: { items: FacilityResource[]; label: string }) {
  return (
    <ul aria-label={label} className="m-0 grid list-none gap-x-8 gap-y-1 p-0 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="flex justify-between gap-4 border-b border-line py-1.5">
          <span>{item.name}</span>
          {item.quantified && item.quantity !== null && (
            <span className="text-muted tabular-nums">
              <span aria-hidden>×</span> {item.quantity}
              <span className="sr-only"> available</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Venue resources are decision relevant and always visible. The kitchen inventory is long and
 * itemised, so it sits behind a disclosure that starts closed.
 */
export function FacilityResources({ resources }: { resources: FacilityResource[] }) {
  const venue = resources.filter((r) => r.category === 'venue');
  const kitchen = resources.filter((r) => r.category === 'kitchen');

  return (
    <Section title="Resources">
      {resources.length === 0 ? (
        <p className="text-muted">No resources are listed for this venue.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {venue.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Venue resources</h3>
              <ResourceList items={venue} label="Venue resources" />
            </div>
          )}
          {kitchen.length > 0 && (
            <Disclosure summary={`Kitchen equipment, ${plural(kitchen.length, 'item')}`}>
              <ResourceList items={kitchen} label="Kitchen equipment" />
            </Disclosure>
          )}
        </div>
      )}
    </Section>
  );
}
