import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchHomePayload, saveFavorite } from './api';
import type { HomePayload, Movie } from '@/types';

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

    const payload = await fetchHomePayload();

    expect(onlyRequest().url).toBe('/api/home');
    expect(payload).toEqual(HOME_PAYLOAD);
  });

  it('carries both named sections, not a bare row array', async () => {
    const started: Movie = makeMovie({ id: 'p1', title: 'Halfway' });
    fetchMock.mockResolvedValue(
      okResponse({ ...HOME_PAYLOAD, continueWatching: [started] })
    );

    const payload = await fetchHomePayload();

    expect(payload.continueWatching.map((movie) => movie.title)).toEqual([
      'Halfway',
    ]);
    expect(payload.rows.map((row) => row.genre)).toEqual(['Action']);
  });

  it('throws when the route does not answer OK', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchHomePayload()).rejects.toThrow(/500/);
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
