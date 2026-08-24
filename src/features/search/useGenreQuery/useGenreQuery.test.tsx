import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useGenreQuery } from './useGenreQuery';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';

function currentUrl() {
  return screen.getByTestId('url').textContent;
}

function writtenParams() {
  return new URLSearchParams(String(currentUrl()).split('?')[1]);
}

function goBack() {
  act(() => {
    screen.getByRole('button', { name: 'Back' }).click();
  });
}

/** Mount the hook on a given URL, with the probe watching alongside it. */
function mountOn(entries: string[] = ['/genre/Drama']) {
  return renderHook(() => useGenreQuery(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        {children}
        <LocationProbe withBack />
      </MemoryRouter>
    ),
  });
}

describe('useGenreQuery — reading the settled query', () => {
  it('reads the default query from a plain genre page', () => {
    const { result } = mountOn(['/genre/Drama']);

    expect(result.current.query).toEqual({ sort: 'recently-added' });
  });

  it('reads the search text the URL is carrying', () => {
    // This is what makes Back from a movie land on the narrowed grid: the
    // query was never in a component to lose.
    const { result } = mountOn(['/genre/Drama?q=lighthouse']);

    expect(result.current.query.search).toBe('lighthouse');
  });

  it('reads the sort the URL is carrying', () => {
    const { result } = mountOn(['/genre/Drama?sort=a-z']);

    expect(result.current.query.sort).toBe('a-z');
  });

  it('reads a link that arrives already narrowed and ordered', () => {
    const { result } = mountOn(['/genre/Drama?q=comet&sort=highest-rated']);

    expect(result.current.query).toEqual({
      sort: 'highest-rated',
      search: 'comet',
    });
  });

  it('ignores a genre and a rating copied in from a home URL', () => {
    // The path says which genre this is; neither parameter has a control on
    // this screen to show it with.
    const { result } = mountOn(['/genre/Drama?genre=Comedy&rating=8']);

    expect(result.current.query).toEqual({ sort: 'recently-added' });
  });
});

describe('useGenreQuery — writing the search text', () => {
  it('writes the term into the URL as “q”', () => {
    const { result } = mountOn(['/genre/Drama']);

    act(() => result.current.setSearch('lighthouse'));

    expect(currentUrl()).toBe('/genre/Drama?q=lighthouse');
  });

  it('reports the new query once the URL has changed', () => {
    const { result } = mountOn(['/genre/Drama']);

    act(() => result.current.setSearch('comet'));

    expect(result.current.query.search).toBe('comet');
  });

  it('leaves the sort exactly as it found it', () => {
    // Each part of the query has its own setter; neither may clobber the part
    // that belongs to the other.
    const { result } = mountOn(['/genre/Drama?sort=a-z']);

    act(() => result.current.setSearch('lighthouse'));

    expect(writtenParams().get('sort')).toBe('a-z');
    expect(writtenParams().get('q')).toBe('lighthouse');
  });

  it('removes “q” when the search is cleared, rather than writing an empty one', () => {
    // A plain genre page is a clean URL — the default state has no query
    // string to explain.
    const { result } = mountOn(['/genre/Drama?q=lighthouse']);

    act(() => result.current.setSearch(''));

    expect(currentUrl()).toBe('/genre/Drama');
  });

  it('removes only its own parameter when the search is cleared', () => {
    const { result } = mountOn(['/genre/Drama?q=lighthouse&sort=a-z']);

    act(() => result.current.setSearch(''));

    expect(currentUrl()).toBe('/genre/Drama?sort=a-z');
  });

  it('encodes a term that would otherwise break the URL', () => {
    const { result } = mountOn(['/genre/Drama']);

    act(() => result.current.setSearch('comet & season'));

    expect(result.current.query.search).toBe('comet & season');
    expect(String(currentUrl())).not.toContain('comet & season');
  });
});

describe('useGenreQuery — writing the sort order', () => {
  it('writes the chosen order into the URL as “sort”', () => {
    const { result } = mountOn(['/genre/Drama']);

    act(() => result.current.setSort('a-z'));

    expect(currentUrl()).toBe('/genre/Drama?sort=a-z');
  });

  it('reports the new order once the URL has changed', () => {
    const { result } = mountOn(['/genre/Drama']);

    act(() => result.current.setSort('highest-rated'));

    expect(result.current.query.sort).toBe('highest-rated');
  });

  it('removes “sort” at the default order, so a plain genre page is a clean URL', () => {
    // Recently-added is what the grid has always shown; it needs no parameter
    // to explain it.
    const { result } = mountOn(['/genre/Drama?sort=a-z']);

    act(() => result.current.setSort('recently-added'));

    expect(currentUrl()).toBe('/genre/Drama');
  });

  it('leaves the search text exactly as it found it', () => {
    const { result } = mountOn(['/genre/Drama?q=lighthouse']);

    act(() => result.current.setSort('year'));

    expect(writtenParams().get('q')).toBe('lighthouse');
    expect(writtenParams().get('sort')).toBe('year');
  });

  it('removes only its own parameter when the order goes back to the default', () => {
    const { result } = mountOn(['/genre/Drama?q=lighthouse&sort=a-z']);

    act(() => result.current.setSort('recently-added'));

    expect(currentUrl()).toBe('/genre/Drama?q=lighthouse');
  });

  it('replaces the order rather than stacking a second one', () => {
    const { result } = mountOn(['/genre/Drama?sort=a-z']);

    act(() => result.current.setSort('year'));

    expect(currentUrl()).toBe('/genre/Drama?sort=year');
  });
});

describe('useGenreQuery — what the writes do to history', () => {
  it('replaces rather than stacks, so one Back escapes a search of any length', () => {
    // Fourteen keystrokes must not cost fourteen presses of Back.
    const { result } = mountOn(['/', '/genre/Drama']);

    act(() => result.current.setSearch('light'));
    act(() => result.current.setSearch('lighthouse'));
    act(() => result.current.setSearch('lighthouse k'));

    goBack();

    expect(currentUrl()).toBe('/');
  });

  it('leaves nothing of the abandoned terms behind to go back through', () => {
    const { result } = mountOn(['/', '/genre/Drama']);

    act(() => result.current.setSearch('light'));
    act(() => result.current.setSearch(''));

    goBack();

    expect(currentUrl()).toBe('/');
  });

  it('costs no history when the order changes either', () => {
    const { result } = mountOn(['/', '/genre/Drama']);

    act(() => result.current.setSort('a-z'));
    act(() => result.current.setSort('year'));
    act(() => result.current.setSort('recently-added'));

    goBack();

    expect(currentUrl()).toBe('/');
  });

  it('costs no history across both controls together', () => {
    const { result } = mountOn(['/', '/genre/Drama']);

    act(() => result.current.setSort('a-z'));
    act(() => result.current.setSearch('comet'));
    act(() => result.current.setSort('year'));

    goBack();

    expect(currentUrl()).toBe('/');
  });
});
