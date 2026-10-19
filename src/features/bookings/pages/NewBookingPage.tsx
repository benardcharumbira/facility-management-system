import { PageLayout } from '@/shared/components';

export default function NewBookingPage() {
  return (
    <PageLayout
      title="New booking"
      breadcrumbs={[{ label: 'My bookings', to: '/bookings' }, { label: 'New booking' }]}
    />
  );
}
