import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { saveRating } from './api';
import {
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

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

/**
 * The rating write, the last call this feature still owns, keeping the same
 * contract as `saveWatched` and `saveFavorite` — POST the value, take the route's echo as the truth,
 * reject on anything but a 2xx. One thing is its own: the value it carries is
 * `number | null`, so a `null` echo is a route *saying it cleared the rating*
 * rather than a route that answered with nothing usable. Confusing the two
 * would let a failed clear read as a successful one.
 */
describe('saveRating', () => {
  it('POSTs the new value as JSON to the movie’s rating route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 8 }));

    await saveRating('m1', 8);

    const request = onlyRequest();
    expect(request.url).toBe('/api/movies/m1/rating');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.contentType).toMatch(/application\/json/i);
    expect(request.body).toEqual({ value: 8 });
  });

  it('sends stored units, both ends of the scale included', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 10 }));

    await saveRating('m1', 10);

    expect(onlyRequest().body).toEqual({ value: 10 });
  });

  it('sends null to clear a rating, rather than reaching for a second route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: null }));

    await saveRating('m1', null);

    const request = onlyRequest();
    expect(request.url).toBe('/api/movies/m1/rating');
    expect(request.body).toEqual({ value: null });
  });

  it('encodes an id that would otherwise break the path', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 8 }));

    await saveRating('a/1 b', 8);

    expect(onlyRequestUrl()).toBe('/api/movies/a%2F1%20b/rating');
  });

  it('answers with the value the route says it stored, not the one asked for', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 6 }));

    await expect(saveRating('m1', 8)).resolves.toBe(6);
  });

  it('answers null when the route says it cleared the rating', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: null }));

    await expect(saveRating('m1', null)).resolves.toBeNull();
  });

  it('takes a null echo as a clear even when a number was sent', async () => {
    // `null` is a value this route can legitimately store, so it is an echo to
    // be believed — not the absent field the fallback below is for.
    fetchMock.mockResolvedValue(okResponse({ value: null }));

    await expect(saveRating('m1', 8)).resolves.toBeNull();
  });

  it('falls back to the requested value when the route echoes nothing usable', async () => {
    fetchMock.mockResolvedValue(okResponse({}));

    await expect(saveRating('m1', 8)).resolves.toBe(8);
  });

  it('falls back to a requested clear when the route echoes nothing usable', async () => {
    fetchMock.mockResolvedValue(okResponse({}));

    await expect(saveRating('m1', null)).resolves.toBeNull();
  });

  it('throws when the save does not succeed', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    // The rejection is the picker’s cue to put the old stars back — a save
    // that quietly resolved would leave a rating on screen that isn’t stored.
    await expect(saveRating('m1', 8)).rejects.toThrow(/500/);
  });

  it('throws when the movie the rating was for is gone', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('Unknown movie: gone'));

    await expect(saveRating('gone', 8)).rejects.toThrow(/404/);
  });

  it('throws when the request itself cannot be made', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(saveRating('m1', 8)).rejects.toThrow();
  });
});
