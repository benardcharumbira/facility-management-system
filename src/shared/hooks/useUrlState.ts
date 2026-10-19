import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { ParamsCodec } from '@/shared/utils/params-codec';

export interface UrlStateOptions<T> {
  /**
   * A key (typically `page`) reset to its default whenever any other key changes in the
   * same update, unless that update sets it explicitly.
   */
  resetOnChange?: keyof T;
}

export interface UrlStateUpdateOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
}

export type UrlStateUpdater<T> = (patch: Partial<T>, options?: UrlStateUpdateOptions) => void;

/**
 * The URL query string is the single source of truth for a list screen's state.
 * Parses it into typed state through `codec` and writes updates back. Filter changes push
 * history entries (so Back steps through them); pass `{ replace: true }` for noisy changes
 * such as typing. Parameters outside the codec are preserved, and so is router state (such as
 * where the user came from).
 *
 * An update is applied to the URL as it is when the update is made, not as it was when the
 * caller last rendered. That matters for asynchronous callers: a save that finishes after the
 * user has moved on must not put the old URL back.
 */
export function useUrlState<T extends object>(
  codec: ParamsCodec<T>,
  { resetOnChange }: UrlStateOptions<T> = {},
): readonly [T, UrlStateUpdater<T>] {
  const location = useLocation();
  const navigate = useNavigate();
  const search = location.search;
  const state = useMemo(() => codec.parse(new URLSearchParams(search)), [codec, search]);

  // Follows the location only when it changes, so an update made a moment ago, still on its way
  // into the router, is not overwritten by a render that happens before it lands.
  const locationState: unknown = location.state;
  const latest = useRef({ search, state: locationState });
  useEffect(() => {
    latest.current = { search, state: locationState };
  }, [search, locationState]);

  const update = useCallback<UrlStateUpdater<T>>(
    (patch, { replace = false } = {}) => {
      const previous = new URLSearchParams(latest.current.search);
      const current = codec.parse(previous);
      const next = { ...current, ...patch };
      if (resetOnChange !== undefined && !(resetOnChange in patch)) {
        const changed = codec.changedKeys(current, next);
        if (changed.some((key) => key !== resetOnChange)) {
          next[resetOnChange] = codec.defaults[resetOnChange];
        }
      }
      const written = codec.apply(previous, next).toString();
      const nextSearch = written ? `?${written}` : '';
      // Two updates in one tick must build on each other, not on the last render.
      latest.current = { ...latest.current, search: nextSearch };
      void navigate({ search: nextSearch }, { replace, state: latest.current.state });
    },
    [codec, navigate, resetOnChange],
  );

  return [state, update];
}
