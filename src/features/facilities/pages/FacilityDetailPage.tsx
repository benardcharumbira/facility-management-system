import { useParams } from 'react-router';
import { ErrorState, LoadingState, PageLayout } from '@/shared/components';
import { useFacility } from '../hooks';

/** Placeholder: the detail screen is a later slice. Shows only the facility name. */
export default function FacilityDetailPage() {
  const { id = '' } = useParams();
  const facility = useFacility(id);
  const name = facility.data?.name ?? 'Facility';

  return (
    <PageLayout
      title={name}
      breadcrumbs={[{ label: 'Facilities', to: '/facilities' }, { label: name }]}
    >
      {facility.isPending && <LoadingState />}
      {facility.isError && (
        <ErrorState
          title="We could not load this facility"
          problem={facility.error}
          onRetry={() => void facility.refetch()}
        />
      )}
    </PageLayout>
  );
}
