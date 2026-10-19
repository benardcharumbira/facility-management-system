import Button from '@mui/material/Button';
import { Link as RouterLink } from 'react-router';
import { EmptyState, PageLayout } from '@/shared/components';
import { PATHS } from '../access';

export default function NotFoundPage() {
  return (
    <PageLayout title="Page not found">
      <EmptyState
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Button component={RouterLink} to={PATHS.home}>
            Go home
          </Button>
        }
      />
    </PageLayout>
  );
}
