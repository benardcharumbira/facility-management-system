import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createParamsCodec, param } from '@/shared/utils/params-codec';
import { useUrlState } from './useUrlState';

interface State {
  q: string;
  tags: string[];
  min: number | undefined;
  mode: 'a' | 'b';
  page: number;
  view: 'grid' | 'list' | undefined;
}

const codec = createParamsCodec<State>({
  q: param.string(),
  tags: param.stringList(),
  min: param.int(),
  mode: param.oneOf(['a', 'b'] as const, 'a'),
  page: param.positiveInt(1),
  view: param.oneOfOptional(['grid', 'list'] as const),
});

describe('params codec', () => {
  it('restores state from a query string', () => {
    const state = codec.parse(
      new URLSearchParams('q=hall&tags=x&tags=y&min=10&mode=b&page=3&view=list'),
    );
    expect(state).toEqual({
      q: 'hall',
      tags: ['x', 'y'],
      min: 10,
      mode: 'b',
      page: 3,
      view: 'list',
    });
  });

  it('produces a query string from state, omitting defaults', () => {
    expect(
      codec.toSearchString({
        q: 'hall',
        tags: ['x', 'y'],
        min: 10,
        mode: 'b',
        page: 3,
        view: 'list',
      }),
    ).toBe('q=hall&tags=x&tags=y&min=10&mode=b&page=3&view=list');
    expect(codec.toSearchString(codec.defaults)).toBe('');
  });

  it('round trips', () => {
    const search = 'q=a+b&tags=x&min=5&page=2';
    expect(codec.toSearchString(codec.parse(new URLSearchParams(search)))).toBe(search);
  });

  it('falls back to defaults on invalid values', () => {
    expect(codec.parse(new URLSearchParams('min=abc&mode=zzz&page=0&view=tile'))).toEqual(
      codec.defaults,
    );
  });
});

function setup(initial: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => ({ url: useUrlState(codec, { resetOnChange: 'page' }), location: useLocation() }),
    { wrapper },
  );
}

describe('useUrlState', () => {
  it('reads state from the URL', () => {
    const { result } = setup('/?q=hall&page=2');
    expect(result.current.url[0]).toMatchObject({ q: 'hall', page: 2 });
  });

  it('writes updates to the URL and preserves unknown parameters', () => {
    const { result } = setup('/?mock=error');
    act(() => result.current.url[1]({ tags: ['x'] }));
    expect(result.current.location.search).toBe('?mock=error&tags=x');
  });

  it('resets the page when another key changes, but not when page itself is set', () => {
    const { result } = setup('/?page=4');
    act(() => result.current.url[1]({ q: 'hall' }));
    expect(result.current.location.search).toBe('?q=hall');
    act(() => result.current.url[1]({ page: 3 }));
    expect(result.current.location.search).toBe('?q=hall&page=3');
  });

  it('does not reset the page when nothing else actually changed', () => {
    const { result } = setup('/?page=4&q=a');
    act(() => result.current.url[1]({ q: 'a' }));
    expect(result.current.location.search).toContain('page=4');
  });
});
