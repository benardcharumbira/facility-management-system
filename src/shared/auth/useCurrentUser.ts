import { useAuth, useClerk, useUser } from '@clerk/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApiClient, type ApiProblem } from '@/shared/api';
import { fetchMe, meKeys } from './me';
import type { Role } from './roles';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
  /** Whether Clerk has verified the primary email address. */
  emailVerified: boolean;
  role: Role;
}

export type CurrentUserState =
  | { status: 'loading'; user: null; signOut: () => Promise<void> }
  | { status: 'signed-out'; user: null; signOut: () => Promise<void> }
  | {
      status: 'error';
      user: null;
      error: ApiProblem;
      refetch: () => void;
      signOut: () => Promise<void>;
    }
  | {
      status: 'ready';
      user: CurrentUser;
      signOut: () => Promise<void>;
      /** Opens Clerk's own screens for changing name, email address, password and sessions. */
      manageAccount: () => void;
    };

/**
 * The one place the app learns who is signed in. Identity comes from Clerk, the role
 * comes from the backend's GET /me. Nothing else in the app reads Clerk directly.
 */
export function useCurrentUser(): CurrentUserState {
  const { isLoaded, isSignedIn, signOut: clerkSignOut } = useAuth();
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const api = useApiClient();
  const queryClient = useQueryClient();

  const signedIn = isLoaded && isSignedIn === true && clerkUser != null;
  const me = useQuery({
    queryKey: meKeys.detail(clerkUser?.id ?? ''),
    queryFn: ({ signal }) => fetchMe(api, signal),
    enabled: signedIn,
  });

  const signOut = useCallback(async () => {
    await clerkSignOut();
    queryClient.clear();
  }, [clerkSignOut, queryClient]);

  if (!isLoaded) return { status: 'loading', user: null, signOut };
  if (!signedIn) return { status: 'signed-out', user: null, signOut };
  if (me.isError) {
    return {
      status: 'error',
      user: null,
      error: me.error,
      refetch: () => void me.refetch(),
      signOut,
    };
  }
  if (!me.data) return { status: 'loading', user: null, signOut };

  return {
    status: 'ready',
    signOut,
    manageAccount: () => clerk.openUserProfile(),
    user: {
      id: me.data.id,
      name: clerkUser.fullName ?? me.data.displayName,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? me.data.email,
      imageUrl: clerkUser.imageUrl || null,
      emailVerified: clerkUser.primaryEmailAddress?.verification?.status === 'verified',
      role: me.data.role,
    },
  };
}
