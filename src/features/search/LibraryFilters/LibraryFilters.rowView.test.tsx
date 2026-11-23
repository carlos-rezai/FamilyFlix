import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { LibraryFilters } from './LibraryFilters';
import { DisplayPreferenceProvider } from '@/App/DisplayPreferenceProvider/DisplayPreferenceProvider';
import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { theme } from '@/styles/theme';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeDisplayPreferenceApi } from '@/test-support/makeDisplayPreferenceApi/makeDisplayPreferenceApi';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';

/**
 * 73, Header fit, Phase 2 (issue #695): the **Row view** chosen from the
 * Genre dropdown's **View rows**. The pill's value is the URL's genre, else
 * the tab's view: _All Genres_ (**By genre**) or the tab's _All_ row (**All**).
 * A View row takes `?genre=` off and saves the tab's view, shown at once, with
 * no snackbar; a genre writes `?genre=` alone and leaves the view. Mounted
 * under the real `DisplayPreferenceProvider` over a stubbed `fetch`, the
 * household storing Movies By genre and Series All.
 */

const SETTINGS_ROUTE = '/api/settings';
const MOVIE_ROW_VIEW_ROUTE = '/api/settings/movie-row-view';
const SERIES_ROW_VIEW_ROUTE = '/api/settings/series-row-view';

const GENRE_LIST = {
  total: 24,
  genres: [
    { id: 'g1', name: 'Action', count: 9 },
    { id: 'g3', name: 'Drama', count: 12 },
  ],
};

const SERIES_GENRE_LIST = {
  total: 5,
  genres: [
    { id: 'g3', name: 'Drama', count: 3 },
    { id: 'g5', name: 'Family', count: 2 },
  ],
};

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((input, init) => {
    const requested = String(input);
    if (requested === SETTINGS_ROUTE) {
      return Promise.resolve(
        okResponse(
          makeSettings({ movieRowView: 'genre', seriesRowView: 'all' })
        )
      );
    }
    if (requested.startsWith(`${SETTINGS_ROUTE}/`)) {
      const body = JSON.parse(String(init?.body)) as { value: unknown };
      return Promise.resolve(okResponse({ value: body.value }));
    }
    if (requested.includes('/api/series/genres')) {
      return Promise.resolve(okResponse(SERIES_GENRE_LIST));
    }
    if (requested.includes('/api/genres')) {
      return Promise.resolve(okResponse(GENRE_LIST));
    }
    return Promise.reject(new Error(`Unexpected request: ${requested}`));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderFilters(entry = '/') {
  const view = render(
    <MemoryRouter initialEntries={[entry]}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <DisplayPreferenceProvider>
            <LibraryFilters />
          </DisplayPreferenceProvider>
        </SnackbarProvider>
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
  await act(async () => undefined);
  return view;
}

/** The Genre pill, once the settings read has landed. */
const genrePill = (value: string) =>
  screen.findByRole('button', { name: `Genre: ${value}` });

/** The rows of the open Genre panel, top to bottom, counts stripped. */
function panelRows(trigger: HTMLElement): string[] {
  return within(trigger.parentElement as HTMLElement)
    .queryAllByRole('menuitem')
    .map((row) => (row.textContent ?? '').replace(/\d+$/, ''));
}

/** Open the pill showing `value`, and wait for the genre list to land. */
async function openGenre(value: string) {
  const control = await genrePill(value);
  act(() => control.focus());
  fireEvent.click(control);
  await waitFor(() => expect(panelRows(control).length).toBeGreaterThan(2));
  return control;
}

async function choose(pillValue: string, row: string) {
  await openGenre(pillValue);
  fireEvent.click(screen.getByRole('menuitem', { name: row }));
}

/** The values written to one setting, in order. */
function writesTo(route: string): unknown[] {
  return fetchMock.mock.calls
    .filter(([input]) => String(input) === route)
    .map(
      ([, init]) => (JSON.parse(String(init?.body)) as { value: unknown }).value
    );
}

/** The URL's parameters, read as a set rather than a spelling. */
const params = () => new URLSearchParams((url() ?? '').split('?')[1] ?? '');

describe('LibraryFilters: the Genre pill reads the Row view', () => {
  it('reads “All Genres” on Movies, browsed By genre', async () => {
    await renderFilters('/');

    expect(await genrePill('All Genres')).toBeDefined();
  });

  it('reads “All series” on Series, browsed All', async () => {
    await renderFilters('/?tab=series');

    expect(await genrePill('All series')).toBeDefined();
  });

  it('reads the URL’s genre over the tab’s view', async () => {
    await renderFilters('/?tab=series&genre=Drama');

    expect(await genrePill('Drama')).toBeDefined();
  });

  it('offers the Series tab’s View rows first, “All series” checked', async () => {
    await renderFilters('/?tab=series');

    const control = await openGenre('All series');

    expect(panelRows(control)).toEqual([
      'All Genres',
      'All series',
      'Drama',
      'Family',
    ]);
    expect(
      screen
        .getByRole('menuitem', { name: 'All series' })
        .getAttribute('aria-current')
    ).toBe('true');
    expect(
      screen
        .getByRole('menuitem', { name: 'All Genres' })
        .getAttribute('aria-current')
    ).toBeNull();
  });

  it('draws no Genre pill while the Row view is still unknown', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <DisplayPreferenceContext.Provider value={makeDisplayPreferenceApi()}>
          <ThemeProvider theme={theme}>
            <LibraryFilters />
          </ThemeProvider>
        </DisplayPreferenceContext.Provider>
      </MemoryRouter>
    );
    await act(async () => undefined);

    expect(screen.queryByRole('button', { name: /^Genre:/ })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Sort: Recently Added' })
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Minimum rating: All ratings' })
    ).toBeDefined();
  });
});

describe('LibraryFilters: choosing a View row', () => {
  it('“All movies” takes the genre off and saves the Movies tab’s view', async () => {
    await renderFilters('/?q=north&genre=Drama&rating=6&sort=year');

    await choose('Drama', 'All movies');

    expect(await genrePill('All movies')).toBeDefined();
    await waitFor(() =>
      expect(writesTo(MOVIE_ROW_VIEW_ROUTE)).toEqual(['all'])
    );
    expect(writesTo(SERIES_ROW_VIEW_ROUTE)).toEqual([]);
    expect(params().has('genre')).toBe(false);
  });

  it('keeps the search text, the rating and the order', async () => {
    await renderFilters('/?q=north&genre=Drama&rating=6&sort=year');

    await choose('Drama', 'All movies');

    await genrePill('All movies');
    expect(params().get('q')).toBe('north');
    expect(params().get('rating')).toBe('6');
    expect(params().get('sort')).toBe('year');
  });

  it('“All Genres” on Series saves the Series tab’s view and keeps the tab', async () => {
    await renderFilters('/?tab=series&genre=Drama');

    await choose('Drama', 'All Genres');

    expect(await genrePill('All Genres')).toBeDefined();
    await waitFor(() =>
      expect(writesTo(SERIES_ROW_VIEW_ROUTE)).toEqual(['genre'])
    );
    expect(writesTo(MOVIE_ROW_VIEW_ROUTE)).toEqual([]);
    expect(params().get('tab')).toBe('series');
    expect(params().has('genre')).toBe(false);
  });

  it('draws no snackbar', async () => {
    await renderFilters('/');

    await choose('All Genres', 'All movies');

    await genrePill('All movies');
    await waitFor(() => expect(writesTo(MOVIE_ROW_VIEW_ROUTE)).toHaveLength(1));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('LibraryFilters: choosing a genre', () => {
  it('writes ?genre= and leaves the view as it was', async () => {
    await renderFilters('/?tab=series&q=harbor&rating=6&sort=year');

    await choose('All series', 'Family');

    expect(await genrePill('Family')).toBeDefined();
    expect(params().get('genre')).toBe('Family');
    expect(params().get('tab')).toBe('series');
    expect(params().get('q')).toBe('harbor');
    expect(params().get('rating')).toBe('6');
    expect(params().get('sort')).toBe('year');
    expect(writesTo(SERIES_ROW_VIEW_ROUTE)).toEqual([]);
    expect(writesTo(MOVIE_ROW_VIEW_ROUTE)).toEqual([]);
  });

  it('still checks the view’s row once the genre is taken off again', async () => {
    // The genre narrowed the grid the household chose; it never changed it.
    await renderFilters('/?tab=series');
    await choose('All series', 'Drama');
    await genrePill('Drama');

    await choose('Drama', 'All series');

    expect(await genrePill('All series')).toBeDefined();
    expect(params().has('genre')).toBe(false);
  });
});
