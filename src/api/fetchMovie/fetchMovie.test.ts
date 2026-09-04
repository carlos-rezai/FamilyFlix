import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchMovie } from './fetchMovie';
import type { Movie } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 10 — Video player, Phase 3: the promotion (issue #85).
 *
 * The call itself does not change — these are the cases that were passing in
 * `features/movie-detail/api/api.test.ts`, moved with the module they cover.
 * What changed is who asks: the player needs the film's title and its artwork
 * for the chrome and the blurred backdrop, and CLAUDE.md's `api/` rule says a
 * wire call moves up to this rung the moment a second feature wants it — which
 * is the same rule that put `saveFavorite` here and left `saveRating` behind.
 *
 * The alternative was the player reaching into the movie detail feature's
 * `api/`, and that is precisely the import this rung exists to prevent.
 */
function makeQuietHarbor(overrides: Partial<Movie> = {}): Movie {
  return makeMovie({
    title: 'The Quiet Harbor',
    year: 2016,
    runtimeMinutes: 111,
    synopsis: 'A lighthouse keeper on a fading coast takes in a runaway girl.',
    director: 'Ana Sørensen',
    cast: ['Marit Holt', 'Peder Vinge'],
    rating: 7,
    videoPath: 'The Quiet Harbor (2016)/the-quiet-harbor.mkv',
    ...overrides,
  });
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
    const movie = makeQuietHarbor();
    fetchMock.mockResolvedValue(okResponse(movie));

    const loaded = await fetchMovie('m1');

    expect(onlyRequestUrl()).toBe('/api/movies/m1');
    expect(loaded).toEqual(movie);
  });

  it('encodes an id that would otherwise break the path', async () => {
    fetchMock.mockResolvedValue(okResponse(makeQuietHarbor()));

    await fetchMovie('a/1 b');

    expect(onlyRequestUrl()).toBe('/api/movies/a%2F1%20b');
  });

  it('answers with no movie when the route says there is none', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('Unknown movie: gone'));

    // A movie that is gone is an outcome, not a failure — this resolution is
    // what makes the detail page's `not-found` state reachable, and it is what
    // the player leans on too.
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
