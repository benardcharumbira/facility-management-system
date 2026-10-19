import type { ReactNode } from 'react';
import { vi } from 'vitest';

/** Controllable stand-in for @clerk/react, installed globally by test/setup.ts. */
export const clerkState = {
  isLoaded: true,
  isSignedIn: true,
  user: {
    id: 'user_test',
    fullName: 'Test User' as string | null,
    imageUrl: '',
    primaryEmailAddress: { emailAddress: 'test.user@example.org' },
  },
  getToken: vi.fn<() => Promise<string | null>>(async () => 'test-token'),
  signOut: vi.fn(async () => {}),
};

export function signIn() {
  clerkState.isLoaded = true;
  clerkState.isSignedIn = true;
}

export function signOutUser() {
  clerkState.isLoaded = true;
  clerkState.isSignedIn = false;
}

export function resetClerk() {
  signIn();
  clerkState.getToken.mockReset();
  clerkState.getToken.mockImplementation(async () => 'test-token');
  clerkState.signOut.mockClear();
}

export function ClerkProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  return {
    isLoaded: clerkState.isLoaded,
    isSignedIn: clerkState.isLoaded ? clerkState.isSignedIn : undefined,
    getToken: clerkState.getToken,
    signOut: clerkState.signOut,
  };
}

export function useUser() {
  const signedIn = clerkState.isLoaded && clerkState.isSignedIn;
  return {
    isLoaded: clerkState.isLoaded,
    isSignedIn: clerkState.isLoaded ? clerkState.isSignedIn : undefined,
    user: signedIn ? clerkState.user : null,
  };
}

export function SignIn() {
  return <div>Clerk SignIn</div>;
}

export function SignUp() {
  return <div>Clerk SignUp</div>;
}
