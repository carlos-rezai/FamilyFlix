import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  ComponentRefusedError,
  fetchCapabilities,
  fetchStorageReport,
  installComponent,
  removeComponent,
  saveSubtitleLanguage,
} from './api';
import type { PlaybackCapabilities, StorageReport } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 15 — Settings hub (issues #143, #144, #146).
 *
 * The wire calls the Settings hub makes, each with one caller in the feature,
 * so each lives here rather than in `src/api/`:
 *
 * - `fetchCapabilities` reads the **Codec report** — `GET
 *   /api/playback/capabilities`, the raw `{ component, codecs }` — for
 *   `useCapabilities`. In `fetchExportSummary`'s style: what was asked for,
 *   what the caller is handed back, and a rejection on any status that is
 *   not OK — the hook keeps `null` on that and draws nothing, so the
 *   rejection is the whole of what the screen needs to know.
 * - `saveSubtitleLanguage` — the **Single-signal write** on the favorite /
 *   watched / rating precedent, through `postValue` with a string `isEcho`,
 *   for `useSettings`. The read it pairs with, `fetchSettings`, moved up to
 *   `src/api/` because the player asks for it too.
 * - `fetchStorageReport` reads the **Storage report** — `GET /api/storage`,
 *   the raw `{ mediaPath, bytesUsed, movieCount }` — for `useStorageReport`.
 *   `fetchCapabilities`'s shape repeated.
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
  component: {
    source: 'default',
    bytes: 98_765_432,
    files: ['ffmpeg.exe', 'ffprobe.exe'],
  },
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
      component: null,
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

/**
 * 16 — Playback component upload, Phase 3: "the zone" (issue #154).
 *
 * `installComponent(files)` — the one write the **Codec report** makes:
 * `POST /api/playback/component`, `multipart/form-data`, **one `component`
 * part per file** and nothing else. The client sorts nothing and labels
 * nothing: the route tells the two **Component binaries** apart by filename,
 * and a client that said which half a file was would be a client the route
 * trusted.
 *
 * It answers the **Codec report** after the swap, so the screen redraws from
 * the echo rather than reading again — the precedent every write in the app
 * keeps.
 *
 * Three statuses carry a sentence worth drawing: `400` (a stray part, a
 * second of either, a missing half), `422` (a pair that will not run) and
 * `409` (the **In-use refusal**). Each rejects with
 * {@link ComponentRefusedError} carrying **the server's own `error`**, on the
 * `ImportRefusedError` precedent — the words a family reads are the words the
 * thing that refused chose. Everything else rejects plainly, and the hook
 * substitutes its fixed line, so a `500` is not silence either.
 */

/** The two halves, as a file dialog or a drop hands them over. */
const FFMPEG = new File(['MZ'], 'ffmpeg.exe', {
  type: 'application/octet-stream',
});
const FFPROBE = new File(['MZ'], 'ffprobe.exe', {
  type: 'application/octet-stream',
});

/** A refusal the route named a reason for, at the status it chose. */
function refusedResponse(status: number, error: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  } as unknown as Response;
}

/** A refusal whose body is not JSON at all — a proxy's HTML, a truncation. */
function unreadableResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
  } as unknown as Response;
}

/** What the route answers once the **Component swap** has happened. */
const INSTALLED: PlaybackCapabilities = {
  component: {
    source: 'uploaded',
    bytes: 98_765_432,
    files: ['ffmpeg.exe', 'ffprobe.exe'],
  },
  codecs: [
    { codec: 'h264', kind: 'video', support: 'native' },
    { codec: 'hevc', kind: 'video', support: 'via-component' },
  ],
};

/** The multipart body of the one request that was issued. */
function sentForm(): FormData {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const body = fetchMock.mock.calls[0][1]?.body;
  if (!(body instanceof FormData)) {
    throw new Error('installComponent sent no multipart body');
  }
  return body;
}

describe('installComponent', () => {
  it('posts the pair to the component route', async () => {
    fetchMock.mockResolvedValue(okResponse(INSTALLED));

    await installComponent([FFMPEG, FFPROBE]);

    const { url, method } = onlyRequest();
    expect(url).toBe('/api/playback/component');
    expect(method).toBe('POST');
  });

  it('sends one `component` part per file, in the order they came', async () => {
    fetchMock.mockResolvedValue(okResponse(INSTALLED));

    await installComponent([FFMPEG, FFPROBE]);

    expect(sentForm().getAll('component')).toEqual([FFMPEG, FFPROBE]);
  });

  it('sends whatever was dropped, sorting and naming nothing', async () => {
    // One file, in the wrong order, or something that is neither half: the
    // route is what refuses, because it is the only side that can be trusted
    // to.
    fetchMock.mockResolvedValue(okResponse(INSTALLED));
    const stray = new File(['dll'], 'codec.dll');

    await installComponent([FFPROBE, stray]).catch(() => undefined);

    expect(sentForm().getAll('component')).toEqual([FFPROBE, stray]);
  });

  it('resolves the report the route echoed after the swap', async () => {
    fetchMock.mockResolvedValue(okResponse(INSTALLED));

    await expect(installComponent([FFMPEG, FFPROBE])).resolves.toEqual(
      INSTALLED
    );
  });

  it('rejects a 400 with the server’s own sentence', async () => {
    const said = 'Both ffmpeg and ffprobe are needed.';
    fetchMock.mockResolvedValue(refusedResponse(400, said));

    await expect(installComponent([FFMPEG])).rejects.toThrow(said);
    await expect(installComponent([FFMPEG])).rejects.toBeInstanceOf(
      ComponentRefusedError
    );
  });

  it('rejects a 422 with the server’s own sentence', async () => {
    const said = "That isn't a working ffmpeg build.";
    fetchMock.mockResolvedValue(refusedResponse(422, said));

    await expect(installComponent([FFMPEG, FFPROBE])).rejects.toThrow(said);
    await expect(installComponent([FFMPEG, FFPROBE])).rejects.toBeInstanceOf(
      ComponentRefusedError
    );
  });

  it('rejects a 409 with the server’s own sentence', async () => {
    // The **In-use refusal**: the family's film is not stopped by the
    // maintainer's drop, and the line that says so is the route's.
    const said =
      "The playback component is in use. Stop the film that's playing and try again.";
    fetchMock.mockResolvedValue(refusedResponse(409, said));

    await expect(installComponent([FFMPEG, FFPROBE])).rejects.toThrow(said);
    await expect(installComponent([FFMPEG, FFPROBE])).rejects.toBeInstanceOf(
      ComponentRefusedError
    );
  });

  it('rejects a 500 plainly, with nothing to quote', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    const refusal = installComponent([FFMPEG, FFPROBE]);

    await expect(refusal).rejects.toThrow();
    await expect(refusal).rejects.not.toBeInstanceOf(ComponentRefusedError);
  });

  it('rejects plainly when a refusal’s body cannot be read', async () => {
    fetchMock.mockResolvedValue(unreadableResponse(400));

    const refusal = installComponent([FFMPEG, FFPROBE]);

    await expect(refusal).rejects.toThrow();
    await expect(refusal).rejects.not.toBeInstanceOf(ComponentRefusedError);
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(installComponent([FFMPEG, FFPROBE])).rejects.toThrow(
      'offline'
    );
  });
});

/**
 * 16 — Playback component upload, Phase 4: "the ✕ takes it back" (issue #155).
 *
 * `removeComponent()` — `installComponent`'s inverse and its mirror:
 * `DELETE /api/playback/component`, no body at all, answering the **Codec
 * report** after the fall-back so the screen redraws from the echo rather
 * than reading again.
 *
 * The statuses that carry a sentence worth drawing are the remove's own:
 * `400`, `404` — the **Default component** is not removable, a fact about
 * ownership rather than an error — and `409`, the **In-use refusal**. Each
 * rejects with {@link ComponentRefusedError} carrying the server's own
 * `error`; everything else rejects plainly, and the hook substitutes its
 * fixed line.
 */

/** What the route answers once the upload has been taken back. */
const REMOVED: PlaybackCapabilities = {
  component: {
    source: 'default',
    bytes: 98_765_432,
    files: ['ffmpeg.exe', 'ffprobe.exe'],
  },
  codecs: [{ codec: 'h264', kind: 'video', support: 'native' }],
};

describe('removeComponent', () => {
  it('asks the component route to take the pair back', async () => {
    fetchMock.mockResolvedValue(okResponse(REMOVED));

    await removeComponent();

    expect(onlyRequest()).toEqual({
      url: '/api/playback/component',
      method: 'DELETE',
    });
  });

  it('sends nothing with it', async () => {
    // There is one uploaded component and the server knows which: a body here
    // would be the client naming something it cannot know better.
    fetchMock.mockResolvedValue(okResponse(REMOVED));

    await removeComponent();

    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
  });

  it('answers the report the route echoed', async () => {
    fetchMock.mockResolvedValue(okResponse(REMOVED));

    await expect(removeComponent()).resolves.toEqual(REMOVED);
  });

  it('rejects a 404 with the route’s own words', async () => {
    const said = 'The default playback component is not removable.';
    fetchMock.mockResolvedValue(refusedResponse(404, said));

    await expect(removeComponent()).rejects.toThrow(said);
    await expect(removeComponent()).rejects.toBeInstanceOf(
      ComponentRefusedError
    );
  });

  it('rejects a 409 the same way', async () => {
    const said =
      "The playback component is in use. Stop the film that's playing and try again.";
    fetchMock.mockResolvedValue(refusedResponse(409, said));

    await expect(removeComponent()).rejects.toThrow(said);
    await expect(removeComponent()).rejects.toBeInstanceOf(
      ComponentRefusedError
    );
  });

  it('rejects a 400 the same way', async () => {
    const said = 'That request made no sense.';
    fetchMock.mockResolvedValue(refusedResponse(400, said));

    await expect(removeComponent()).rejects.toBeInstanceOf(
      ComponentRefusedError
    );
    await expect(removeComponent()).rejects.toThrow(said);
  });

  it('rejects plainly on anything else', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    const refusal = removeComponent();

    await expect(refusal).rejects.toThrow();
    await expect(refusal).rejects.not.toBeInstanceOf(ComponentRefusedError);
  });

  it('rejects plainly when a refusal’s body cannot be read', async () => {
    fetchMock.mockResolvedValue(unreadableResponse(409));

    const refusal = removeComponent();

    await expect(refusal).rejects.toThrow();
    await expect(refusal).rejects.not.toBeInstanceOf(ComponentRefusedError);
  });
});
