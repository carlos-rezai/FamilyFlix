import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { saveSeriesFavorite } from './saveSeriesFavorite';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 22 — Series (TV), Phase 2 (issue #192): the series' heart on the wire —
 * `POST /api/series/:id/favorite { value }`, a **Single-signal write**. It sits
 * in `api/` beside `saveFavorite` because two features save it: the Series
 * tab's Poster card and the series page.
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

describe('saveSeriesFavorite', () => {
  it('POSTs the new value as JSON to the series’ favorite route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: true }));

    await saveSeriesFavorite('harbor', true);

    const request = onlyRequest();
    expect(request.url).toBe('/api/series/harbor/favorite');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.contentType).toMatch(/application\/json/i);
    expect(request.body).toEqual({ value: true });
  });

  it('encodes an id that would otherwise break the path', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: false }));

    await saveSeriesFavorite('a/1 b', false);

    expect(onlyRequest().url).toBe('/api/series/a%2F1%20b/favorite');
  });

  it('answers with the value the route says it stored', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: false }));

    await expect(saveSeriesFavorite('harbor', true)).resolves.toBe(false);
  });

  it('throws when the save does not succeed', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(saveSeriesFavorite('harbor', true)).rejects.toThrow(/500/);
  });
});
