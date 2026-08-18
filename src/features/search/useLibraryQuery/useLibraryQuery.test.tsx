import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

import { useLibraryQuery } from './useLibraryQuery';

/**
 * Reports the URL the router is currently at, and offers the browser Back
 * button as something a test can press — the two things every claim here is
 * about.
 */
function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="url">{`${location.pathname}${location.search}`}</div>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </>
  );
}

function currentUrl() {
  return screen.getByTestId('url').textContent;
}

function goBack() {
  act(() => {
    screen.getByRole('button', { name: 'Back' }).click();
  });
}

/** Mount the hook on a given URL, with the probe watching alongside it. */
function mountOn(entries: string[] = ['/']) {
  return renderHook(() => useLibraryQuery(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        {children}
        <LocationProbe />
      </MemoryRouter>
    ),
  });
}

describe('useLibraryQuery — reading the settled query', () => {
  it('reads the default query from a clean “/”', () => {
    const { result } = mountOn(['/']);

    expect(result.current.query).toEqual({ sort: 'recently-added' });
  });

  it('reads the search text the URL is carrying', () => {
    // This is what makes Back from a movie land on the filtered view: the
    // query was never in a component to lose.
    const { result } = mountOn(['/?q=lighthouse']);

    expect(result.current.query.search).toBe('lighthouse');
  });

  it('reports the new query once the URL has changed', () => {
    const { result } = mountOn(['/']);

    act(() => result.current.setSearch('comet'));

    expect(result.current.query.search).toBe('comet');
  });
});

describe('useLibraryQuery — writing the search text', () => {
  it('writes the term into the URL as “q”', () => {
    const { result } = mountOn(['/']);

    act(() => result.current.setSearch('lighthouse'));

    expect(currentUrl()).toBe('/?q=lighthouse');
  });

  it('leaves the other parameters in the URL exactly as it found them', () => {
    // Each part of the query has its own setter; none of them may clobber the
    // parts of the URL that belong to the others.
    const { result } = mountOn(['/?sort=a-z']);

    act(() => result.current.setSearch('lighthouse'));

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('sort')).toBe('a-z');
    expect(written.get('q')).toBe('lighthouse');
  });

  it('removes “q” when the search is cleared, rather than writing an empty one', () => {
    // An unfiltered home is a clean “/” — the default state has no query
    // string to explain.
    const { result } = mountOn(['/?q=lighthouse']);

    act(() => result.current.setSearch(''));

    expect(currentUrl()).toBe('/');
  });

  it('removes only its own parameter when the search is cleared', () => {
    const { result } = mountOn(['/?q=lighthouse&sort=a-z']);

    act(() => result.current.setSearch(''));

    expect(currentUrl()).toBe('/?sort=a-z');
  });

  it('encodes a term that would otherwise break the URL', () => {
    const { result } = mountOn(['/']);

    act(() => result.current.setSearch('comet & season'));

    expect(result.current.query.search).toBe('comet & season');
    expect(String(currentUrl())).not.toContain('comet & season');
  });
});

describe('useLibraryQuery — what the writes do to history', () => {
  it('replaces rather than stacks, so one Back escapes a search of any length', () => {
    // Fourteen keystrokes must not cost fourteen presses of Back.
    const { result } = mountOn(['/movie/a1', '/']);

    act(() => result.current.setSearch('light'));
    act(() => result.current.setSearch('lighthouse'));
    act(() => result.current.setSearch('lighthouse k'));

    goBack();

    expect(currentUrl()).toBe('/movie/a1');
  });

  it('leaves nothing of the abandoned terms behind to go back through', () => {
    const { result } = mountOn(['/movie/a1', '/']);

    act(() => result.current.setSearch('light'));
    act(() => result.current.setSearch(''));

    goBack();

    expect(currentUrl()).toBe('/movie/a1');
  });
});

describe('useLibraryQuery — reading the sort order', () => {
  it('reads the sort the URL is carrying', () => {
    const { result } = mountOn(['/?sort=a-z']);

    expect(result.current.query.sort).toBe('a-z');
  });

  it('reads the default order from a clean “/”', () => {
    const { result } = mountOn(['/']);

    expect(result.current.query.sort).toBe('recently-added');
  });

  it('reports the new order once the URL has changed', () => {
    const { result } = mountOn(['/']);

    act(() => result.current.setSort('highest-rated'));

    expect(result.current.query.sort).toBe('highest-rated');
  });
});

describe('useLibraryQuery — writing the sort order', () => {
  it('writes the chosen order into the URL as “sort”', () => {
    const { result } = mountOn(['/']);

    act(() => result.current.setSort('a-z'));

    expect(currentUrl()).toBe('/?sort=a-z');
  });

  it('removes “sort” at the default order, so an unsorted home is a clean “/”', () => {
    // Recently-added is what the home has always shown; it needs no parameter
    // to explain it.
    const { result } = mountOn(['/?sort=a-z']);

    act(() => result.current.setSort('recently-added'));

    expect(currentUrl()).toBe('/');
  });

  it('leaves the search text exactly as it found it', () => {
    // Each part of the query has its own setter; choosing an order must not
    // throw away what the parent typed.
    const { result } = mountOn(['/?q=lighthouse']);

    act(() => result.current.setSort('year'));

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('q')).toBe('lighthouse');
    expect(written.get('sort')).toBe('year');
  });

  it('removes only its own parameter when the order goes back to the default', () => {
    const { result } = mountOn(['/?q=lighthouse&sort=a-z']);

    act(() => result.current.setSort('recently-added'));

    expect(currentUrl()).toBe('/?q=lighthouse');
  });

  it('replaces the order rather than stacking a second one', () => {
    const { result } = mountOn(['/?sort=a-z']);

    act(() => result.current.setSort('year'));

    expect(currentUrl()).toBe('/?sort=year');
  });

  it('costs no history, so one Back still escapes the whole screen', () => {
    const { result } = mountOn(['/movie/a1', '/']);

    act(() => result.current.setSort('a-z'));
    act(() => result.current.setSort('year'));
    act(() => result.current.setSearch('comet'));

    goBack();

    expect(currentUrl()).toBe('/movie/a1');
  });
});

describe('useLibraryQuery — reading the genre', () => {
  it('reads the genre the URL is carrying', () => {
    const { result } = mountOn(['/?genre=Drama']);

    expect(result.current.query.genre).toBe('Drama');
  });

  it('holds no genre on a clean “/”', () => {
    const { result } = mountOn(['/']);

    expect(result.current.query.genre).toBeUndefined();
  });

  it('reports the new genre once the URL has changed', () => {
    const { result } = mountOn(['/']);

    act(() => result.current.setGenre('Action'));

    expect(result.current.query.genre).toBe('Action');
  });
});

describe('useLibraryQuery — writing the genre', () => {
  it('writes the chosen genre into the URL as “genre”', () => {
    const { result } = mountOn(['/']);

    act(() => result.current.setGenre('Drama'));

    expect(currentUrl()).toBe('/?genre=Drama');
  });

  it('removes “genre” for the empty string, so “All Genres” is a clean “/”', () => {
    const { result } = mountOn(['/?genre=Drama']);

    act(() => result.current.setGenre(''));

    expect(currentUrl()).toBe('/');
  });

  it('encodes a genre name that would otherwise break the query string', () => {
    const { result } = mountOn(['/']);

    act(() => result.current.setGenre('Science Fiction'));

    expect(result.current.query.genre).toBe('Science Fiction');
    expect(currentUrl()).not.toContain('Science Fiction');
  });

  it('leaves the search text and the order exactly as it found them', () => {
    const { result } = mountOn(['/?q=lighthouse&sort=a-z']);

    act(() => result.current.setGenre('Drama'));

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('q')).toBe('lighthouse');
    expect(written.get('sort')).toBe('a-z');
    expect(written.get('genre')).toBe('Drama');
  });

  it('removes only its own parameter when the genre is cleared', () => {
    const { result } = mountOn(['/?q=lighthouse&genre=Drama&sort=a-z']);

    act(() => result.current.setGenre(''));

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.has('genre')).toBe(false);
    expect(written.get('q')).toBe('lighthouse');
    expect(written.get('sort')).toBe('a-z');
  });

  it('replaces the genre rather than stacking a second one', () => {
    const { result } = mountOn(['/?genre=Drama']);

    act(() => result.current.setGenre('Action'));

    expect(currentUrl()).toBe('/?genre=Action');
  });

  it('costs no history, so one Back still escapes the whole screen', () => {
    const { result } = mountOn(['/movie/a1', '/']);

    act(() => result.current.setGenre('Drama'));
    act(() => result.current.setGenre('Action'));
    act(() => result.current.setGenre(''));

    goBack();

    expect(currentUrl()).toBe('/movie/a1');
  });
});

// --- 05 — Search + filter, Phase 5: "the Rating dropdown" (issue #37) ---------

describe('useLibraryQuery — reading the minimum rating', () => {
  it('reads the minimum the URL is carrying, under its domain name', () => {
    const { result } = mountOn(['/?rating=6']);

    expect(result.current.query.minRating).toBe(6);
  });

  it('holds no minimum on a clean “/”', () => {
    const { result } = mountOn(['/']);

    expect(result.current.query.minRating).toBeUndefined();
  });

  it('ignores a minimum the dropdown could not have written', () => {
    // A hand-edited URL must not narrow the library behind a pill that still
    // says "All ratings".
    const { result } = mountOn(['/?rating=7']);

    expect(result.current.query.minRating).toBeUndefined();
  });

  it('reports the new minimum once the URL has changed', () => {
    const { result } = mountOn(['/']);

    act(() => result.current.setRating(8));

    expect(result.current.query.minRating).toBe(8);
  });
});

describe('useLibraryQuery — writing the minimum rating', () => {
  it('writes the chosen minimum into the URL as “rating”', () => {
    const { result } = mountOn(['/']);

    act(() => result.current.setRating(6));

    expect(currentUrl()).toBe('/?rating=6');
  });

  it('removes “rating” for nought, so “All ratings” is a clean “/”', () => {
    const { result } = mountOn(['/?rating=8']);

    act(() => result.current.setRating(0));

    expect(currentUrl()).toBe('/');
  });

  it('leaves the search text, the genre and the order exactly as it found them', () => {
    const { result } = mountOn(['/?q=lighthouse&genre=Drama&sort=a-z']);

    act(() => result.current.setRating(8));

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.get('q')).toBe('lighthouse');
    expect(written.get('genre')).toBe('Drama');
    expect(written.get('sort')).toBe('a-z');
    expect(written.get('rating')).toBe('8');
  });

  it('removes only its own parameter when the minimum is cleared', () => {
    const { result } = mountOn(['/?q=lighthouse&genre=Drama&rating=8']);

    act(() => result.current.setRating(0));

    const written = new URLSearchParams(String(currentUrl()).split('?')[1]);
    expect(written.has('rating')).toBe(false);
    expect(written.get('q')).toBe('lighthouse');
    expect(written.get('genre')).toBe('Drama');
  });

  it('replaces the minimum rather than stacking a second one', () => {
    const { result } = mountOn(['/?rating=8']);

    act(() => result.current.setRating(4));

    expect(currentUrl()).toBe('/?rating=4');
  });

  it('costs no history, so one Back still escapes the whole screen', () => {
    const { result } = mountOn(['/movie/a1', '/']);

    act(() => result.current.setRating(8));
    act(() => result.current.setRating(6));
    act(() => result.current.setRating(0));

    goBack();

    expect(currentUrl()).toBe('/movie/a1');
  });
});
