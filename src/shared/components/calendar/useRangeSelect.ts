import { useCallback, useEffect, useRef, useState } from 'react';

export interface DayRange {
  /** The earlier of the two days, as an ISO date. */
  from: string;
  /** The later of the two. */
  to: string;
}

const ordered = (a: string, b: string): DayRange =>
  a <= b ? { from: a, to: b } : { from: b, to: a };

export interface RangeSelectOptions {
  /** Off, every handler does nothing and the grid behaves as it did. */
  enabled: boolean;
  /** A run of two or more days has been chosen. */
  onCommit: (range: DayRange) => void;
}

/**
 * Choosing a run of days on a month grid, by whichever means the person has:
 *
 * - **Click, then click**: the first day is the start, the second the end (either order). Moving
 *   the pointer, or the keyboard focus, over other days in between previews the run.
 * - **Drag**: press on the first day, move, release on the last. (Touch uses the two taps.)
 * - **Keyboard**: Enter on a day starts the run, the arrow keys (with or without Shift) move the
 *   focus and so extend it, Enter on the last day confirms, and Escape drops it.
 *
 * It knows nothing about availability. The caller decides what a day is and whether a run can
 * stand, and draws `range` with `DayCell`'s `range` positions.
 */
export function useRangeSelect({ enabled, onCommit }: RangeSelectOptions) {
  const [anchor, setAnchor] = useState<string | null>(null);
  const [extent, setExtent] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  // The pointer is released anywhere, so the latest values are read through refs.
  const latest = useRef({ dragging, extent, onCommit });
  useEffect(() => {
    latest.current = { dragging, extent, onCommit };
  });
  const moved = useRef(false);

  const reset = useCallback(() => {
    setAnchor(null);
    setExtent(null);
    setDragging(null);
    moved.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const release = () => {
      const { dragging: from, extent: to, onCommit: commit } = latest.current;
      if (from && moved.current && to && to !== from) {
        const range = ordered(from, to);
        setAnchor(null);
        setExtent(null);
        commit(range);
      }
      setDragging(null);
      moved.current = false;
    };
    document.addEventListener('pointerup', release);
    return () => document.removeEventListener('pointerup', release);
  }, [enabled]);

  /**
   * A click or Enter on a day. `started` when it began a run (the same day twice begins again), and
   * `committed` when it completed one; null when choosing a run is off and the click is the caller's.
   */
  const select = useCallback(
    (day: string): 'started' | 'committed' | null => {
      if (!enabled) return null;
      if (anchor === null) {
        setAnchor(day);
        setExtent(day);
        return 'started';
      }
      const range = ordered(anchor, day);
      reset();
      if (range.from === range.to) {
        // The same day twice is a run of one: start again from it.
        setAnchor(day);
        setExtent(day);
        return 'started';
      }
      onCommit(range);
      return 'committed';
    },
    [anchor, enabled, onCommit, reset],
  );

  const preview = useCallback(
    (day: string) => {
      if (!enabled) return;
      if (anchor !== null || dragging !== null) setExtent(day);
      if (dragging !== null && day !== dragging) moved.current = true;
    },
    [anchor, dragging, enabled],
  );

  const handlers = (day: string) => ({
    onPointerDown: () => {
      if (!enabled) return;
      setDragging(day);
      setExtent(day);
      moved.current = false;
    },
    onPointerEnter: () => preview(day),
    onFocus: () => {
      if (enabled && anchor !== null) setExtent(day);
    },
  });

  const start = dragging ?? anchor;
  // Switched off, nothing is being chosen, whatever was left behind.
  const range: DayRange | null =
    enabled && start !== null && extent !== null ? ordered(start, extent) : null;

  return {
    /** The run being chosen, if any. */
    range,
    /** The first day, once it has been chosen and the second has not. */
    anchor: enabled ? anchor : null,
    select,
    cancel: reset,
    handlers,
  };
}
