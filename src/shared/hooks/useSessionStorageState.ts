import { useCallback, useState } from 'react';

/** State remembered for the browser session. Falls back to memory if storage is unavailable. */
export function useSessionStorageState<T extends string>(
  key: string,
  isValid: (value: string) => value is T,
  initial: T,
): readonly [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.sessionStorage.getItem(key);
      return stored !== null && isValid(stored) ? stored : initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.sessionStorage.setItem(key, next);
      } catch {
        // Storage can be blocked; the in-memory value still applies.
      }
    },
    [key],
  );

  return [value, set];
}
