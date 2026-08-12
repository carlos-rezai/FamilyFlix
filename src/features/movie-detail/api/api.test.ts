import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchMovie } from './api';
import type { Movie } from '@/types';

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'm1',
    tmdbId: null,
    title: 'The Quiet Harbor',
    year: 2016,
    runtimeMinutes: 111,
    synopsis: 'A lighthouse keeper on a fading coast takes in a runaway girl.',
    director: 'Ana Sørensen',
    cast: ['Marit Holt', 'Peder Vinge'],
    rating: 7,
    isFavorite: false,
    watched: false,
    resumePositionSeconds: 0,
    status: 'unwatched',
    videoPath: 'The Quiet Harbor (2016)/the-quiet-harbor.mkv',
    posterPath: null,
    backdropPath: null,
    genres: [],
    subtitles: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function notFoundResponse(): Response {
  return {
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: 'Unknown movie: gone' }),
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

/** The one request that was issued, as the url it went to. */
function onlyRequestUrl(): string {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [input] = fetchMock.mock.calls[0];
  return String(input);
}

describe('fetchMovie', () => {
  it('GETs the movie by id and returns the record it answers with', async () => {
    const movie = makeMovie();
    fetchMock.mockResolvedValue(okResponse(movie));

    const loaded = await fetchMovie('m1');

    expect(onlyRequestUrl()).toBe('/api/movies/m1');
    expect(loaded).toEqual(movie);
  });

  it('encodes an id that would otherwise break the path', async () => {
    fetchMock.mockResolvedValue(okResponse(makeMovie()));

    await fetchMovie('a/1 b');

    expect(onlyRequestUrl()).toBe('/api/movies/a%2F1%20b');
  });

  it('answers with no movie when the route says there is none', async () => {
    fetchMock.mockResolvedValue(notFoundResponse());

    // A movie that is gone is an outcome, not a failure — this resolution is
    // the only thing that makes the page's `not-found` state reachable.
    await expect(fetchMovie('gone')).resolves.toBeNull();
  });

  it('fails on any other unsuccessful response, rather than reading as absent', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchMovie('m1')).rejects.toThrow(/500/);
  });

  it('fails when the request itself cannot be made', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    // The offline case has to stay distinguishable from a 404: one earns a
    // Retry, the other earns a way back to the library.
    await expect(fetchMovie('m1')).rejects.toThrow();
  });
});
