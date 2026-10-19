import { EmptyState } from './EmptyState';

export function ForbiddenState() {
  return (
    <EmptyState title="Forbidden" description="You do not have permission to view this page." />
  );
}
