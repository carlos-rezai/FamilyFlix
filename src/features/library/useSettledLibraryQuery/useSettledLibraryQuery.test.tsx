import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';

import { useSettledLibraryQuery } from './useSettledLibraryQuery';

/**
 * 63, Row view, the closing round (issue #616): the one reading of the URL the
 * four **Library tab** bodies share. The string is the **Load key**, so what
 * matters is what moves it and what does not.
 */
function renderAt(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      const [, setSearchParams] = useSearchParams();
      return { ...useSettledLibraryQuery(), setSearchParams };
    },
    { wrapper }
  );
}

describe('useSettledLibraryQuery', () => {
  it('answers the settled query and its canonical string', () => {
    const { result } = renderAt('/?q=die&sort=a-z&genre=Action');

    expect(result.current.query).toEqual({
      search: 'die',
      sort: 'a-z',
      genre: 'Action',
    });
    expect(
      Object.fromEntries(new URLSearchParams(result.current.settled))
    ).toEqual({ q: 'die', sort: 'a-z', genre: 'Action' });
  });

  it.each([
    ['a stale sort', '/?sort=nonsense'],
    ['an empty genre', '/?genre='],
    ['an empty search', '/?q='],
    ['the default sort spelled out', '/?sort=recently-added'],
    ['a parameter no body reads', '/?scroll=400'],
  ])('reads %s as no query at all', (_, url) => {
    const { result } = renderAt(url);

    expect(result.current.settled).toBe('');
  });

  it('keeps the query one identity while the string holds', () => {
    const { result } = renderAt('/?sort=a-z');
    const first = result.current.query;

    act(() => result.current.setSearchParams({ sort: 'a-z', tab: 'movies' }));
    expect(result.current.query).toBe(first);

    act(() => result.current.setSearchParams({ sort: 'year' }));
    expect(result.current.query).not.toBe(first);
    expect(result.current.query.sort).toBe('year');
  });
});
