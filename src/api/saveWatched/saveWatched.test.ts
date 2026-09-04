import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { saveWatched } from './saveWatched';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 10 — Video player, Phase 5: "watching writes" (issue #87).
 *
 * These tests moved here from `features/movie-detail/api/api.test.ts` along
 * with the call itself. CLAUDE.md's `api/` rule says a wire call comes up to
 * this rung "when a second feature asks for it", and named `saveWatched` as
 * having one caller and staying put "if and when that changes". The player is
 * that change: crossing the **Finish threshold** marks a film watched through
 * this same route, and neither feature should be importing the other's wire.
 *
 * The contract itself is unchanged — POST the value, take the route's echo as
 * the truth, reject on anything but a 2xx — which is why these are the same
 * tests rather than new ones.
 */

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

describe('saveWatched', () => {
  it('POSTs the new value as JSON to the movie’s watched route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: true }));

    await saveWatched('m1', true);

    const request = onlyRequest();
    expect(request.url).toBe('/api/movies/m1/watched');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.contentType).toMatch(/application\/json/i);
    expect(request.body).toEqual({ value: true });
  });

  it('sends false to un-mark a movie, rather than a second route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: false }));

    await saveWatched('m1', false);

    const request = onlyRequest();
    expect(request.url).toBe('/api/movies/m1/watched');
    expect(request.body).toEqual({ value: false });
  });

  it('encodes an id that would otherwise break the path', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: true }));

    await saveWatched('a/1 b', true);

    expect(onlyRequest().url).toBe('/api/movies/a%2F1%20b/watched');
  });

  it('answers with the value the route says it stored, not the one asked for', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: false }));

    await expect(saveWatched('m1', true)).resolves.toBe(false);
  });

  it('falls back to the requested value when the route echoes nothing usable', async () => {
    fetchMock.mockResolvedValue(okResponse({}));

    await expect(saveWatched('m1', true)).resolves.toBe(true);
  });

  it('throws when the save does not succeed', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    // The rejection is the toggle's cue to revert — a save that quietly
    // resolved would leave the circle filled over nothing.
    await expect(saveWatched('m1', true)).rejects.toThrow(/500/);
  });

  it('throws when the request itself cannot be made', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(saveWatched('m1', true)).rejects.toThrow();
  });
});
