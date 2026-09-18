import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchSettings } from './fetchSettings';
import type { Settings } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 15 — Settings hub, Phase 2: "the Subtitles rows" (issue #144).
 *
 * The household's settings, read off `GET /api/settings` — `{ subtitleLanguage }`
 * with the default already applied by the server, so no client has to know what
 * it is. It lives on this rung rather than with the settings feature because
 * two features call it: the hub's `useSettings` shows the preference, and the
 * player's `useSubtitles` (the next slice) honours it. That is CLAUDE.md's rule
 * for `api/` — a wire call moves up the moment a second feature asks for it —
 * and the alternative was the player importing the settings feature's `api/`.
 *
 * In `fetchMovie`'s style: what was asked for, what the caller is handed back,
 * and a rejection on any status that is not OK — both callers keep what they
 * had on that, so the rejection is the whole of what they need to know.
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

/** The one request that was issued, as url plus the method it carried. */
function onlyRequest() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [input, init] = fetchMock.mock.calls[0];
  return { url: String(input), method: init?.method };
}

const SETTINGS: Settings = { subtitleLanguage: 'Spanish' };

describe('fetchSettings', () => {
  it('GETs the settings route', async () => {
    fetchMock.mockResolvedValue(okResponse(SETTINGS));

    await fetchSettings();

    const request = onlyRequest();
    expect(request.url).toBe('/api/settings');
    expect(request.method === undefined || request.method === 'GET').toBe(true);
  });

  it('resolves the settings the route answered', async () => {
    fetchMock.mockResolvedValue(okResponse(SETTINGS));

    await expect(fetchSettings()).resolves.toEqual(SETTINGS);
  });

  it('resolves the default the server applied as it came', async () => {
    // The default is the server's to apply; nothing here fills one in.
    fetchMock.mockResolvedValue(okResponse({ subtitleLanguage: 'English' }));

    await expect(fetchSettings()).resolves.toEqual({
      subtitleLanguage: 'English',
    });
  });

  it('rejects when the route answers a status that is not OK', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchSettings()).rejects.toThrow(/500/);
  });

  it('rejects when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchSettings()).rejects.toThrow();
  });
});
