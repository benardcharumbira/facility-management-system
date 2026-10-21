import { useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router';
import { useApiClient, isApiProblem, type AdminFacility } from '@/shared/api';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DetailHeader,
  DetailSkeleton,
  ErrorState,
  NotFoundState,
  SectionedEditLayout,
  useImpactGuard,
  usePageHeader,
  useSnackbar,
  type EditSection,
} from '@/shared/components';
import { useOriginList, useUrlState } from '@/shared/hooks';
import { createParamsCodec, param } from '@/shared/utils/params-codec';
import { restoreFacility } from '../facilities/api';
import { explain } from '../facilities/errors';
import { useAdminFacility, useRefreshAfterChange } from '../facilities/hooks';
import { AdminStatusBadge } from '../facilities/status';
import { ApproversSection } from '../facilities/sections/ApproversSection';
import { BlackoutsSection } from '../facilities/sections/BlackoutsSection';
import { CapacitySection } from '../facilities/sections/CapacitySection';
import { DetailsSection } from '../facilities/sections/DetailsSection';
import { HierarchySection } from '../facilities/sections/HierarchySection';
import { ImagesSection } from '../facilities/sections/ImagesSection';
import { ScheduleSection } from '../facilities/sections/ScheduleSection';

const SECTION_IDS = [
  'details',
  'hierarchy',
  'images',
  'schedule',
  'blackouts',
  'capacity',
  'approvers',
] as const;
type SectionId = (typeof SECTION_IDS)[number];

const SECTION_LABELS: Record<SectionId, string> = {
  details: 'Details',
  hierarchy: 'Hierarchy',
  images: 'Images',
  schedule: 'Schedule',
  blackouts: 'Blackouts',
  capacity: 'Capacity',
  approvers: 'Approvers',
};

const sectionCodec = createParamsCodec<{ section: SectionId }>({
  section: param.oneOf(SECTION_IDS, 'details'),
});

/**
 * Changes to what a section shows start it afresh, so it never edits a stale copy. Images and
 * blackouts read their own data and keep their state.
 */
function freshness(section: SectionId, f: AdminFacility): string {
  switch (section) {
    case 'details':
      return JSON.stringify([
        f.name,
        f.code,
        f.type.id,
        f.locality,
        f.shortDescription,
        f.description,
        f.status,
        f.approvers.length,
      ]);
    case 'hierarchy':
      return JSON.stringify([f.parentFacility?.id, f.eligibleParents.length, f.children.length]);
    case 'schedule':
      return JSON.stringify(f.schedule);
    case 'capacity':
      return JSON.stringify([f.capacity, f.type.capacityApplies]);
    case 'approvers':
      return JSON.stringify([f.approvers.map((a) => a.id), f.status]);
    default:
      return '';
  }
}

export default function AdminFacilityEditPage() {
  const { id = '' } = useParams();
  const fromList = useOriginList();
  const facility = useAdminFacility(id);
  const listTo = `/admin/facilities${fromList}`;

  if (facility.isError) {
    const missing = isApiProblem(facility.error) && facility.error.status === 404;
    return (
      <Failed
        missing={missing}
        listTo={listTo}
        error={facility.error}
        onRetry={() => void facility.refetch()}
      />
    );
  }
  if (!facility.data) return <Loading />;
  return <Loaded facility={facility.data} listTo={listTo} />;
}

function Loading() {
  usePageHeader('Facility');
  return <DetailSkeleton />;
}

function Failed({
  missing,
  listTo,
  error,
  onRetry,
}: {
  missing: boolean;
  listTo: string;
  error: unknown;
  onRetry: () => void;
}) {
  usePageHeader(missing ? 'Facility not found' : 'Facility');
  return (
    <>
      <DetailHeader
        title={missing ? 'Facility not found' : 'Facility'}
        breadcrumbs={[
          { label: 'Manage facilities', to: listTo },
          { label: missing ? 'Not found' : 'Error' },
        ]}
      />
      {missing ? (
        <NotFoundState
          title="We could not find that facility"
          description="It may have been removed, or the link may be wrong."
          action={{ label: 'Back to facilities', to: listTo }}
        />
      ) : (
        <ErrorState title="We could not load this facility" problem={error} onRetry={onRetry} />
      )}
    </>
  );
}

function Loaded({ facility, listTo }: { facility: AdminFacility; listTo: string }) {
  usePageHeader(facility.name, [
    { label: 'Manage facilities', to: listTo },
    { label: facility.name },
  ]);
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterChange();
  const { guard, dialog } = useImpactGuard();
  const [state] = useUrlState(sectionCodec);
  const section = state.section;
  const [dirty, setDirty] = useState(false);

  // Leaving with unsaved edits is confirmed: an edit here can reach existing bookings.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  const archived = facility.status === 'archived';
  const hrefFor = (target: string) => {
    const search = sectionCodec.toSearchString({ section: target as SectionId });
    return `/admin/facilities/${encodeURIComponent(facility.id)}${search ? `?${search}` : ''}`;
  };
  const sections: EditSection[] = SECTION_IDS.map((sectionId) => ({
    id: sectionId,
    label: SECTION_LABELS[sectionId],
    flag:
      sectionId === 'approvers' && facility.approvers.length === 0 && !archived ? (
        <Badge tone="danger">None</Badge>
      ) : undefined,
  }));

  const props = { facility, guard, onDirtyChange: setDirty };
  const body = {
    details: <DetailsSection {...props} />,
    hierarchy: <HierarchySection {...props} />,
    images: <ImagesSection {...props} />,
    schedule: <ScheduleSection {...props} />,
    blackouts: <BlackoutsSection {...props} />,
    capacity: <CapacitySection {...props} />,
    approvers: <ApproversSection {...props} />,
  }[section];

  return (
    <>
      <DetailHeader
        breadcrumbs={[{ label: 'Manage facilities', to: listTo }, { label: facility.name }]}
        back={{ label: 'Back to facilities', to: listTo }}
        title={facility.name}
        status={<AdminStatusBadge status={facility.status} size="lg" />}
        subtitle={
          <>
            {facility.code} · {facility.type.name} · {facility.locality}
            {facility.parentFacility && ` · Part of ${facility.parentFacility.name}`}
            {` · ${facility.futureBookings} ${facility.futureBookings === 1 ? 'future booking' : 'future bookings'}`}
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {archived && (
            <Alert
              severity="info"
              title="This facility is archived"
              action={
                <Button
                  variant="secondary"
                  onClick={() =>
                    void restoreFacility(api, facility.id).then(
                      async () => {
                        await refresh();
                        notify(
                          `${facility.name} restored. It is unavailable until you reopen it.`,
                          'success',
                        );
                      },
                      (failure: unknown) => notify(explain(failure), 'error'),
                    )
                  }
                >
                  Restore
                </Button>
              }
            >
              It is not on the public estate and cannot be booked. Its history is kept. Restoring
              brings it back unavailable.
            </Alert>
          )}
          {!archived && facility.approvers.length === 0 && (
            <Alert severity="error" title="Nobody approves for this facility">
              Requests for it reach no one, and it cannot be active.{' '}
              <Link to={hrefFor('approvers')} className="font-medium underline underline-offset-2">
                Designate an approver
              </Link>
              .
            </Alert>
          )}
          <p>
            <Link
              to={`/admin/facilities/${encodeURIComponent(facility.id)}/resources`}
              className="text-primary underline underline-offset-2"
            >
              Manage the resources of this facility
            </Link>
          </p>
        </div>
      </DetailHeader>

      <SectionedEditLayout
        sections={sections}
        current={section}
        hrefFor={hrefFor}
        label="Facility sections"
      >
        <div key={`${section}:${freshness(section, facility)}`}>{body}</div>
      </SectionedEditLayout>

      {dialog}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        destructive
        title="Leave without saving?"
        description="You have changes that have not been saved. If you leave, they are lost."
        confirmLabel="Leave and discard"
        cancelLabel="Stay here"
        onConfirm={async () => {
          setDirty(false);
          blocker.proceed?.();
        }}
      />
    </>
  );
}
