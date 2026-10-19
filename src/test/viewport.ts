import { afterEach, vi } from 'vitest';

/**
 * jsdom has no layout, so matchMedia-based hooks never match. This evaluates simple
 * min-width / max-width queries against a width chosen by the test.
 */
export function setViewportWidth(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => {
    const toPx = (match: RegExpExecArray | null) =>
      match ? Number(match[1]) * (match[2] === 'rem' ? 16 : 1) : undefined;
    const min = toPx(/min-width:\s*([\d.]+)(px|rem)/.exec(query));
    const max = toPx(/max-width:\s*([\d.]+)(px|rem)/.exec(query));
    const matches = (min === undefined || width >= min) && (max === undefined || width <= max);
    return {
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    };
  });
}

export const DESKTOP_WIDTH = 1400;
export const MOBILE_WIDTH = 360;

afterEach(() => {
  vi.unstubAllGlobals();
});
