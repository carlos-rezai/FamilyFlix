import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { saveStartTab } from './saveStartTab';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 49 — Start on Series, Phase 4 (issue #429): `saveTmdbRatings`' twin. The
 * contract is `postValue`'s (POST the value, take the route's echo as the
 * truth, reject on anything but a 2xx) over the `start-tab` route, whose echo
 * is a **Library tab** and nothing looser.
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

describe('saveStartTab', () => {
  it('POSTs the chosen tab as JSON to the start-tab route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 'series' }));

    await saveStartTab('series');

    const request = onlyRequest();
    expect(request.url).toBe('/api/settings/start-tab');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.contentType).toMatch(/application\/json/i);
    expect(request.body).toEqual({ value: 'series' });
  });

  it('sends movies to go back to Movies, rather than a second route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 'movies' }));

    await saveStartTab('movies');

    const request = onlyRequest();
    expect(request.url).toBe('/api/settings/start-tab');
    expect(request.body).toEqual({ value: 'movies' });
  });

  it('answers with the tab the route says it stored, not the one asked for', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 'movies' }));

    await expect(saveStartTab('series')).resolves.toBe('movies');
  });

  it('falls back to the sent tab when the route echoes nothing', async () => {
    fetchMock.mockResolvedValue(okResponse({}));

    await expect(saveStartTab('series')).resolves.toBe('series');
  });

  it('falls back to the sent tab when the echo is not a Library tab', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ value: 'episodes' }));
    await expect(saveStartTab('series')).resolves.toBe('series');

    // Case matters: the echo guard is exact, not a coercion.
    fetchMock.mockResolvedValueOnce(okResponse({ value: 'Movies' }));
    await expect(saveStartTab('series')).resolves.toBe('series');

    fetchMock.mockResolvedValueOnce(okResponse({ value: true }));
    await expect(saveStartTab('movies')).resolves.toBe('movies');
  });

  it('throws when the save does not succeed', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    // The rejection is the provider's cue to put the previous tab back.
    await expect(saveStartTab('series')).rejects.toThrow(/500/);
  });

  it('throws when the request itself cannot be made', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(saveStartTab('series')).rejects.toThrow();
  });
});
