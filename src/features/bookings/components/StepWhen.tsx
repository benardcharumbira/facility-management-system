import { Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FacilityDetail } from '@/shared/api';
import { Alert, buttonStyles, KeyFacts } from '@/shared/components';
import { describeWindow } from '@/shared/utils/format';
import type { SlotCheck } from '../hooks';
import { facilityLink } from '../links';
import { FacilityPicker } from './FacilityPicker';
import { HierarchyNote } from './HierarchyNote';

interface StepWhenProps {
  facilityId: string;
  startsAt: string;
  endsAt: string;
  facility: FacilityDetail | undefined;
  slot: UseQueryResult<SlotCheck>;
  zone: string | undefined;
  draft: string | undefined;
  /** The calendar, with this window already selected. */
  changeHref: string | null;
}

/** Step 1 shows what was chosen as a confirmation, and checks it is still free. */
export function StepWhen({
  facilityId,
  startsAt,
  endsAt,
  facility,
  slot,
  zone,
  draft,
  changeHref,
}: StepWhenProps) {
  if (!facilityId) return <FacilityPicker draft={draft} />;

  if (!startsAt || !endsAt) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base">
          You have chosen {facility?.name ?? 'a venue'}. Now pick a date and time on its calendar.
        </p>
        {changeHref && (
          <Link to={changeHref} className={buttonStyles({ className: 'self-start' })}>
            Choose a date and time
          </Link>
        )}
      </div>
    );
  }

  const window = zone ? describeWindow(startsAt, endsAt, zone) : null;

  return (
    <div className="flex flex-col gap-4">
      <KeyFacts
        title="Your request"
        items={[
          {
            label: 'Venue',
            value: facility ? (
              <Link
                to={facilityLink(facility.id)}
                className="text-primary underline underline-offset-2"
              >
                {facility.name}
              </Link>
            ) : (
              'Loading…'
            ),
          },
          {
            label: window?.span ? 'Dates' : 'Date',
            value: window
              ? window.span
                ? `${window.date}, ${window.length}`
                : window.date
              : 'Loading…',
          },
          { label: 'Time', value: window ? `${window.time} (${zone} time)` : 'Loading…' },
        ]}
      />

      {slot.isPending && (
        <p role="status" className="flex items-center gap-2 text-muted">
          <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
          Checking that this time is still available…
        </p>
      )}
      {slot.isError && (
        <Alert severity="error" title="We could not check availability">
          Please try again in a moment.
        </Alert>
      )}
      {slot.data && slot.data.problem === null && (
        <p role="status" className="font-medium text-primary">
          This time is still available.
        </p>
      )}
      {slot.data?.problem && (
        <Alert severity="warning" title="This time is no longer available">
          {slot.data.problem.message}
          {changeHref && (
            <>
              {' '}
              <Link to={changeHref} className="font-medium underline underline-offset-2">
                Choose another time
              </Link>
            </>
          )}
        </Alert>
      )}

      {facility && <HierarchyNote facility={facility} />}

      {changeHref && (
        <Link
          to={changeHref}
          className={buttonStyles({ variant: 'secondary', className: 'self-start' })}
        >
          Change venue or time
        </Link>
      )}
    </div>
  );
}
