import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { saveEpisodeWatched } from './saveEpisodeWatched';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 22 — Series (TV), Phase 3 (issue #193): one episode's watched mark on the
 * wire — `POST /api/episodes/:id/watched { value }`, a **Single-signal write**
 * on `saveWatched`'s shape. It sits in `api/` because two features save it:
 * the season page's watched box and the player's _Play now_.
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

describe('saveEpisodeWatched', () => {
  it('POSTs the new value as JSON to the episode’s watched route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: true }));

    await saveEpisodeWatched('s2e4', true);

    const request = onlyRequest();
    expect(request.url).toBe('/api/episodes/s2e4/watched');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.contentType).toMatch(/application\/json/i);
    expect(request.body).toEqual({ value: true });
  });

  it('encodes an id that would otherwise break the path', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: false }));

    await saveEpisodeWatched('a/1 b', false);

    expect(onlyRequest().url).toBe('/api/episodes/a%2F1%20b/watched');
  });

  it('answers with the value the route says it stored', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: false }));

    await expect(saveEpisodeWatched('s2e4', true)).resolves.toBe(false);
  });

  it('throws when the save does not succeed', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(saveEpisodeWatched('s2e4', true)).rejects.toThrow(/500/);
  });
});
