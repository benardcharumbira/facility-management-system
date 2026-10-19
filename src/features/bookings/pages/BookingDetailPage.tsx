import { PageLayout } from '@/shared/components';

export default function BookingDetailPage() {
  return (
    <PageLayout
      title="Booking detail"
      breadcrumbs={[{ label: 'My bookings', to: '/bookings' }, { label: 'Booking detail' }]}
    />
  );
}
