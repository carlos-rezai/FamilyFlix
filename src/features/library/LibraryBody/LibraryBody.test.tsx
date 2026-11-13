import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

import { LibraryBody } from './LibraryBody';
import { theme } from '@/styles/theme';
import type {
  HomePayload,
  MovieGridPayload,
  RowView,
  Series,
  SeriesHomePayload,
} from '@/types';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';
import { makeDisplayPreferenceApi } from '@/test-support/makeDisplayPreferenceApi/makeDisplayPreferenceApi';

/**
 * 63, Row view, Phase 3 (issue #610): `LibraryBody` picks the Movies tab's
 * body off its **Row view**: `MovieGrid` under **All**, `HomeRows` under
 * **By genre**, and nothing while the view is `null`. The view is held by the
 * household rather than the URL, so back from a title lands on it again.
 */

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 's1',
    tmdbId: null,
    title: 'Harbor & Vine',
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

const FILM = makeMovie({
  id: 'm1',
  title: 'Die Hard',
  genres: [{ id: 'g1', name: 'Action' }],
});

const GRID: MovieGridPayload = { movies: [FILM], continueWatching: [] };

const HOME: HomePayload = {
  rows: [{ genre: 'Action', count: 1, movies: [FILM] }],
  continueWatching: [],
  favorites: [],
  other: null,
};

const SHOW = makeSeries({ id: 's1', title: 'Harbor & Vine' });

const SERIES_HOME: SeriesHomePayload = {
  series: [SHOW],
  episodeCount: 1,
  continueWatching: [],
};

const SERIES_ROWS = {
  rows: [{ genre: 'Drama', count: 1, series: [SHOW] }],
  other: null,
  favorites: [],
  continueWatching: [],
};

let fetchMock: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>
>;

beforeEach(() => {
  fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/movies')) {
      return Promise.resolve(okResponse(GRID));
    }
    if (url.includes('/api/home')) {
      return Promise.resolve(okResponse(HOME));
    }
    if (url.includes('/api/series/rows')) {
      return Promise.resolve(okResponse(SERIES_ROWS));
    }
    if (url.includes('/api/series')) {
      return Promise.resolve(okResponse(SERIES_HOME));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A stand-in title page with a way back. */
function TitlePage() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Back</button>;
}

/** The body over the routes, the household holding `movieRowView`. */
function tree(movieRowView: RowView | null) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider theme={theme}>
        <DisplayPreferenceContext.Provider
          value={makeDisplayPreferenceApi({ movieRowView })}
        >
          <Routes>
            <Route path="/" element={<LibraryBody />} />
            <Route path="/movie/:id" element={<TitlePage />} />
          </Routes>
        </DisplayPreferenceContext.Provider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

function renderBody(movieRowView: RowView | null) {
  const rendered = render(tree(movieRowView));
  return {
    ...rendered,
    /** The household's view changes, as the switch or the server would. */
    hold: (view: RowView | null) => rendered.rerender(tree(view)),
  };
}

const allMovies = () =>
  screen.findByRole('heading', { name: 'All movies', level: 2 });

const actionRow = () => screen.findByRole('region', { name: 'Action' });

const requested = () => fetchMock.mock.calls.map(([input]) => String(input));

describe('LibraryBody: the Movies tabâ€™s Row view', () => {
  it('draws the movie grid under All', async () => {
    renderBody('all');

    expect(await allMovies()).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Action' })).toBeNull();
    expect(requested().some((url) => url.includes('/api/home'))).toBe(false);
  });

  it('draws the genre rows under By genre, and the grid once All is chosen', async () => {
    const { hold } = renderBody('genre');

    expect(await actionRow()).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'All movies' })).toBeNull();
    expect(requested().some((url) => url.includes('/api/movies'))).toBe(false);

    hold('all');

    expect(await allMovies()).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Action' })).toBeNull();
  });

  it('draws nothing, and reads nothing, while the view is null', () => {
    const { container } = renderBody(null);

    expect(container.textContent).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('LibraryBody: back from a title', () => {
  it('returns to the grid the household holds under All', async () => {
    renderBody('all');
    fireEvent.click(await screen.findByRole('button', { name: 'Die Hard' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(await allMovies()).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Action' })).toBeNull();
  });

  it('returns to the view the household holds now, not the one it left', async () => {
    const { hold } = renderBody('genre');
    await actionRow();
    fireEvent.click(screen.getAllByRole('button', { name: 'Die Hard' })[0]);
    hold('all');
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));

    expect(await allMovies()).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Action' })).toBeNull();
  });
});

/**
 * 63, Row view, Phase 4 (issue #611): on the Series tab `LibraryBody` picks
 * `SeriesHome` under **All** and `SeriesRows` under **By genre**, off the
 * Series tab's own **Row view**.
 */
function seriesTree(seriesRowView: RowView | null) {
  return (
    <MemoryRouter initialEntries={['/?tab=series']}>
      <ThemeProvider theme={theme}>
        <DisplayPreferenceContext.Provider
          value={makeDisplayPreferenceApi({
            movieRowView: 'genre',
            seriesRowView,
          })}
        >
          <LibraryBody />
        </DisplayPreferenceContext.Provider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const allSeries = () =>
  screen.findByRole('heading', { name: 'All series', level: 2 });

const dramaRow = () => screen.findByRole('region', { name: 'Drama' });

describe('LibraryBody: the Series tab’s Row view', () => {
  it('draws All series under All, and reads no series rows', async () => {
    render(seriesTree('all'));

    expect(await allSeries()).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Drama' })).toBeNull();
    expect(requested().some((url) => url.includes('/api/series/rows'))).toBe(
      false
    );
  });

  it('draws the series genre rows under By genre, and no All series', async () => {
    render(seriesTree('genre'));

    expect(await dramaRow()).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'All series' })).toBeNull();
    expect(requested().some((url) => url.includes('/api/series/rows'))).toBe(
      true
    );
    expect(requested().some((url) => url.includes('/api/home'))).toBe(false);
  });

  it('switches from the rows to All series once All is chosen', async () => {
    const { rerender } = render(seriesTree('genre'));
    await dramaRow();

    rerender(seriesTree('all'));

    expect(await allSeries()).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Drama' })).toBeNull();
  });
});
