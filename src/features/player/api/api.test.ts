import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchPlayback } from './api';
import type { PlaybackRead } from '@/types';

/**
 * 10 — Video player, Phase 3: "the playback read" (issue #85).
 *
 * The **Playback read** is fetched once when the player opens, and it is the
 * one place the scrubber's duration and the chosen **Playback path** come from
 * — the file's own answer, never the movie record's rounded `runtimeMinutes`
 * and never the element's `duration`, which is a lie on a live transcode.
 *
 * The 404 is the interesting case: a film with no file behind it has no
 * duration to report, and the screen has a message for exactly that. Resolving
 * `null` rather than rejecting is what keeps the missing-file notice apart from
 * "the request went wrong", the same way `fetchMovie`'s `null` keeps
 * `not-found` apart from `error`.
 */
const DIRECT_PLAY: PlaybackRead = { path: 'direct', durationSeconds: 6832.5 };

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
    json: () => Promise.resolve({ error: 'No video file for movie: m1' }),
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

describe('fetchPlayback', () => {
  it('GETs the film’s playback read and returns what it answers', async () => {
    fetchMock.mockResolvedValue(okResponse(DIRECT_PLAY));

    const read = await fetchPlayback('m1');

    expect(onlyRequestUrl()).toBe('/api/movies/m1/playback');
    expect(read).toEqual(DIRECT_PLAY);
  });

  it('encodes an id that would otherwise change the URL’s shape', async () => {
    fetchMock.mockResolvedValue(okResponse(DIRECT_PLAY));

    await fetchPlayback('a/1 b');

    expect(onlyRequestUrl()).toBe('/api/movies/a%2F1%20b/playback');
  });

  it('answers with nothing to play when the route says there is none', async () => {
    fetchMock.mockResolvedValue(notFoundResponse());

    // A film whose file is missing is a state the player draws, not a failure
    // it reports. `null` is what the missing-file notice is reached through.
    await expect(fetchPlayback('m1')).resolves.toBeNull();
  });

  it('fails on any other unsuccessful response, rather than reading as absent', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    // A 500 is not a film with no file. Collapsing the two would tell the
    // family their film is missing every time the server hiccups.
    await expect(fetchPlayback('m1')).rejects.toThrow(/500/);
  });

  it('fails when the request itself cannot be made', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchPlayback('m1')).rejects.toThrow();
  });
});
