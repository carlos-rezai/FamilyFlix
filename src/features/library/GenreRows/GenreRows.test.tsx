import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { GenreRows } from './GenreRows';
import { theme } from '@/styles/theme';
import type { HomePayload, HomeRow, Movie } from '@/types';

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
 * A library as `GET /api/home` returns it: alphabetical by genre, each row
 * capped at 15 movies while `count` stays the genre's true total (Action holds
 * 214 movies but ships 2 cards here).
 */
const LIBRARY: HomeRow[] = [
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

/** One movie per row, so "the heart in the Action row" is never ambiguous. */
const HOME_PAYLOAD: HomeRow[] = [
  {
    genre: 'Action',
    count: 3,
    movies: [makeMovie({ id: 'a1', title: 'Northwind', isFavorite: false })],
  },
  {
    genre: 'Comedy',
    count: 2,
    movies: [makeMovie({ id: 'c1', title: 'Comet Season', isFavorite: true })],
  },
];

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/**
 * The named-section envelope `GET /api/home` answers with (issue #18). This
 * screen reads only `rows`; the continue section arrives in the same request
 * but has no surface here yet.
 */
function homePayload(rows: HomeRow[]): HomePayload {
  return { continueWatching: [], rows };
}

function serverErrorResponse(): Response {
  return {
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'boom' }),
  } as unknown as Response;
}

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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Serve the home aggregate from `rows`, and every favorite save from
 * `onFavorite`. Any other request is a fan-out this screen shouldn't make.
 */
function serve(
  rows: HomeRow[],
  onFavorite: () => Promise<Response> = () =>
    Promise.resolve(okResponse({ value: true }))
) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/home')) {
      return Promise.resolve(okResponse(homePayload(rows)));
    }
    if (url.includes('/favorite')) {
      return onFavorite();
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/**
 * Queue one successful home response. Anything requested other than the home
 * aggregate rejects, so a screen that fans out per genre fails loudly.
 */
function respondWithRows(rows: HomeRow[]) {
  fetchMock.mockImplementationOnce((input) => {
    const url = String(input);
    if (!url.includes('/api/home')) {
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }
    return Promise.resolve(okResponse(homePayload(rows)));
  });
}

function renderRows() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <GenreRows />
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** The rows are done loading once the first genre heading is on screen. */
function findGenreHeading(name: string) {
  return screen.findByRole('heading', { name });
}

/** The favorite heart on the single card in one genre's row. */
function heartIn(genre: string) {
  return within(screen.getByRole('region', { name: genre })).getByRole(
    'button',
    { name: /favorite/i }
  );
}

/** Whether that row's heart reads as filled — the card's public "is a favorite". */
function isFilled(genre: string) {
  return heartIn(genre).getAttribute('aria-pressed');
}

/** The id of every movie the screen has attempted to save, in order. */
function favoriteSaves(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => /\/api\/movies\/(.+)\/favorite/.exec(String(input)))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => decodeURIComponent(match[1]));
}

describe('GenreRows — loading the library', () => {
  it('renders one genre row per populated genre, in the order the home payload gives them', async () => {
    respondWithRows(LIBRARY);

    renderRows();

    await findGenreHeading('Action');

    const genres = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);

    expect(genres).toEqual(['Action', 'Comedy', 'Drama']);
  });

  it('renders each genre row as a labelled region holding that genre’s movies as cards', async () => {
    respondWithRows(LIBRARY);

    renderRows();

    await findGenreHeading('Action');

    const action = within(screen.getByRole('region', { name: 'Action' }));
    expect(action.getAllByText('Northwind').length).toBeGreaterThan(0);
    expect(action.getAllByText('Ironclad').length).toBeGreaterThan(0);

    const comedy = within(screen.getByRole('region', { name: 'Comedy' }));
    expect(comedy.getAllByText('Comet Season').length).toBeGreaterThan(0);
    expect(comedy.queryByText('Northwind')).toBeNull();
  });

  it('shows skeleton genre rows, and no real rows, while the library is loading', () => {
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));

    renderRows();

    expect(screen.getByRole('status', { name: /loading/i })).toBeDefined();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    expect(screen.queryByText(/your library is empty/i)).toBeNull();
    expect(screen.queryByText(/couldn.t load your library/i)).toBeNull();
  });

  it('shows the dedicated empty-library message, worded distinctly from a search miss, when no genre has movies', async () => {
    respondWithRows([]);

    renderRows();

    expect(await screen.findByText(/your library is empty/i)).toBeDefined();
    expect(screen.queryByText(/nothing here/i)).toBeNull();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
  });

  it('shows a retryable error when the library fails to load', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    renderRows();

    expect(
      await screen.findByText(/couldn.t load your library/i)
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
  });

  it('treats a non-OK response as a failed load', async () => {
    fetchMock.mockResolvedValueOnce(serverErrorResponse());

    renderRows();

    expect(
      await screen.findByText(/couldn.t load your library/i)
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('recovers and renders the genre rows when retry succeeds', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    respondWithRows(LIBRARY);

    renderRows();

    fireEvent.click(await screen.findByRole('button', { name: /retry/i }));

    await findGenreHeading('Action');

    expect(screen.queryByText(/couldn.t load your library/i)).toBeNull();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    ).toEqual(['Action', 'Comedy', 'Drama']);
  });
});

/**
 * The optimistic-favorite behaviour itself — reverting, echoing, one movie
 * across several rows — belongs to `useHomeRows` and is tested there against
 * the hook directly. What is left here is the claim only the rendered screen
 * can make: that the heart on a card is actually wired to that hook, for the
 * movie whose card was clicked.
 */
describe('GenreRows — the favorite heart', () => {
  it('fills the clicked card’s heart and saves that movie', async () => {
    serve(HOME_PAYLOAD);
    renderRows();
    await findGenreHeading('Action');

    expect(isFilled('Action')).toBe('false');

    fireEvent.click(heartIn('Action'));

    expect(isFilled('Action')).toBe('true');
    await waitFor(() => expect(favoriteSaves()).toEqual(['a1']));
  });
});
