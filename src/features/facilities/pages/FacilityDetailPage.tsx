import { useParams } from 'react-router';
import { isApiProblem, type FacilityDetail } from '@/shared/api';
import { BOOKING_ROLES, useCurrentUser } from '@/shared/auth';
import {
  Alert,
  DetailHeader,
  DetailLayout,
  DetailSkeleton,
  ErrorState,
  Gallery,
  NotFoundState,
  Section,
  STICKY_ACTION_CLEARANCE,
  usePageHeader,
} from '@/shared/components';
import { AvailabilityPlaceholder } from '../components/AvailabilityPlaceholder';
import { FacilityBookingAction } from '../components/FacilityBookingAction';
import { FacilityKeyFacts } from '../components/FacilityKeyFacts';
import {
  FacilityChildSpaces,
  FacilityParentContext,
  FacilityRelationshipSummary,
} from '../components/FacilityRelationships';
import { FacilityResources } from '../components/FacilityResources';
import { FacilityStatusBadge } from '../components/FacilityStatusBadge';
import { FacilityTypeIcon } from '../components/facilityTypeIcon';
import { OpeningHours } from '../components/OpeningHours';
import { SampleDataBanner } from '../components/SampleDataBanner';
import { useFacility } from '../hooks';
import { facilityPath } from '../paths';
import { useOriginList } from '../useOriginList';

const LIST_PATH = '/facilities';

export default function FacilityDetailPage() {
  const { id = '' } = useParams();
  const facility = useFacility(id);
  const fromList = useOriginList();

  if (facility.isError) {
    return isApiProblem(facility.error) && facility.error.status === 404 ? (
      <NotFound fromList={fromList} />
    ) : (
      <Failed fromList={fromList} error={facility.error} onRetry={() => void facility.refetch()} />
    );
  }
  if (!facility.data) return <Loading />;
  return <Loaded facility={facility.data} fromList={fromList} />;
}

function Loading() {
  usePageHeader('Facility');
  return <DetailSkeleton />;
}

function NotFound({ fromList }: { fromList: string }) {
  usePageHeader('Facility not found');
  return (
    <>
      <DetailHeader
        title="Facility not found"
        breadcrumbs={[
          { label: 'Facilities', to: `${LIST_PATH}${fromList}` },
          { label: 'Not found' },
        ]}
      />
      <NotFoundState
        title="We could not find that facility"
        description="It may have been removed, or the link you followed may be out of date."
        action={{ label: 'Back to facilities', to: `${LIST_PATH}${fromList}` }}
      />
    </>
  );
}

function Failed({
  fromList,
  error,
  onRetry,
}: {
  fromList: string;
  error: unknown;
  onRetry: () => void;
}) {
  usePageHeader('Facility');
  return (
    <>
      <DetailHeader
        title="Facility"
        breadcrumbs={[{ label: 'Facilities', to: `${LIST_PATH}${fromList}` }, { label: 'Error' }]}
      />
      <ErrorState title="We could not load this facility" problem={error} onRetry={onRetry} />
    </>
  );
}

function Loaded({ facility, fromList }: { facility: FacilityDetail; fromList: string }) {
  usePageHeader(facility.name);
  const { user } = useCurrentUser();
  const canBook = user !== null && BOOKING_ROLES.includes(user.role);
  const paragraphs = facility.description.split(/\n{2,}/).filter(Boolean);
  const listTo = `${LIST_PATH}${fromList}`;

  const breadcrumbs = [
    { label: 'Facilities', to: listTo },
    ...(facility.parentFacility
      ? [
          {
            label: facility.parentFacility.name,
            to: facilityPath(facility.parentFacility.id),
            state: { fromList },
          },
        ]
      : []),
    { label: facility.name },
  ];

  return (
    <div className={canBook ? STICKY_ACTION_CLEARANCE : undefined}>
      <DetailHeader
        breadcrumbs={breadcrumbs}
        back={{ label: fromList ? 'Back to results' : 'All facilities', to: listTo }}
        title={facility.name}
        status={<FacilityStatusBadge status={facility.status} />}
        subtitle={`${facility.type.name} · ${facility.locality}`}
      >
        <FacilityRelationshipSummary facility={facility} fromList={fromList} />
      </DetailHeader>

      <SampleDataBanner facilities={[facility]} />

      {facility.status === 'unavailable' && (
        <Alert severity="warning" className="mb-6">
          {facility.name} is currently unavailable for booking.
        </Alert>
      )}

      <DetailLayout
        aside={
          <>
            <FacilityKeyFacts facility={facility} fromList={fromList} />
            {canBook && <FacilityBookingAction facility={facility} />}
          </>
        }
      >
        <Gallery
          label={`Photos of ${facility.name}`}
          images={facility.images.map((image, index) => ({
            url: image.url,
            caption: image.caption,
            alt: image.caption ?? `${facility.name}, view ${index + 1}`,
          }))}
          placeholder={
            <FacilityTypeIcon typeId={facility.type.id} className="size-16" strokeWidth={1.25} />
          }
        />

        <Section title="About this venue">
          <div className="flex max-w-prose flex-col gap-3 text-base leading-7">
            {paragraphs.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </div>
        </Section>

        {facility.bookingNotes && (
          <Alert severity="info" title="Before you request a booking">
            {facility.bookingNotes}
          </Alert>
        )}

        <FacilityResources resources={facility.resources} />
        <FacilityChildSpaces facility={facility} fromList={fromList} />
        <FacilityParentContext facility={facility} fromList={fromList} />
        <AvailabilityPlaceholder />
        <OpeningHours schedule={facility.operatingSchedule} />
      </DetailLayout>
    </div>
  );
}
