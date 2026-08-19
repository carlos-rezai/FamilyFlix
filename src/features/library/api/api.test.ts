import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchHomePayload, saveFavorite } from './api';
import type { HomePayload, LibraryQuery, Movie } from '@/types';

/** The query an unfiltered browse home asks with — every part at its default. */
const UNFILTERED: LibraryQuery = { sort: 'recently-added' };

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
    resumePositionSeconds: 600,
    status: 'in-progress',
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

/** The named-section envelope `GET /api/home` answers with (issue #18). */
const HOME_PAYLOAD: HomePayload = {
  continueWatching: [],
  rows: [{ genre: 'Action', count: 3, movies: [] }],
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

/** The one request that was issued, as url plus the init it carried. */
function onlyRequest() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [input, init] = fetchMock.mock.calls[0];
  return {
    url: String(input),
    method: init?.method,
    contentType: (init?.headers as Record<string, string> | undefined)?.[
      'Content-Type'
    ],
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

describe('fetchHomePayload', () => {
  it('GETs the home aggregate and returns the payload it answers with', async () => {
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    const payload = await fetchHomePayload(UNFILTERED);

    expect(onlyRequest().url).toBe('/api/home');
    expect(payload).toEqual(HOME_PAYLOAD);
  });

  it('carries both named sections, not a bare row array', async () => {
    const started: Movie = makeMovie({ id: 'p1', title: 'Halfway' });
    fetchMock.mockResolvedValue(
      okResponse({ ...HOME_PAYLOAD, continueWatching: [started] })
    );

    const payload = await fetchHomePayload(UNFILTERED);

    expect(payload.continueWatching.map((movie) => movie.title)).toEqual([
      'Halfway',
    ]);
    expect(payload.rows.map((row) => row.genre)).toEqual(['Action']);
  });

  it('throws when the route does not answer OK', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchHomePayload(UNFILTERED)).rejects.toThrow(/500/);
  });
});

describe('fetchHomePayload — asking for a narrowed library', () => {
  /** The query string the one request carried, parsed rather than matched. */
  function requestedQuery(): URLSearchParams {
    return new URLSearchParams(onlyRequest().url.split('?')[1] ?? '');
  }

  it('asks a clean “/api/home” when nothing narrows the library', async () => {
    // Every parameter is omitted at its default, so the request matches the
    // clean “/” the parent is looking at.
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload(UNFILTERED);

    expect(onlyRequest().url).toBe('/api/home');
  });

  it('carries the search text to the route as “q”', async () => {
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload({ ...UNFILTERED, search: 'lighthouse' });

    expect(requestedQuery().get('q')).toBe('lighthouse');
  });

  it('encodes a term that would otherwise break the query string', async () => {
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload({ ...UNFILTERED, search: 'comet & season' });

    expect(onlyRequest().url).not.toContain('comet & season');
    expect(requestedQuery().get('q')).toBe('comet & season');
  });

  it('omits “q” entirely when the query holds no search text', async () => {
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload({ ...UNFILTERED, search: undefined });

    expect(requestedQuery().has('q')).toBe(false);
  });
});

describe('fetchHomePayload — asking for a sorted library', () => {
  /** The query string the one request carried, parsed rather than matched. */
  function requestedQuery(): URLSearchParams {
    return new URLSearchParams(onlyRequest().url.split('?')[1] ?? '');
  }

  it('carries the chosen order to the route as “sort”', async () => {
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload({ sort: 'a-z' });

    expect(requestedQuery().get('sort')).toBe('a-z');
  });

  it('carries each of the orders the dropdown offers', async () => {
    for (const sort of [
      'a-z',
      'year',
      'highest-rated',
      'unwatched-first',
    ] as const) {
      fetchMock.mockClear();
      fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

      await fetchHomePayload({ sort });

      expect(requestedQuery().get('sort')).toBe(sort);
    }
  });

  it('omits “sort” at the default order, so the plain home is a clean request', async () => {
    // Recently-added is what the route already does; saying so adds nothing
    // but noise to the request the parent is looking at.
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload(UNFILTERED);

    expect(onlyRequest().url).toBe('/api/home');
  });

  it('asks a sorted search as one request, not two', async () => {
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload({ sort: 'a-z', search: 'comet' });

    const requested = requestedQuery();
    expect(requested.get('q')).toBe('comet');
    expect(requested.get('sort')).toBe('a-z');
  });
});

describe('saveFavorite', () => {
  it('POSTs the new value as JSON to the movie’s favorite route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: true }));

    await saveFavorite('a1', true);

    const request = onlyRequest();
    expect(request.url).toBe('/api/movies/a1/favorite');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.contentType).toMatch(/application\/json/i);
    expect(request.body).toEqual({ value: true });
  });

  it('encodes an id that would otherwise break the path', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: true }));

    await saveFavorite('a/1 b', true);

    expect(onlyRequest().url).toBe('/api/movies/a%2F1%20b/favorite');
  });

  it('answers with the value the route says it stored, not the one asked for', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: false }));

    await expect(saveFavorite('a1', true)).resolves.toBe(false);
  });

  it('falls back to the requested value when the route echoes nothing usable', async () => {
    fetchMock.mockResolvedValue(okResponse({}));

    await expect(saveFavorite('a1', true)).resolves.toBe(true);
  });

  it('throws when the save does not succeed', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(saveFavorite('a1', true)).rejects.toThrow(/500/);
  });
});

/**
 * 05 — Search + filter, Phase 4: "the Genre dropdown" (issue #36). `genre`
 * joins the query on the wire under the same name the app URL uses.
 */
describe('fetchHomePayload — the genre', () => {
  /** The query string of the single request that was issued, parsed. */
  function requestedQuery(): URLSearchParams {
    return new URLSearchParams(onlyRequest().url.split('?')[1] ?? '');
  }

  it('asks for the genre the query is carrying', async () => {
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload({ ...UNFILTERED, genre: 'Drama' });

    expect(requestedQuery().get('genre')).toBe('Drama');
  });

  it('omits the parameter when no genre is set', async () => {
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload(UNFILTERED);

    // "All Genres" is the absence of the filter, so it asks a clean URL.
    expect(onlyRequest().url).toBe('/api/home');
  });

  it('encodes a genre name that would otherwise break the query string', async () => {
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload({ ...UNFILTERED, genre: 'Science Fiction' });

    expect(onlyRequest().url).not.toContain('Science Fiction');
    expect(requestedQuery().get('genre')).toBe('Science Fiction');
  });

  it('asks a filtered, searched, sorted home as one request', async () => {
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload({ sort: 'a-z', search: 'comet', genre: 'Drama' });

    const requested = requestedQuery();
    expect(requested.get('q')).toBe('comet');
    expect(requested.get('genre')).toBe('Drama');
    expect(requested.get('sort')).toBe('a-z');
  });
});

// --- 05 — Search + filter, Phase 5: "the Rating dropdown" (issue #37) ---------

describe('fetchHomePayload — the minimum rating', () => {
  /** The query string of the single request that was issued, parsed. */
  function requestedQuery(): URLSearchParams {
    return new URLSearchParams(onlyRequest().url.split('?')[1] ?? '');
  }

  it('asks for the minimum the query is carrying, under the wire name', async () => {
    // `minRating` is the domain name; `rating` is what the app URL and the
    // route both spell it.
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload({ ...UNFILTERED, minRating: 6 });

    expect(requestedQuery().get('rating')).toBe('6');
  });

  it('omits the parameter when no minimum is set', async () => {
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload(UNFILTERED);

    // "All ratings" is the absence of the filter, so it asks a clean URL.
    expect(onlyRequest().url).toBe('/api/home');
  });

  it('omits the parameter for a minimum of nought', async () => {
    // A zero minimum would exclude every unrated movie; "All ratings" means
    // asking for no minimum at all.
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload({ ...UNFILTERED, minRating: 0 });

    expect(onlyRequest().url).toBe('/api/home');
  });

  it('asks a rated, filtered, searched, sorted home as one request', async () => {
    fetchMock.mockResolvedValue(okResponse(HOME_PAYLOAD));

    await fetchHomePayload({
      sort: 'a-z',
      search: 'comet',
      genre: 'Drama',
      minRating: 8,
    });

    const requested = requestedQuery();
    expect(requested.get('q')).toBe('comet');
    expect(requested.get('genre')).toBe('Drama');
    expect(requested.get('sort')).toBe('a-z');
    expect(requested.get('rating')).toBe('8');
  });
});
