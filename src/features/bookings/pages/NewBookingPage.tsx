import { useState } from 'react';
import { Navigate } from 'react-router';
import { isApiProblem } from '@/shared/api';
import { ErrorState, LoadingState, NotFoundState, PageLayout } from '@/shared/components';
import { useUrlState } from '@/shared/hooks';
import { BookingForm } from '../components/BookingForm';
import { useBooking, useBookingOptions } from '../hooks';
import { bookingLink } from '../links';
import { bookingCodec } from '../urlState';

const CRUMBS = [{ label: 'My bookings', to: '/bookings' }, { label: 'New booking' }];

export default function NewBookingPage() {
  const [url, update] = useUrlState(bookingCodec);
  // The draft a visit starts with. A draft created while filling the form is not reloaded.
  const [initialDraftId] = useState(url.draft);
  const options = useBookingOptions();
  const draft = useBooking(initialDraftId);

  const title = 'Request a booking';

  if (options.isError) {
    return (
      <PageLayout title={title} breadcrumbs={CRUMBS}>
        <ErrorState problem={options.error} onRetry={() => void options.refetch()} />
      </PageLayout>
    );
  }
  if (draft.isError) {
    const missing = isApiProblem(draft.error) && draft.error.status === 404;
    return (
      <PageLayout title={title} breadcrumbs={CRUMBS}>
        {missing ? (
          <NotFoundState
            title="We could not find that draft"
            description="It may have been submitted or removed, or the link may be out of date."
            action={{ label: 'Browse venues', to: '/facilities' }}
          />
        ) : (
          <ErrorState problem={draft.error} onRetry={() => void draft.refetch()} />
        )}
      </PageLayout>
    );
  }
  if (draft.data && draft.data.status !== 'draft') {
    // A request that has been sent is looked at, not edited.
    return <Navigate to={bookingLink(draft.data.id)} replace />;
  }
  if (!options.data || (initialDraftId && !draft.data)) {
    return (
      <PageLayout title={title} breadcrumbs={CRUMBS}>
        <LoadingState />
      </PageLayout>
    );
  }

  return (
    <PageLayout title={title} breadcrumbs={CRUMBS}>
      <BookingForm
        options={options.data}
        initialBooking={draft.data ?? null}
        url={url}
        update={update}
      />
    </PageLayout>
  );
}
