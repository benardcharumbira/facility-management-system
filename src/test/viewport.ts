import { afterEach, vi } from 'vitest';

/**
 * jsdom has no layout, so MUI's useMediaQuery never matches. This evaluates simple
 * min-width / max-width queries against a width chosen by the test.
 */
export function setViewportWidth(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => {
    const min = /min-width:\s*([\d.]+)px/.exec(query)?.[1];
    const max = /max-width:\s*([\d.]+)px/.exec(query)?.[1];
    const matches =
      (min === undefined || width >= Number(min)) && (max === undefined || width <= Number(max));
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
