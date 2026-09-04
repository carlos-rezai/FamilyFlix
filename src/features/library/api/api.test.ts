import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchGenrePayload, fetchHomePayload } from './api';
import type {
  GenrePayload,
  GenreQuery,
  HomePayload,
  LibraryQuery,
  Movie,
} from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/** The query an unfiltered browse home asks with — every part at its default. */
const UNFILTERED: LibraryQuery = { sort: 'recently-added' };

/** The named-section envelope `GET /api/home` answers with (issue #18). */
const HOME_PAYLOAD: HomePayload = {
  continueWatching: [],
  favorites: [],
  rows: [{ genre: 'Action', count: 3, movies: [] }],
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
    const started: Movie = makeMovie({
      id: 'p1',
      title: 'Halfway',
      resumePositionSeconds: 600,
      status: 'in-progress',
    });
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

// --- 06 — Genre page, Phase 4: "the screen loads a real genre" (issue #47) ---

/** The query a plain genre page asks with — both parts at their defaults. */
const PLAIN_GENRE: GenreQuery = { sort: 'recently-added' };

/**
 * One genre in full, as `GET /api/genre/:name` answers it: the name as it was
 * asked for, the genre's **unfiltered** total, and the uncapped list.
 */
const GENRE_PAYLOAD: GenrePayload = {
  genre: 'Action',
  total: 214,
  movies: [makeMovie({ id: 'a1', title: 'Northwind' })],
};

describe('fetchGenrePayload', () => {
  it('GETs the genre aggregate and returns the payload it answers with', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_PAYLOAD));

    const payload = await fetchGenrePayload('Action', PLAIN_GENRE);

    expect(onlyRequest().url).toBe('/api/genre/Action');
    expect(payload).toEqual(GENRE_PAYLOAD);
  });

  it('carries the whole screen — name, total and the uncapped list — in one answer', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_PAYLOAD));

    const payload = await fetchGenrePayload('Action', PLAIN_GENRE);

    expect(payload.genre).toBe('Action');
    expect(payload.total).toBe(214);
    expect(payload.movies.map((movie) => movie.title)).toEqual(['Northwind']);
  });

  it('throws when the route does not answer OK', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchGenrePayload('Action', PLAIN_GENRE)).rejects.toThrow(
      /500/
    );
  });
});

describe('fetchGenrePayload — asking for one genre', () => {
  /** The query string the one request carried, parsed rather than matched. */
  function requestedQuery(): URLSearchParams {
    return new URLSearchParams(onlyRequest().url.split('?')[1] ?? '');
  }

  it('asks a clean URL when nothing narrows the genre', async () => {
    // Both parameters are omitted at their defaults, so the request matches the
    // clean `/genre/Action` the parent is looking at.
    fetchMock.mockResolvedValue(okResponse(GENRE_PAYLOAD));

    await fetchGenrePayload('Action', PLAIN_GENRE);

    expect(onlyRequest().url).toBe('/api/genre/Action');
  });

  it('carries the genre in the path, never as a parameter', async () => {
    // It is which screen this is, not a filter within it — the same way the app
    // URL spells it.
    fetchMock.mockResolvedValue(okResponse(GENRE_PAYLOAD));

    await fetchGenrePayload('Action', { ...PLAIN_GENRE, search: 'north' });

    expect(requestedQuery().has('genre')).toBe(false);
  });

  it('encodes a genre name with a space into the path', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ ...GENRE_PAYLOAD, genre: 'Science Fiction' })
    );

    await fetchGenrePayload('Science Fiction', PLAIN_GENRE);

    expect(onlyRequest().url).toBe('/api/genre/Science%20Fiction');
  });

  it('encodes a genre name that would otherwise break the path', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_PAYLOAD));

    await fetchGenrePayload('Action/Adventure', PLAIN_GENRE);

    expect(onlyRequest().url).toBe('/api/genre/Action%2FAdventure');
  });

  it('carries the search text to the route as “q”', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_PAYLOAD));

    await fetchGenrePayload('Action', { ...PLAIN_GENRE, search: 'lighthouse' });

    expect(requestedQuery().get('q')).toBe('lighthouse');
  });

  it('omits “q” entirely when the query holds no search text', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_PAYLOAD));

    await fetchGenrePayload('Action', { ...PLAIN_GENRE, search: undefined });

    expect(requestedQuery().has('q')).toBe(false);
  });

  it('encodes a term that would otherwise break the query string', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_PAYLOAD));

    await fetchGenrePayload('Action', {
      ...PLAIN_GENRE,
      search: 'comet & season',
    });

    expect(onlyRequest().url).not.toContain('comet & season');
    expect(requestedQuery().get('q')).toBe('comet & season');
  });

  it('carries the chosen order to the route as “sort”', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_PAYLOAD));

    await fetchGenrePayload('Action', { sort: 'a-z' });

    expect(requestedQuery().get('sort')).toBe('a-z');
  });

  it('omits “sort” at the default order, so a plain genre is a clean request', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_PAYLOAD));

    await fetchGenrePayload('Action', { sort: 'recently-added' });

    expect(onlyRequest().url).toBe('/api/genre/Action');
  });

  it('never asks for a rating, which this screen has no control for', async () => {
    // The URL and the screen must agree: a filter with nothing on screen to
    // show it with is a filter the request must not carry.
    fetchMock.mockResolvedValue(okResponse(GENRE_PAYLOAD));

    await fetchGenrePayload('Action', { sort: 'a-z', search: 'north' });

    expect(requestedQuery().has('rating')).toBe(false);
  });

  it('asks a searched, sorted genre as one request, not two', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_PAYLOAD));

    await fetchGenrePayload('Science Fiction', {
      sort: 'a-z',
      search: 'quiet',
    });

    const request = onlyRequest();
    expect(request.url.split('?')[0]).toBe('/api/genre/Science%20Fiction');
    expect(requestedQuery().get('q')).toBe('quiet');
    expect(requestedQuery().get('sort')).toBe('a-z');
  });
});
