import { useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router';
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
 * such as typing. Parameters outside the codec are preserved.
 */
export function useUrlState<T extends object>(
  codec: ParamsCodec<T>,
  { resetOnChange }: UrlStateOptions<T> = {},
): readonly [T, UrlStateUpdater<T>] {
  const [searchParams, setSearchParams] = useSearchParams();
  // Router state (such as where the user came from) must survive a change to the query string.
  const locationState: unknown = useLocation().state;
  const search = searchParams.toString();
  const state = useMemo(() => codec.parse(new URLSearchParams(search)), [codec, search]);

  const update = useCallback<UrlStateUpdater<T>>(
    (patch, { replace = false } = {}) => {
      setSearchParams(
        (previous) => {
          const current = codec.parse(previous);
          const next = { ...current, ...patch };
          if (resetOnChange !== undefined && !(resetOnChange in patch)) {
            const changed = codec.changedKeys(current, next);
            if (changed.some((key) => key !== resetOnChange)) {
              next[resetOnChange] = codec.defaults[resetOnChange];
            }
          }
          return codec.apply(previous, next);
        },
        { replace, state: locationState },
      );
    },
    [codec, locationState, resetOnChange, setSearchParams],
  );

  return [state, update];
}
