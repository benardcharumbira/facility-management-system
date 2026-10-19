import { useAuth } from '@clerk/react';
import { useCallback, useEffect, useRef } from 'react';

/** A stable token getter for the API client, always reading the latest Clerk session. */
export function useSessionTokenGetter(): () => Promise<string | null> {
  const { getToken } = useAuth();
  const ref = useRef(getToken);
  useEffect(() => {
    ref.current = getToken;
  }, [getToken]);
  return useCallback(() => ref.current(), []);
}
