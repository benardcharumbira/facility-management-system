import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Puts focus back where it was when a dialog that is shown by being rendered goes away. Call
 * `remember` just before opening it; when `current` becomes null, focus returns to what had it.
 * (A dialog kept mounted and closed with `open` gets this from Radix; one that is simply unmounted
 * is not reliably given it, and a keyboard user is left at the top of the page.)
 */
export function useRestoreFocus(current: unknown): { remember: () => void } {
  const opener = useRef<HTMLElement | null>(null);

  const remember = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, []);

  useLayoutEffect(() => {
    if (current === null && opener.current) {
      const target = opener.current;
      opener.current = null;
      if (target.isConnected) target.focus();
    }
  }, [current]);

  return { remember };
}
