import type { OperatingDay } from '@/shared/api';
import { Section } from '@/shared/components';
import { groupOperatingHours } from '../operatingHours';

export function OpeningHours({ schedule }: { schedule: OperatingDay[] }) {
  const groups = groupOperatingHours(schedule);
  if (groups.length === 0) return null;

  return (
    <Section title="Opening hours">
      <dl className="m-0 max-w-md divide-y divide-line rounded-lg border border-line bg-surface">
        {groups.map((group) => (
          <div key={group.days} className="flex justify-between gap-4 px-4 py-2.5">
            <dt>{group.days}</dt>
            <dd className="m-0 text-muted tabular-nums">{group.hours}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
