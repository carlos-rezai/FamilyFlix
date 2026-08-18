import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import { useHomeRows } from './useHomeRows';
import { gradientFromId, NOMINAL_SLIVER_PERCENT } from '@/utils';
import type { GenreRowModel, HomePayload, Movie } from '@/types';

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

/** One movie per row, so "the favorite in Action" is never ambiguous. */
const HOME_PAYLOAD: HomePayload = {
  continueWatching: [],
  rows: [
    {
      genre: 'Action',
      count: 3,
      movies: [makeMovie({ id: 'a1', title: 'Northwind', isFavorite: false })],
    },
    {
      genre: 'Comedy',
      count: 2,
      movies: [
        makeMovie({ id: 'c1', title: 'Comet Season', isFavorite: true }),
      ],
    },
  ],
};

/**
 * The same payload with the continue section populated — the movie is
 * part-way through and so appears in both sections, exactly as the aggregate
 * builds it.
 */
const STARTED_PAYLOAD: HomePayload = {
  continueWatching: [
    makeMovie({
      id: 'a1',
      title: 'Northwind',
      resumePositionSeconds: 4380,
      status: 'in-progress',
    }),
  ],
  rows: HOME_PAYLOAD.rows,
};

/**
 * Two movies part-way through — one whose runtime is known and one whose
 * isn't — so the mapped tiles cover both shapes of resume label.
 */
const IN_PROGRESS_PAYLOAD: HomePayload = {
  continueWatching: [
    makeMovie({
      id: 'a1',
      title: 'Northwind',
      runtimeMinutes: 100,
      resumePositionSeconds: 1500,
      status: 'in-progress',
    }),
    makeMovie({
      id: 'c1',
      title: 'Comet Season',
      runtimeMinutes: null,
      resumePositionSeconds: 2520,
      status: 'in-progress',
    }),
  ],
  rows: HOME_PAYLOAD.rows,
};

/** The same movie tagged with two genres — it earns a card in both rows. */
const SHARED_MOVIE_PAYLOAD: HomePayload = {
  continueWatching: [],
  rows: [
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
  ],
};

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
 * Serve the home aggregate from `payload`, and every favorite save from
 * `onFavorite`. Any other request is a fan-out this hook shouldn't make.
 */
function serve(
  payload: HomePayload,
  onFavorite: () => Promise<Response> = () =>
    Promise.resolve(okResponse({ value: true }))
) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/home')) {
      return Promise.resolve(okResponse(payload));
    }
    if (url.includes('/favorite')) {
      return onFavorite();
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/**
 * Drives the URL the way the header controls do — the hook reads the settled
 * query from the router, so changing the query means changing the address.
 */
let goTo: (url: string) => void = () => undefined;

function Navigator() {
  const navigate = useNavigate();
  goTo = (url) => navigate(url, { replace: true });
  return null;
}

function routerAt(url: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[url]}>
        {children}
        <Navigator />
      </MemoryRouter>
    );
  };
}

/** Mount the hook on a URL, without waiting for anything. */
function mountRows(url = '/') {
  return renderHook(() => useHomeRows(), { wrapper: routerAt(url) });
}

/** Mount the hook and wait for the initial load to settle. */
async function loadRows(url = '/') {
  const view = mountRows(url);
  await waitFor(() => expect(view.result.current.status).not.toBe('loading'));
  return view;
}

/** Every home request the hook has issued, as its URL. */
function homeRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/api/home'));
}

/** The query string of the nth home request, parsed rather than matched. */
function homeQuery(index: number): URLSearchParams {
  return new URLSearchParams(homeRequests()[index].split('?')[1] ?? '');
}

/** Whether one movie reads as a favorite in one genre's row. */
function favoriteIn(rows: GenreRowModel[], genre: string, id: string) {
  return rows
    .find((row) => row.genre === genre)
    ?.movies.find((movie) => movie.id === id)?.favorite;
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

/** Every favorite save the hook has attempted, in order. */
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

describe('useHomeRows — loading the library', () => {
  it('maps the payload into render-ready rows and reports ready', async () => {
    serve(HOME_PAYLOAD);

    const { result } = await loadRows();

    expect(result.current.status).toBe('ready');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);

    const [action] = result.current.rows;
    // The true total survives; the movies are narrowed to card view models.
    expect(action.count).toBe(3);
    expect(action.movies).toHaveLength(1);
    expect(action.movies[0].title).toBe('Northwind');
    expect(action.movies[0].favorite).toBe(false);
  });

  it('loads the whole home in one request, never one per genre', async () => {
    serve(HOME_PAYLOAD);

    await loadRows();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders the genre rows unchanged when a continue section arrives too', async () => {
    // The section is fetched in the same request but has no surface yet; the
    // screen must look exactly as it does today, and one request still means
    // one loading transition.
    serve(STARTED_PAYLOAD);

    const { result } = await loadRows();

    expect(result.current.status).toBe('ready');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);
    expect(result.current.rows[0].movies.map((movie) => movie.title)).toEqual([
      'Northwind',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports error and holds no rows when the load fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const { result } = await loadRows();

    expect(result.current.status).toBe('error');
    expect(result.current.rows).toEqual([]);
  });

  it('recovers on retry', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { result } = await loadRows();
    expect(result.current.status).toBe('error');

    serve(HOME_PAYLOAD);
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);
  });

  it('does not let a slow first load overwrite the newer one that replaced it', async () => {
    // The first request never settles until we say so; the retry lands first.
    let settleFirst: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          settleFirst = resolve;
        })
    );

    const { result } = mountRows();
    expect(result.current.status).toBe('loading');

    serve(HOME_PAYLOAD);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    // The abandoned load finally answers, with a library that no longer applies.
    await act(async () => {
      settleFirst(okResponse(SHARED_MOVIE_PAYLOAD));
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);
  });
});

describe('useHomeRows — the settled query', () => {
  /** The same library narrowed by a search: Action matched nothing and was dropped. */
  const NARROWED_PAYLOAD: HomePayload = {
    continueWatching: [],
    rows: [
      {
        genre: 'Comedy',
        count: 2,
        movies: [makeMovie({ id: 'c1', title: 'Comet Season' })],
      },
    ],
  };

  /** Answer the first home request from `first`, every later one from `rest`. */
  function serveInTurn(first: HomePayload, rest: HomePayload) {
    fetchMock.mockImplementationOnce(() => Promise.resolve(okResponse(first)));
    fetchMock.mockImplementation(() => Promise.resolve(okResponse(rest)));
  }

  it('asks for the whole library when the URL carries no query', async () => {
    serve(HOME_PAYLOAD);

    await loadRows('/');

    expect(homeRequests()).toEqual(['/api/home']);
  });

  it('asks with the search the URL was opened on, so a shared link loads narrowed', async () => {
    // The query is in the URL, so it is already known on the very first render
    // — there is no unfiltered load to flash past first.
    serve(NARROWED_PAYLOAD);

    const { result } = await loadRows('/?q=comet');

    expect(homeRequests()).toHaveLength(1);
    expect(homeQuery(0).get('q')).toBe('comet');
    expect(result.current.rows.map((row) => row.genre)).toEqual(['Comedy']);
  });

  it('asks again, with the new term, when the settled query changes', async () => {
    serveInTurn(HOME_PAYLOAD, NARROWED_PAYLOAD);
    const { result } = await loadRows('/');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);

    act(() => goTo('/?q=comet'));

    await waitFor(() =>
      expect(result.current.rows.map((row) => row.genre)).toEqual(['Comedy'])
    );
    expect(homeRequests()).toHaveLength(2);
    expect(homeQuery(1).get('q')).toBe('comet');
  });

  it('keeps the rows already on screen while the new ones are loading', async () => {
    // Flashing the skeleton every 250ms of typing would be unreadable — she is
    // reading them. The old answer stays until the new one arrives.
    serveInTurn(HOME_PAYLOAD, NARROWED_PAYLOAD);
    const { result } = await loadRows('/');

    // The refetch is in flight and has not answered yet.
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    act(() => goTo('/?q=comet'));

    await waitFor(() => expect(homeRequests()).toHaveLength(2));
    expect(result.current.status).toBe('ready');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);
  });

  it('shows the skeleton on the very first load', async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    const { result } = mountRows('/');

    expect(result.current.status).toBe('loading');
    expect(result.current.rows).toEqual([]);
  });

  it('leaves the rows alone when a part of the URL it does not read changes', async () => {
    serve(HOME_PAYLOAD);
    const { result } = await loadRows('/');

    act(() => goTo('/?scroll=120'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(homeRequests()).toHaveLength(1);
  });

  it('does not let an abandoned query’s slow answer overwrite the newer one', async () => {
    // The unfiltered load is still in flight when the parent finishes typing;
    // its answer is a library that no longer applies when it finally lands.
    let settleFirst: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          settleFirst = resolve;
        })
    );
    fetchMock.mockImplementation(() =>
      Promise.resolve(okResponse(NARROWED_PAYLOAD))
    );

    const { result } = mountRows('/');
    expect(result.current.status).toBe('loading');

    act(() => goTo('/?q=comet'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      settleFirst(okResponse(HOME_PAYLOAD));
    });

    expect(result.current.rows.map((row) => row.genre)).toEqual(['Comedy']);
  });
});

describe('useHomeRows — the continue section', () => {
  it('maps the continue section into render-ready resume tiles', async () => {
    serve(IN_PROGRESS_PAYLOAD);

    const { result } = await loadRows();

    const [northwind, comet] = result.current.continueWatching;

    expect(northwind.id).toBe('a1');
    expect(northwind.title).toBe('Northwind');
    // 25:00 into a 1:40:00 movie — a quarter of the way through.
    expect(northwind.resumeLabel).toBe('Resume · 25:00 of 1:40:00');
    expect(northwind.progress).toBe(25);

    // Unknown runtime: elapsed alone, and the nominal sliver on the track.
    expect(comet.resumeLabel).toBe('Resume · 42:00');
    expect(comet.progress).toBe(NOMINAL_SLIVER_PERCENT);
  });

  it('gives every tile the gradient stops its id hashes to', async () => {
    serve(IN_PROGRESS_PAYLOAD);

    const { result } = await loadRows();

    const [northwind] = result.current.continueWatching;
    const { g1, g2 } = gradientFromId('a1');

    expect(northwind.g1).toBe(g1);
    expect(northwind.g2).toBe(g2);
  });

  it('holds no resume tiles when nothing is in progress', async () => {
    serve(HOME_PAYLOAD);

    const { result } = await loadRows();

    expect(result.current.continueWatching).toEqual([]);
  });

  it('reports both sections in the one ready transition, from the one request', async () => {
    // The screen paints at once: the continue tiles are never ready a beat
    // after the rows that had already painted.
    serve(IN_PROGRESS_PAYLOAD);

    const { result } = await loadRows();

    expect(result.current.status).toBe('ready');
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.continueWatching).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('holds no resume tiles when the load fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const { result } = await loadRows();

    expect(result.current.status).toBe('error');
    expect(result.current.continueWatching).toEqual([]);
  });

  it('restores the continue section on retry', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { result } = await loadRows();
    expect(result.current.continueWatching).toEqual([]);

    serve(IN_PROGRESS_PAYLOAD);
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.continueWatching.map((movie) => movie.title)).toEqual(
      ['Northwind', 'Comet Season']
    );
  });
});

describe('useHomeRows — the favorite flag', () => {
  it('shows the new value immediately, before the save has come back', async () => {
    // A save that never settles: anything set here is optimistic, not confirmed.
    serve(HOME_PAYLOAD, () => new Promise<Response>(() => undefined));
    const { result } = await loadRows();

    expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(false);

    act(() => result.current.toggleFavorite('a1', true));

    expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(true);
  });

  it('saves the new value to POST /api/movies/:id/favorite', async () => {
    serve(HOME_PAYLOAD);
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('a1', true));

    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));

    const [request] = favoriteRequests();
    expect(request.url).toContain('/api/movies/a1/favorite');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.contentType).toMatch(/application\/json/i);
    expect(request.body).toEqual({ value: true });
  });

  it('saves `false` when an existing favorite is un-favorited', async () => {
    serve(HOME_PAYLOAD, () => Promise.resolve(okResponse({ value: false })));
    const { result } = await loadRows();

    expect(favoriteIn(result.current.rows, 'Comedy', 'c1')).toBe(true);

    act(() => result.current.toggleFavorite('c1', false));

    expect(favoriteIn(result.current.rows, 'Comedy', 'c1')).toBe(false);
    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));
    expect(favoriteRequests()[0].url).toContain('/api/movies/c1/favorite');
    expect(favoriteRequests()[0].body).toEqual({ value: false });
  });

  it('keeps the new value once the save succeeds', async () => {
    serve(HOME_PAYLOAD);
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('a1', true));

    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));
    expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(true);
  });

  it('adopts what the route echoes back when it disagrees with what was asked', async () => {
    // The route reports it stored `false`; that is the truth, not our assumption.
    serve(HOME_PAYLOAD, () => Promise.resolve(okResponse({ value: false })));
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('a1', true));
    expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(true);

    await waitFor(() =>
      expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(false)
    );
  });

  it('reverts when the save fails, so it never claims something is saved', async () => {
    serve(HOME_PAYLOAD, () => Promise.reject(new Error('network down')));
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('a1', true));
    expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(true);

    await waitFor(() =>
      expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(false)
    );
  });

  it('reverts when the server rejects the save', async () => {
    serve(HOME_PAYLOAD, () => Promise.resolve(serverErrorResponse()));
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('c1', false));
    expect(favoriteIn(result.current.rows, 'Comedy', 'c1')).toBe(false);

    await waitFor(() =>
      expect(favoriteIn(result.current.rows, 'Comedy', 'c1')).toBe(true)
    );
  });

  it('sets the same movie in every genre row it appears in', async () => {
    serve(SHARED_MOVIE_PAYLOAD);
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('x1', true));

    expect(favoriteIn(result.current.rows, 'Action', 'x1')).toBe(true);
    expect(favoriteIn(result.current.rows, 'Thriller', 'x1')).toBe(true);

    // One movie, one save — not one per card.
    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));
  });

  it('reverts the same movie in every genre row when the save fails', async () => {
    serve(SHARED_MOVIE_PAYLOAD, () =>
      Promise.reject(new Error('network down'))
    );
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('x1', true));

    await waitFor(() =>
      expect(favoriteIn(result.current.rows, 'Action', 'x1')).toBe(false)
    );
    expect(favoriteIn(result.current.rows, 'Thriller', 'x1')).toBe(false);
  });
});

describe('useHomeRows — the sort order', () => {
  /** The same library the other way up, as a sorted request would answer it. */
  const SORTED_PAYLOAD: HomePayload = {
    continueWatching: [],
    rows: [
      {
        genre: 'Comedy',
        count: 2,
        movies: [makeMovie({ id: 'c1', title: 'Comet Season' })],
      },
      {
        genre: 'Action',
        count: 3,
        movies: [makeMovie({ id: 'a1', title: 'Northwind' })],
      },
    ],
  };

  it('asks with the order the URL was opened on, so a shared link loads sorted', async () => {
    serve(SORTED_PAYLOAD);

    await loadRows('/?sort=a-z');

    expect(homeRequests()).toHaveLength(1);
    expect(homeQuery(0).get('sort')).toBe('a-z');
  });

  it('asks for the default order when the URL carries no sort', async () => {
    serve(HOME_PAYLOAD);

    await loadRows('/');

    // The plain home needs no parameter to explain what it already does.
    expect(homeQuery(0).has('sort')).toBe(false);
  });

  it('asks again, in the new order, when only the sort changes', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(okResponse(HOME_PAYLOAD))
    );
    fetchMock.mockImplementation(() =>
      Promise.resolve(okResponse(SORTED_PAYLOAD))
    );
    const { result } = await loadRows('/');

    act(() => goTo('/?sort=a-z'));

    await waitFor(() =>
      expect(result.current.rows.map((row) => row.genre)).toEqual([
        'Comedy',
        'Action',
      ])
    );
    expect(homeRequests()).toHaveLength(2);
    expect(homeQuery(1).get('sort')).toBe('a-z');
  });

  it('keeps the rows already on screen while the re-ordered ones load', async () => {
    // Choosing an order is not a reason to blank the screen she is reading.
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(okResponse(HOME_PAYLOAD))
    );
    const { result } = await loadRows('/');

    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    act(() => goTo('/?sort=a-z'));

    await waitFor(() => expect(homeRequests()).toHaveLength(2));
    expect(result.current.status).toBe('ready');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);
  });

  it('asks a sorted search as one request, not one each', async () => {
    serve(SORTED_PAYLOAD);

    await loadRows('/?q=comet&sort=a-z');

    expect(homeRequests()).toHaveLength(1);
    expect(homeQuery(0).get('q')).toBe('comet');
    expect(homeQuery(0).get('sort')).toBe('a-z');
  });

  it('falls back to the default order for a sort it does not recognise', async () => {
    // A hand-edited or stale URL opens the plain home rather than asking the
    // route something it will refuse.
    serve(HOME_PAYLOAD);

    const { result } = await loadRows('/?sort=by-vibes');

    expect(homeQuery(0).has('sort')).toBe(false);
    expect(result.current.status).toBe('ready');
  });

  it('does not reload when the URL changes to a sort meaning the same thing', async () => {
    serve(HOME_PAYLOAD);
    const { result } = await loadRows('/');

    act(() => goTo('/?sort=recently-added'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(homeRequests()).toHaveLength(1);
  });
});

/**
 * 05 — Search + filter, Phase 4: "the Genre dropdown" (issue #36). The genre is
 * read from the URL like every other part of the settled query, and the server
 * is what narrows the screen down to the one row.
 */
describe('useHomeRows — the genre filter', () => {
  /** The library narrowed to one genre, as a filtered request would answer it. */
  const ONE_ROW_PAYLOAD: HomePayload = {
    continueWatching: [],
    rows: [
      {
        genre: 'Action',
        count: 3,
        movies: [makeMovie({ id: 'a1', title: 'Northwind' })],
      },
    ],
  };

  it('asks with the genre the URL was opened on, so a shared link loads filtered', async () => {
    serve(ONE_ROW_PAYLOAD);

    const { result } = await loadRows('/?genre=Action');

    expect(homeRequests()).toHaveLength(1);
    expect(homeQuery(0).get('genre')).toBe('Action');
    expect(result.current.rows.map((row) => row.genre)).toEqual(['Action']);
  });

  it('asks for the whole library when the URL carries no genre', async () => {
    serve(HOME_PAYLOAD);

    await loadRows('/');

    expect(homeQuery(0).has('genre')).toBe(false);
  });

  it('asks again, for the new genre, when only the genre changes', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(okResponse(HOME_PAYLOAD))
    );
    fetchMock.mockImplementation(() =>
      Promise.resolve(okResponse(ONE_ROW_PAYLOAD))
    );
    const { result } = await loadRows('/');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);

    act(() => goTo('/?genre=Action'));

    // One row on screen, because the server built one row — not because this
    // hook hid the others.
    await waitFor(() =>
      expect(result.current.rows.map((row) => row.genre)).toEqual(['Action'])
    );
    expect(homeQuery(1).get('genre')).toBe('Action');
  });

  it('goes back to every row when the genre is cleared', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(okResponse(ONE_ROW_PAYLOAD))
    );
    fetchMock.mockImplementation(() =>
      Promise.resolve(okResponse(HOME_PAYLOAD))
    );
    const { result } = await loadRows('/?genre=Action');

    act(() => goTo('/'));

    await waitFor(() =>
      expect(result.current.rows.map((row) => row.genre)).toEqual([
        'Action',
        'Comedy',
      ])
    );
    expect(homeQuery(1).has('genre')).toBe(false);
  });

  it('keeps the rows already on screen while the filtered ones load', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(okResponse(HOME_PAYLOAD))
    );
    const { result } = await loadRows('/');

    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    act(() => goTo('/?genre=Action'));

    await waitFor(() => expect(homeRequests()).toHaveLength(2));
    expect(result.current.status).toBe('ready');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);
  });

  it('asks a filtered, searched, sorted home as one request', async () => {
    serve(ONE_ROW_PAYLOAD);

    await loadRows('/?q=north&genre=Action&sort=a-z');

    expect(homeRequests()).toHaveLength(1);
    const asked = homeQuery(0);
    expect(asked.get('q')).toBe('north');
    expect(asked.get('genre')).toBe('Action');
    expect(asked.get('sort')).toBe('a-z');
  });

  it('reads an empty ?genre= as no genre, and does not reload for it', async () => {
    serve(HOME_PAYLOAD);
    const { result } = await loadRows('/');

    act(() => goTo('/?genre='));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(homeRequests()).toHaveLength(1);
  });

  it('keeps the row’s own count, so “View all” still reports the genre total', async () => {
    // The row shows one movie of three; the count came from the unfiltered
    // genre and has to survive the trip.
    serve(ONE_ROW_PAYLOAD);

    const { result } = await loadRows('/?genre=Action');

    expect(result.current.rows[0].count).toBe(3);
    expect(result.current.rows[0].movies).toHaveLength(1);
  });
});

// --- 05 — Search + filter, Phase 5: "the Rating dropdown" (issue #37) ---------

describe('useHomeRows — the minimum rating', () => {
  /** The library narrowed to what is well rated, as a filtered request answers it. */
  const HIGHLY_RATED_PAYLOAD: HomePayload = {
    continueWatching: [],
    rows: [
      {
        genre: 'Action',
        count: 3,
        movies: [makeMovie({ id: 'a1', title: 'Northwind', rating: 9 })],
      },
    ],
  };

  it('asks with the minimum the URL was opened on, so a shared link loads filtered', async () => {
    serve(HIGHLY_RATED_PAYLOAD);

    const { result } = await loadRows('/?rating=8');

    expect(homeRequests()).toHaveLength(1);
    expect(homeQuery(0).get('rating')).toBe('8');
    expect(result.current.rows.map((row) => row.genre)).toEqual(['Action']);
  });

  it('asks for the whole library when the URL carries no minimum', async () => {
    serve(HOME_PAYLOAD);

    await loadRows('/');

    expect(homeQuery(0).has('rating')).toBe(false);
  });

  it('asks for no minimum when the URL carries one the dropdown never wrote', async () => {
    // The header's pill would read "All ratings" for this URL; the request has
    // to agree with it, or the screen contradicts itself.
    serve(HOME_PAYLOAD);

    await loadRows('/?rating=7');

    expect(homeQuery(0).has('rating')).toBe(false);
  });

  it('asks for no minimum when the URL carries a nought', async () => {
    serve(HOME_PAYLOAD);

    await loadRows('/?rating=0');

    expect(homeQuery(0).has('rating')).toBe(false);
  });

  it('asks again, for the new minimum, when only the rating changes', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(okResponse(HOME_PAYLOAD))
    );
    fetchMock.mockImplementation(() =>
      Promise.resolve(okResponse(HIGHLY_RATED_PAYLOAD))
    );
    const { result } = await loadRows('/');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);

    act(() => goTo('/?rating=8'));

    await waitFor(() =>
      expect(result.current.rows.map((row) => row.genre)).toEqual(['Action'])
    );
    expect(homeQuery(1).get('rating')).toBe('8');
  });

  it('goes back to the whole library when the minimum is cleared', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(okResponse(HIGHLY_RATED_PAYLOAD))
    );
    fetchMock.mockImplementation(() =>
      Promise.resolve(okResponse(HOME_PAYLOAD))
    );
    const { result } = await loadRows('/?rating=8');

    act(() => goTo('/'));

    await waitFor(() =>
      expect(result.current.rows.map((row) => row.genre)).toEqual([
        'Action',
        'Comedy',
      ])
    );
    expect(homeQuery(1).has('rating')).toBe(false);
  });

  it('keeps the rows already on screen while the rated ones load', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(okResponse(HOME_PAYLOAD))
    );
    const { result } = await loadRows('/');

    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    act(() => goTo('/?rating=8'));

    await waitFor(() => expect(homeRequests()).toHaveLength(2));
    expect(result.current.status).toBe('ready');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);
  });

  it('does not reload when a parameter it does not read changes', async () => {
    serve(HOME_PAYLOAD);
    await loadRows('/?rating=8');

    act(() => goTo('/?rating=8&scroll=120'));

    await waitFor(() => expect(homeRequests()).toHaveLength(1));
  });

  it('asks a rated, filtered, searched, sorted home as one request', async () => {
    serve(HIGHLY_RATED_PAYLOAD);

    await loadRows('/?q=comet&genre=Action&sort=a-z&rating=8');

    expect(homeRequests()).toHaveLength(1);
    const asked = homeQuery(0);
    expect(asked.get('q')).toBe('comet');
    expect(asked.get('genre')).toBe('Action');
    expect(asked.get('sort')).toBe('a-z');
    expect(asked.get('rating')).toBe('8');
  });
});
