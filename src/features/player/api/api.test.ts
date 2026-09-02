import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchPlayback, fetchSubtitleCues, saveResume } from './api';
import type { Cue, PlaybackRead } from '@/types';

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

/**
 * 10 — Video player, Phase 5: "watching writes" (issue #87).
 *
 * The **Watch tick** on the wire. It is the same contract `saveFavorite` and
 * `saveWatched` keep — POST the value, take the route's echo as the truth,
 * reject on anything but a 2xx — with one addition nothing else needs:
 * `keepalive`, so the write the player makes on its way out survives the screen
 * being torn down around it.
 *
 * It stays in `features/player/api/` rather than moving up beside
 * `saveWatched`: the player is the only thing in the app that can know where a
 * film is, which is CLAUDE.md's `api/` rule read the other way round.
 */

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
    keepalive: init?.keepalive,
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

describe('saveResume', () => {
  it('POSTs the position as JSON to the movie’s resume route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 1840 }));

    await saveResume('m1', 1840);

    const request = onlyRequest();
    expect(request.url).toBe('/api/movies/m1/resume');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.contentType).toMatch(/application\/json/i);
    expect(request.body).toEqual({ value: 1840 });
  });

  it('encodes an id that would otherwise break the path', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 1840 }));

    await saveResume('a/1 b', 1840);

    expect(onlyRequest().url).toBe('/api/movies/a%2F1%20b/resume');
  });

  it('answers with the second the route says it stored, not the one asked for', async () => {
    // The route stores whole seconds; the player reports the position with the
    // fraction the element gave it. The echo is the row's truth.
    fetchMock.mockResolvedValue(okResponse({ value: 1841 }));

    await expect(saveResume('m1', 1840.6)).resolves.toBe(1841);
  });

  it('falls back to the requested position when the route echoes nothing usable', async () => {
    fetchMock.mockResolvedValue(okResponse({}));

    await expect(saveResume('m1', 1840)).resolves.toBe(1840);
  });

  it('is an ordinary request unless the caller says otherwise', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 1840 }));

    await saveResume('m1', 1840);

    // Every tick during playback is a normal fetch. `keepalive` is for the one
    // write that has to outlive the page, and asking for it on all of them
    // would spend that budget on writes nothing is racing.
    expect(onlyRequest().keepalive).toBeFalsy();
  });

  it('survives the screen going away when the exit write asks it to', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 1840 }));

    await saveResume('m1', 1840, { keepalive: true });

    expect(onlyRequest().keepalive).toBe(true);
  });

  it('throws when the save does not succeed', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(saveResume('m1', 1840)).rejects.toThrow(/500/);
  });
});

/**
 * 10 — Video player, Phase 6: "subtitles" (issue #88).
 *
 * The **Cue list** on the wire, fetched once when subtitles are switched on and
 * held for the session — the film does not re-ask on every seek, because the
 * cues are stamped in **Absolute position** and there is nothing about a seek
 * for them to be re-stamped against.
 *
 * Its 404 is the interesting case, and it resolves rather than rejects: a
 * subtitle row whose file has gone is a film that plays on without subtitles,
 * which is the acceptance criterion in one sentence. Swallowing it here rather
 * than in the screen keeps the screen with one path for "no cues" and no error
 * state to draw. A 500 still rejects, exactly as `fetchPlayback` treats one — a
 * backend hiccup is not a missing track, and collapsing them would hide a
 * server falling over behind a film that quietly has no subtitles.
 */
const CUES: Cue[] = [
  { start: 1, end: 4, text: '— You can see the whole coast from up here.' },
  { start: 5.5, end: 8.25, text: 'It was worth the walk.' },
];

describe('fetchSubtitleCues', () => {
  it('GETs the subtitle’s cue list and returns what it answers', async () => {
    fetchMock.mockResolvedValue(okResponse(CUES));

    const cues = await fetchSubtitleCues('m1', 's2');

    expect(onlyRequestUrl()).toBe('/api/movies/m1/subtitles/s2');
    expect(cues).toEqual(CUES);
  });

  it('encodes both ids, so neither can change the URL’s shape', async () => {
    fetchMock.mockResolvedValue(okResponse(CUES));

    await fetchSubtitleCues('a/1 b', 's/2');

    expect(onlyRequestUrl()).toBe('/api/movies/a%2F1%20b/subtitles/s%2F2');
  });

  it('answers an empty cue list when the route says there is no such subtitle', async () => {
    fetchMock.mockResolvedValue(notFoundResponse());

    // No subtitles is a thing the screen already draws — no box — so there is
    // nothing here for the film to trip over.
    await expect(fetchSubtitleCues('m1', 's2')).resolves.toEqual([]);
  });

  it('passes through the empty list a file that would not parse answers with', async () => {
    // The route answers `200 []` for a malformed file rather than an error, and
    // this call has nothing to add: same empty list, same silent film.
    fetchMock.mockResolvedValue(okResponse([]));

    await expect(fetchSubtitleCues('m1', 's2')).resolves.toEqual([]);
  });

  it('fails on any other unsuccessful response, rather than reading as absent', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchSubtitleCues('m1', 's2')).rejects.toThrow(/500/);
  });

  it('fails when the request itself cannot be made', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchSubtitleCues('m1', 's2')).rejects.toThrow();
  });
});
