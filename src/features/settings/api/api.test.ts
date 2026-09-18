import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchCapabilities } from './api';
import type { PlaybackCapabilities } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143).
 *
 * The wire calls the Settings hub makes. `fetchCapabilities` reads the
 * **Codec report** — `GET /api/playback/capabilities`, the raw
 * `{ component, codecs }` — for `useCapabilities`, its one caller, so it
 * lives with the feature rather than in `src/api/`.
 *
 * In `fetchExportSummary`'s style: what was asked for, what the caller is
 * handed back, and a rejection on any status that is not OK — the hook keeps
 * `null` on that and draws nothing, so the rejection is the whole of what the
 * screen needs to know.
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

const REPORT: PlaybackCapabilities = {
  component: true,
  codecs: [
    { codec: 'h264', kind: 'video', support: 'native' },
    { codec: 'hevc', kind: 'video', support: 'via-component' },
    { codec: 'aac', kind: 'audio', support: 'native' },
  ],
};

describe('fetchCapabilities', () => {
  it('GETs the capability route', async () => {
    fetchMock.mockResolvedValue(okResponse(REPORT));

    await fetchCapabilities();

    const request = onlyRequest();
    expect(request.url).toBe('/api/playback/capabilities');
    expect(request.method === undefined || request.method === 'GET').toBe(true);
  });

  it('resolves the report the route answered', async () => {
    fetchMock.mockResolvedValue(okResponse(REPORT));

    await expect(fetchCapabilities()).resolves.toEqual(REPORT);
  });

  it('resolves a report with no component as it came', async () => {
    const absent: PlaybackCapabilities = {
      component: false,
      codecs: [{ codec: 'h264', kind: 'video', support: 'native' }],
    };
    fetchMock.mockResolvedValue(okResponse(absent));

    await expect(fetchCapabilities()).resolves.toEqual(absent);
  });

  it('rejects when the route answers a status that is not OK', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchCapabilities()).rejects.toThrow();
  });

  it('rejects when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchCapabilities()).rejects.toThrow('offline');
  });
});
