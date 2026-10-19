import { Link, useLocation, useParams } from 'react-router';
import type { ReactNode } from 'react';
import { isApiProblem, type FacilityDetail } from '@/shared/api';
import {
  Alert,
  buttonStyles,
  EmptyState,
  ErrorState,
  PageLayout,
  Skeleton,
} from '@/shared/components';
import { SampleDataBanner } from '../components/SampleDataBanner';
import { FacilityGallery } from '../components/FacilityGallery';
import { useFacility } from '../hooks';
import { facilityPath } from '../paths';

const LIST_PATH = '/facilities';
const LAYOUT = 'grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]';

export default function FacilityDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const facility = useFacility(id);
  // Cards pass the list's query string along so "Facilities" returns to the same results.
  const fromList =
    typeof (location.state as { fromList?: unknown } | null)?.fromList === 'string'
      ? (location.state as { fromList: string }).fromList
      : '';
  const listLink = { label: 'Facilities', to: `${LIST_PATH}${fromList}` };

  if (facility.isError) {
    const notFound = isApiProblem(facility.error) && facility.error.status === 404;
    return (
      <PageLayout
        title={notFound ? 'Facility not found' : 'Facility'}
        breadcrumbs={[listLink, { label: notFound ? 'Not found' : 'Error' }]}
      >
        {notFound ? (
          <EmptyState
            title="We could not find that facility"
            description="It may have been removed, or the link may be wrong."
            action={
              <Link to={listLink.to} className={buttonStyles({ variant: 'secondary' })}>
                Back to facilities
              </Link>
            }
          />
        ) : (
          <ErrorState
            title="We could not load this facility"
            problem={facility.error}
            onRetry={() => void facility.refetch()}
          />
        )}
      </PageLayout>
    );
  }

  if (!facility.data) {
    return (
      <PageLayout title="Facility" breadcrumbs={[listLink, { label: 'Loading' }]}>
        <DetailSkeleton />
      </PageLayout>
    );
  }

  const data = facility.data;
  return (
    <PageLayout
      title={data.name}
      description={`${data.type.name} · ${data.locality}`}
      meta={`Code ${data.code}`}
      breadcrumbs={[listLink, { label: data.name }]}
    >
      <FacilityDetailContent facility={data} />
    </PageLayout>
  );
}

function FacilityDetailContent({ facility }: { facility: FacilityDetail }) {
  const paragraphs = facility.description.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <SampleDataBanner facilities={[facility]} />
      {facility.status === 'unavailable' && (
        <Alert severity="warning">This facility is currently unavailable for booking.</Alert>
      )}
      <div className={LAYOUT}>
        <div className="flex min-w-0 flex-col gap-8">
          <FacilityGallery facility={facility} />
          <Section title="About this facility">
            <div className="flex max-w-prose flex-col gap-3 text-base leading-7">
              {paragraphs.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </div>
          </Section>
          <Section title="Amenities">
            {facility.amenities.length === 0 ? (
              <p className="text-muted">No amenities listed.</p>
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {facility.amenities.map((amenity) => (
                  <li
                    key={amenity.id}
                    className="rounded-md border border-line bg-surface px-3 py-1.5"
                  >
                    {amenity.name}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          {facility.childFacilities.length > 0 && (
            <Section title="Spaces within this facility">
              <ul
                aria-label="Spaces within this facility"
                className="m-0 list-none divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface p-0"
              >
                {facility.childFacilities.map((child) => (
                  <li key={child.id}>
                    <Link
                      to={facilityPath(child.id)}
                      className="block px-4 py-3 hover:bg-primary-soft"
                    >
                      <span className="block font-medium text-primary">{child.name}</span>
                      <span className="block text-muted">
                        {[
                          child.type.name,
                          child.capacity === null ? null : `Capacity ${child.capacity}`,
                          child.status === 'unavailable' ? 'Unavailable' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <aside
          aria-label="Key facts"
          className="self-start rounded-lg border border-line bg-surface p-5"
        >
          <h2 className="mb-4 text-base font-semibold">Key facts</h2>
          <dl className="m-0 flex flex-col gap-4">
            <Fact label="Type">{facility.type.name}</Fact>
            <Fact label="Locality">{facility.locality}</Fact>
            {facility.address && <Fact label="Address">{facility.address}</Fact>}
            <Fact label="Capacity">
              {facility.capacity === null ? 'Not specified' : `${facility.capacity} people`}
            </Fact>
            <Fact label="Status">
              {facility.status === 'active' ? 'Available to book' : 'Currently unavailable'}
            </Fact>
            {facility.parentFacility && (
              <Fact label="Part of">
                <Link
                  to={facilityPath(facility.parentFacility.id)}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {facility.parentFacility.name}
                </Link>
              </Fact>
            )}
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-subtle uppercase">{label}</dt>
      <dd className="m-0 mt-0.5 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Mirrors the loaded layout (gallery, sections, key facts) so nothing shifts on arrival. */
function DetailSkeleton() {
  return (
    <div aria-busy aria-label="Loading facility" className={LAYOUT}>
      <div className="flex flex-col gap-3">
        <Skeleton className="aspect-video w-full rounded-lg" />
        <Skeleton className="mt-4 h-7 w-2/5" />
        <Skeleton className="h-5" />
        <Skeleton className="h-5" />
        <Skeleton className="h-5 w-3/4" />
      </div>
      <div className="flex flex-col gap-4 self-start rounded-lg border border-line bg-surface p-5">
        <Skeleton className="h-6 w-1/2" />
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
    </div>
  );
}
