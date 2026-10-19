import { Link } from 'react-router';
import { buttonStyles, EmptyState, PageLayout } from '@/shared/components';
import { PATHS } from '../access';

export default function NotFoundPage() {
  return (
    <PageLayout title="Page not found">
      <EmptyState
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Link to={PATHS.home} className={buttonStyles({ variant: 'secondary' })}>
            Go home
          </Link>
        }
      />
    </PageLayout>
  );
}
