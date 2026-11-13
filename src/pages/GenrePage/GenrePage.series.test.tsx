import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import GenrePage from './GenrePage';
import { theme } from '@/styles/theme';
import type { GenrePayload, Series } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import {
  LocationProbe,
  pathname,
  search,
} from '@/test-support/LocationProbe/LocationProbe';

/**
 * 63, Row view, Phase 5 (issue #612): the Genre page for series.
 *
 * Under `?tab=series` the page reads the **Library tab** off its URL and loads
 * the series genre reads, `GET /api/series/genre/:name` and
 * `GET /api/series/genre-less`, drawn as the movie page is: Back, the genre's
 * name over `N of M titles`, the search box, the Sort pill and the grid. Its
 * cards open the series page, its `other` mode is headed _Other series_, the
 * **Carried sort** is its Sort, and Back with nothing behind it returns to the
 * Series tab. Without `tab` the page is the movie one it always was.
 */

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 's1',
    tmdbId: null,
    title: 'Harbor Days',
    year: 2021,
    endYear: null,
    synopsis: null,
    creator: null,
    cast: [],
    rating: null,
    isFavorite: false,
    posterPath: null,
    backdropPath: null,
    originalTitle: null,
    tmdbScore: null,
    genres: [],
    watched: false,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

/** The series genre payload as the wire carries it. */
interface SeriesGenreBody {
  genre: string;
  total: number;
  series: Series[];
}

/** Drama as the series read answers it: two of the genre's 5 series. */
const DRAMA: SeriesGenreBody = {
  genre: 'Drama',
  total: 5,
  series: [
    makeSeries({ id: 's1', title: 'Harbor Days' }),
    makeSeries({ id: 's2', title: 'Lighthouse Keepers' }),
  ],
};

/** The genre-less series: two of them, both drawn. */
const OTHER: SeriesGenreBody = {
  genre: '',
  total: 2,
  series: [
    makeSeries({ id: 's3', title: 'Loose Tape' }),
    makeSeries({ id: 's4', title: 'Attic Reel' }),
  ],
};

/** The movie Action genre, for the page without a tab. */
const ACTION: GenrePayload = {
  genre: 'Action',
  total: 214,
  movies: [
    makeMovie({ id: 'a1', title: 'Northwind' }),
    makeMovie({ id: 'a2', title: 'Northern Star' }),
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
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.startsWith('/api/series/genre-less')) {
      return Promise.resolve(okResponse(OTHER));
    }
    if (url.startsWith('/api/series/genre/')) {
      return Promise.resolve(okResponse(DRAMA));
    }
    if (url.startsWith('/api/genre/')) {
      return Promise.resolve(okResponse(ACTION));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Every URL the page has asked for, in order. */
function requests(): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

function renderPage(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/genre/:name" element={<GenrePage />} />
          <Route path="/genre-less" element={<GenrePage mode="other" />} />
          <Route path="/series/:id" element={<LocationProbe />} />
          <Route path="/movie/:id" element={<LocationProbe />} />
          <Route path="/" element={<LocationProbe />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('GenrePage — a genre of series', () => {
  it('loads the series genre read, never the movie one', async () => {
    renderPage('/genre/Drama?tab=series');

    await screen.findByRole('button', { name: 'Harbor Days' });

    expect(requests()).toHaveLength(1);
    expect(requests()[0].split('?')[0]).toBe('/api/series/genre/Drama');
  });

  it('draws Back, the name over N of M titles, search, Sort and the grid', async () => {
    renderPage('/genre/Drama?tab=series');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Drama' })
    ).toBeDefined();
    await screen.findByText('2 of 5 titles');
    const header = screen.getByRole('banner');
    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();
    expect(
      header.contains(screen.getByRole('textbox', { name: 'Search in Drama' }))
    ).toBe(true);
    expect(
      header.contains(
        screen.getByRole('button', { name: 'Sort: Recently Added' })
      )
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Harbor Days' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Lighthouse Keepers' })
    ).toBeDefined();
  });

  it('opens the series page from a card', async () => {
    renderPage('/genre/Drama?tab=series');

    fireEvent.click(await screen.findByRole('button', { name: 'Harbor Days' }));

    await waitFor(() => expect(pathname()).toBe('/series/s1'));
  });

  it('asks the series read again, with the term, when a search settles', async () => {
    renderPage('/genre/Drama?tab=series');
    await screen.findByRole('button', { name: 'Harbor Days' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Search in Drama' }), {
      target: { value: 'harbor' },
    });

    await waitFor(() => expect(requests()).toHaveLength(2));
    const [path, query] = requests()[1].split('?');
    expect(path).toBe('/api/series/genre/Drama');
    expect(new URLSearchParams(query).get('q')).toBe('harbor');
  });
});

describe('GenrePage — the series with no genre', () => {
  it('loads the genre-less series read and is headed Other series', async () => {
    renderPage('/genre-less?tab=series');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Other series' })
    ).toBeDefined();
    await screen.findByRole('button', { name: 'Loose Tape' });
    expect(requests()[0].split('?')[0]).toBe('/api/series/genre-less');
    expect(screen.getByText('2 titles')).toBeDefined();
  });

  it('opens the series page from a card', async () => {
    renderPage('/genre-less?tab=series');

    fireEvent.click(await screen.findByRole('button', { name: 'Attic Reel' }));

    await waitFor(() => expect(pathname()).toBe('/series/s4'));
  });
});

describe('GenrePage — the Carried sort on series', () => {
  it('loads in the sort the link carried and shows it on the Sort pill', async () => {
    renderPage('/genre/Drama?tab=series&sort=a-z');

    await screen.findByRole('button', { name: 'Harbor Days' });

    const [path, query] = requests()[0].split('?');
    expect(path).toBe('/api/series/genre/Drama');
    expect(new URLSearchParams(query).get('sort')).toBe('a-z');
    expect(
      screen.getByRole('button', { name: 'Sort: Title (A–Z)' })
    ).toBeDefined();
  });
});

describe('GenrePage — Back from a series genre', () => {
  it('returns to the Series tab when nothing is behind it', async () => {
    renderPage('/genre/Drama?tab=series');
    await screen.findByRole('button', { name: 'Harbor Days' });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => expect(pathname()).toBe('/'));
    expect(new URLSearchParams(search() ?? '').get('tab')).toBe('series');
  });

  it('returns to the Series tab from the Other series page too', async () => {
    renderPage('/genre-less?tab=series');
    await screen.findByRole('button', { name: 'Loose Tape' });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => expect(pathname()).toBe('/'));
    expect(new URLSearchParams(search() ?? '').get('tab')).toBe('series');
  });
});

describe('GenrePage — without a tab', () => {
  it('stays the movie page: the movie read, cards to the movie, Back to Movies', async () => {
    renderPage('/genre/Action');

    fireEvent.click(await screen.findByRole('button', { name: 'Northwind' }));
    await waitFor(() => expect(pathname()).toBe('/movie/a1'));
    expect(requests()[0].split('?')[0]).toBe('/api/genre/Action');
  });

  it('steps Back to the Movies tab when nothing is behind it', async () => {
    renderPage('/genre/Action');
    await screen.findByRole('button', { name: 'Northwind' });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => expect(pathname()).toBe('/'));
    expect(search()).toBe('');
  });
});
