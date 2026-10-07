import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { saveUltrawideMargins } from './saveUltrawideMargins';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 27 — Ultrawide margins: the wire call the plan named, as its own unit
 * (refactor 252). The contract is `saveWatched`'s — POST the value, take the
 * route's echo as the truth, reject on anything but a 2xx — over the
 * `ultrawide-margins` route, whose echo is a boolean and nothing looser.
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

describe('saveUltrawideMargins', () => {
  it('POSTs the new value as JSON to the ultrawide-margins route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: true }));

    await saveUltrawideMargins(true);

    const request = onlyRequest();
    expect(request.url).toBe('/api/settings/ultrawide-margins');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.contentType).toMatch(/application\/json/i);
    expect(request.body).toEqual({ value: true });
  });

  it('sends false to turn the margins off, rather than a second route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: false }));

    await saveUltrawideMargins(false);

    const request = onlyRequest();
    expect(request.url).toBe('/api/settings/ultrawide-margins');
    expect(request.body).toEqual({ value: false });
  });

  it('answers with the value the route says it stored, not the one asked for', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: false }));

    await expect(saveUltrawideMargins(true)).resolves.toBe(false);
  });

  it('falls back to the requested value when the route echoes nothing usable', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    await expect(saveUltrawideMargins(true)).resolves.toBe(true);

    // A string is not a flag: the echo guard is the route's, not a coercion.
    fetchMock.mockResolvedValueOnce(okResponse({ value: 'true' }));
    await expect(saveUltrawideMargins(false)).resolves.toBe(false);
  });

  it('throws when the save does not succeed', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    // The rejection is the provider's cue to put the previous value back.
    await expect(saveUltrawideMargins(true)).rejects.toThrow(/500/);
  });

  it('throws when the request itself cannot be made', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(saveUltrawideMargins(true)).rejects.toThrow();
  });
});
