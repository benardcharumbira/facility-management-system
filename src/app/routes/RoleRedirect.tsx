import { Navigate } from 'react-router';
import { useCurrentUser } from '@/shared/auth';
import { homePathForRole } from '../access';

/** Index route: sends the signed in user to the landing page for their role. */
export function RoleRedirect() {
  const { user } = useCurrentUser();
  if (!user) return null;
  return <Navigate to={homePathForRole(user.role)} replace />;
}
