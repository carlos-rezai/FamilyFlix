import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  fetchCapabilities,
  fetchStorageReport,
  saveSubtitleLanguage,
} from './api';
import type { PlaybackCapabilities, StorageReport } from '@/types';
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

/**
 * 15 — Settings hub, Phase 2: "the Subtitles rows" (issue #144).
 *
 * `saveSubtitleLanguage` — the **Single-signal write** on the favorite /
 * watched / rating precedent, through `postValue` with a string `isEcho`. One
 * caller, `useSettings`, so it stays here; the read it pairs with,
 * `fetchSettings`, moved up to `src/api/` because the player asks for it too.
 */
describe('saveSubtitleLanguage', () => {
  it('POSTs the language as { value } to the subtitle-language route', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 'Spanish' }));

    await saveSubtitleLanguage('Spanish');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe('/api/settings/subtitle-language');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ value: 'Spanish' });
  });

  it('sends it as JSON', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 'Spanish' }));

    await saveSubtitleLanguage('Spanish');

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('content-type')).toBe(
      'application/json'
    );
  });

  it('resolves the echo the route answered', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 'Spanish' }));

    await expect(saveSubtitleLanguage('Spanish')).resolves.toBe('Spanish');
  });

  it('takes the route’s word over what was sent — the echo is what was stored', async () => {
    fetchMock.mockResolvedValue(okResponse({ value: 'French' }));

    await expect(saveSubtitleLanguage('Spanish')).resolves.toBe('French');
  });

  it('falls back to what was sent when the route echoes nothing usable', async () => {
    // A string is the echo; anything else is a route answering with nonsense.
    fetchMock.mockResolvedValue(okResponse({ value: 7 }));

    await expect(saveSubtitleLanguage('Spanish')).resolves.toBe('Spanish');
  });

  it('rejects when the route refuses the value', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Body must be { value: string }' }),
    } as unknown as Response);

    await expect(saveSubtitleLanguage('')).rejects.toThrow(/400/);
  });

  it('rejects when the route answers a status that is not OK', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(saveSubtitleLanguage('Spanish')).rejects.toThrow();
  });

  it('rejects when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(saveSubtitleLanguage('Spanish')).rejects.toThrow('offline');
  });
});

/**
 * 15 — Settings hub, Phase 4: "the Storage card" (issue #146).
 *
 * `fetchStorageReport` reads the **Storage report** — `GET /api/storage`, the
 * raw `{ mediaPath, bytesUsed, movieCount }` — for `useStorageReport`, its one
 * caller, so it lives here. `fetchCapabilities`'s shape repeated: the payload
 * as it came, and a rejection on any status that is not OK.
 */
describe('fetchStorageReport', () => {
  const STORAGE: StorageReport = {
    mediaPath: 'D:\\FamilyFlix\\media',
    bytesUsed: 19_756_849_562,
    movieCount: 12,
  };

  it('GETs the storage route', async () => {
    fetchMock.mockResolvedValue(okResponse(STORAGE));

    await fetchStorageReport();

    const request = onlyRequest();
    expect(request.url).toBe('/api/storage');
    expect(request.method === undefined || request.method === 'GET').toBe(true);
  });

  it('resolves the report the route answered', async () => {
    fetchMock.mockResolvedValue(okResponse(STORAGE));

    await expect(fetchStorageReport()).resolves.toEqual(STORAGE);
  });

  it('resolves a fresh install’s report as it came — zero bytes, zero titles', async () => {
    const fresh: StorageReport = {
      mediaPath: 'C:\\Users\\Family\\AppData\\Roaming\\FamilyFlix\\media',
      bytesUsed: 0,
      movieCount: 0,
    };
    fetchMock.mockResolvedValue(okResponse(fresh));

    await expect(fetchStorageReport()).resolves.toEqual(fresh);
  });

  it('rejects when the route answers a status that is not OK', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchStorageReport()).rejects.toThrow();
  });

  it('rejects when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchStorageReport()).rejects.toThrow('offline');
  });
});
