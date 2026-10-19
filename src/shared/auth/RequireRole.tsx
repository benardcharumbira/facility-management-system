import { Outlet } from 'react-router';
import { ForbiddenState } from '@/shared/components/feedback/ForbiddenState';
import { useCurrentUser } from './useCurrentUser';
import type { Role } from './roles';

interface RequireRoleProps {
  roles: readonly Role[];
}

/** Renders a forbidden page, rather than redirecting, when the user's role is not allowed. */
export function RequireRole({ roles }: RequireRoleProps) {
  const { user } = useCurrentUser();
  if (!user || !roles.includes(user.role)) return <ForbiddenState />;
  return <Outlet />;
}
