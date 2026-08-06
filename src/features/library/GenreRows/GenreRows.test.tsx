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
import type { HomeRow, Movie } from '@/types';

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

/** The same movie tagged with two genres — it earns a card in both rows. */
const SHARED_MOVIE_PAYLOAD: HomeRow[] = [
  {
    genre: 'Action',
    count: 1,
    movies: [makeMovie({ id: 'x1', title: 'Ironclad', isFavorite: false })],
  },
  {
    genre: 'Thriller',
    count: 1,
    movies: [makeMovie({ id: 'x1', title: 'Ironclad', isFavorite: false })],
  },
];

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
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
      return Promise.resolve(okResponse(rows));
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
    return Promise.resolve(okResponse(rows));
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

interface FavoriteRequest {
  url: string;
  method: string | undefined;
  contentType: string | null;
  body: unknown;
}

function contentTypeOf(init?: RequestInit): string | null {
  const headers = init?.headers;
  if (!headers) {
    return null;
  }
  if (Array.isArray(headers)) {
    const pair = headers.find(([key]) => key.toLowerCase() === 'content-type');
    return pair ? pair[1] : null;
  }
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get('content-type');
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find(
    (name) => name.toLowerCase() === 'content-type'
  );
  return key === undefined ? null : record[key];
}

/** Every favorite save the screen has attempted, in order. */
function favoriteRequests(): FavoriteRequest[] {
  return fetchMock.mock.calls
    .filter(([input]) => String(input).includes('/favorite'))
    .map(([input, init]) => ({
      url: String(input),
      method: init?.method,
      contentType: contentTypeOf(init),
      body:
        init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    }));
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

describe('GenreRows — the favorite heart', () => {
  it('fills the heart immediately, before the save has come back', async () => {
    // A save that never settles: anything filled here is optimistic, not confirmed.
    serve(HOME_PAYLOAD, () => new Promise<Response>(() => undefined));
    renderRows();
    await screen.findByRole('heading', { name: 'Action' });

    expect(isFilled('Action')).toBe('false');

    fireEvent.click(heartIn('Action'));

    expect(isFilled('Action')).toBe('true');
  });

  it('saves the new value to POST /api/movies/:id/favorite', async () => {
    serve(HOME_PAYLOAD);
    renderRows();
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(heartIn('Action'));

    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));

    const [request] = favoriteRequests();
    expect(request.url).toContain('/api/movies/a1/favorite');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.contentType).toMatch(/application\/json/i);
    expect(request.body).toEqual({ value: true });
  });

  it('saves `false` when an existing favorite is unfavorited', async () => {
    serve(HOME_PAYLOAD, () => Promise.resolve(okResponse({ value: false })));
    renderRows();
    await screen.findByRole('heading', { name: 'Comedy' });

    expect(isFilled('Comedy')).toBe('true');

    fireEvent.click(heartIn('Comedy'));

    expect(isFilled('Comedy')).toBe('false');
    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));
    expect(favoriteRequests()[0].url).toContain('/api/movies/c1/favorite');
    expect(favoriteRequests()[0].body).toEqual({ value: false });
  });

  it('leaves the heart filled once the save succeeds', async () => {
    serve(HOME_PAYLOAD);
    renderRows();
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(heartIn('Action'));

    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));
    expect(isFilled('Action')).toBe('true');
  });

  it('reverts the heart when the save fails, so it never lies about what is saved', async () => {
    serve(HOME_PAYLOAD, () => Promise.reject(new Error('network down')));
    renderRows();
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(heartIn('Action'));
    expect(isFilled('Action')).toBe('true');

    await waitFor(() => expect(isFilled('Action')).toBe('false'));
  });

  it('reverts the heart when the server rejects the save', async () => {
    serve(HOME_PAYLOAD, () => Promise.resolve(serverErrorResponse()));
    renderRows();
    await screen.findByRole('heading', { name: 'Comedy' });

    fireEvent.click(heartIn('Comedy'));
    expect(isFilled('Comedy')).toBe('false');

    await waitFor(() => expect(isFilled('Comedy')).toBe('true'));
  });

  it('fills the same movie in every genre row it appears in', async () => {
    serve(SHARED_MOVIE_PAYLOAD);
    renderRows();
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(heartIn('Action'));

    expect(isFilled('Action')).toBe('true');
    expect(isFilled('Thriller')).toBe('true');

    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));
  });

  it('reverts the same movie in every genre row when the save fails', async () => {
    serve(SHARED_MOVIE_PAYLOAD, () =>
      Promise.reject(new Error('network down'))
    );
    renderRows();
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(heartIn('Action'));

    await waitFor(() => expect(isFilled('Action')).toBe('false'));
    expect(isFilled('Thriller')).toBe('false');
  });
});
