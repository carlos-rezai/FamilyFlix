import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import LibraryPage from './LibraryPage';
import { theme } from '../../styles/theme';
import type { HomeRow, Movie } from '../../types';

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'm1',
    tmdbId: null,
    title: 'Comet Season',
    year: 2018,
    runtimeMinutes: 90,
    synopsis: null,
    director: null,
    cast: [],
    rating: 8,
    isFavorite: false,
    watched: false,
    resumePositionSeconds: 0,
    status: 'unwatched',
    videoPath: 'Comet Season/comet.mp4',
    posterPath: null,
    backdropPath: null,
    genres: [],
    subtitles: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * A home payload as `GET /api/home` returns it: alphabetical by genre, each row
 * capped at 15 movies while `count` stays the genre's true total (Action holds
 * 214 movies but ships 2 cards here).
 */
const HOME_PAYLOAD: HomeRow[] = [
  {
    genre: 'Action',
    count: 214,
    movies: [
      makeMovie({ id: 'a1', title: 'Northwind' }),
      makeMovie({ id: 'a2', title: 'Ironclad' }),
    ],
  },
  {
    genre: 'Comedy',
    count: 3,
    movies: [makeMovie({ id: 'c1', title: 'Comet Season' })],
  },
  {
    genre: 'Drama',
    count: 7,
    movies: [makeMovie({ id: 'd1', title: 'Quiet Harbor' })],
  },
];

function okResponse(rows: HomeRow[]): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(rows),
  } as unknown as Response;
}

function serverErrorResponse(): Response {
  return {
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'boom' }),
  } as unknown as Response;
}

let fetchMock: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>
>;

beforeEach(() => {
  fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Queue one successful home response. Anything requested other than the home
 * aggregate rejects, so a page that fans out per genre fails loudly.
 */
function respondWithRows(rows: HomeRow[]) {
  fetchMock.mockImplementationOnce((input) => {
    const url = String(input);
    if (!url.includes('/api/home')) {
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }
    return Promise.resolve(okResponse(rows));
  });
}

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <LibraryPage />
    </ThemeProvider>
  );
}

/** The rows are done loading once the first genre heading is on screen. */
function findGenreHeading(name: string) {
  return screen.findByRole('heading', { name });
}

describe('LibraryPage — genre rows against real /api/home data', () => {
  it('renders one genre row per populated genre, in the order the home payload gives them', async () => {
    respondWithRows(HOME_PAYLOAD);

    renderPage();

    await findGenreHeading('Action');

    const genres = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);

    expect(genres).toEqual(['Action', 'Comedy', 'Drama']);
  });

  it('renders each genre row as a labelled region holding that genre’s movies as cards', async () => {
    respondWithRows(HOME_PAYLOAD);

    renderPage();

    await findGenreHeading('Action');

    const action = within(screen.getByRole('region', { name: 'Action' }));
    expect(action.getAllByText('Northwind').length).toBeGreaterThan(0);
    expect(action.getAllByText('Ironclad').length).toBeGreaterThan(0);

    const comedy = within(screen.getByRole('region', { name: 'Comedy' }));
    expect(comedy.getAllByText('Comet Season').length).toBeGreaterThan(0);
    expect(comedy.queryByText('Northwind')).toBeNull();
  });

  it('labels each row “View all {count}” with the genre’s true total, not the number of cards shown', async () => {
    respondWithRows(HOME_PAYLOAD);

    renderPage();

    await findGenreHeading('Action');

    const action = within(screen.getByRole('region', { name: 'Action' }));
    expect(action.getByRole('button', { name: /view all 214/i })).toBeDefined();

    const drama = within(screen.getByRole('region', { name: 'Drama' }));
    expect(drama.getByRole('button', { name: /view all 7/i })).toBeDefined();
  });

  it('shows skeleton genre rows, and no real rows, while the library is loading', () => {
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));

    renderPage();

    expect(screen.getByRole('status', { name: /loading/i })).toBeDefined();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    expect(screen.queryByText(/your library is empty/i)).toBeNull();
    expect(screen.queryByText(/couldn.t load your library/i)).toBeNull();
  });

  it('shows the dedicated empty-library message, worded distinctly from a search miss, when no genre has movies', async () => {
    respondWithRows([]);

    renderPage();

    expect(await screen.findByText(/your library is empty/i)).toBeDefined();
    expect(screen.queryByText(/nothing here/i)).toBeNull();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
  });

  it('shows a retryable error when the library fails to load', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    renderPage();

    expect(
      await screen.findByText(/couldn.t load your library/i)
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
  });

  it('treats a non-OK response as a failed load', async () => {
    fetchMock.mockResolvedValueOnce(serverErrorResponse());

    renderPage();

    expect(
      await screen.findByText(/couldn.t load your library/i)
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('recovers and renders the genre rows when retry succeeds', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    respondWithRows(HOME_PAYLOAD);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /retry/i }));

    await findGenreHeading('Action');

    expect(screen.queryByText(/couldn.t load your library/i)).toBeNull();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    ).toEqual(['Action', 'Comedy', 'Drama']);
  });

  it('keeps the header (logo + gear) rendered through loading, failure, and success', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    respondWithRows(HOME_PAYLOAD);

    renderPage();

    // Loading.
    expect(screen.getByRole('button', { name: /familyflix/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /settings/i })).toBeDefined();

    // Failed.
    await screen.findByText(/couldn.t load your library/i);
    expect(screen.getByRole('button', { name: /familyflix/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /settings/i })).toBeDefined();

    // Loaded.
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await findGenreHeading('Action');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /familyflix/i })).toBeDefined();
    });
    expect(screen.getByRole('button', { name: /settings/i })).toBeDefined();
  });
});
