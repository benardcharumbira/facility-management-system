import { CalendarClock } from 'lucide-react';
import { Section } from '@/shared/components';

/**
 * Reserves the region for availability so the layout is already proportioned for it. It shows no
 * dates and no grid: nothing here may imply that any time is free.
 */
export function AvailabilityPlaceholder() {
  return (
    <Section title="Availability">
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-8 text-center">
        <CalendarClock aria-hidden className="size-8 text-subtle" strokeWidth={1.5} />
        <p className="font-medium">Availability is coming soon</p>
        <p className="max-w-md text-muted">
          You will be able to see which dates are free here. Until then, you can still send a
          booking request and the venue will confirm.
        </p>
      </div>
    </Section>
  );
}
