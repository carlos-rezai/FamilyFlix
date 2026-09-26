// @vitest-environment node
//
// 15 — Settings hub (issues #143, #144, #146).
//
// The Settings hub's slice of the router's tests, beside the import's and the
// export's — the seam `routes.test.ts`'s header names and that file is too
// large to take: a real listener, a real `fetch`, real status codes and bodies,
// over a real `:memory:` library and a real media directory under
// `sandboxRoot`. Nothing new is injected: every route here reads what the
// router already holds — the `playback` it was composed over, `storage`, and
// the `mediaPath` it was handed.
//
// The Settings hub's four routes and the upload `16-component-upload` adds
// beside them, one suite:
//
// - `GET /api/playback/capabilities` → `200 { component, codecs }`, the raw
//   **Codec report** — `{ codec, kind, support }` per row, `support` one of
//   `native | via-component` — with the **Format catalogue** left to the
//   screen that draws it. The route reaches the report through
//   `Playback.capabilities()` and nothing else, which is what the fake
//   component handed to `createPlayback` asserts: what the route answers is
//   what that component's `decoders()` said, and neither the environment nor
//   a binary on PATH has a say. Since `16-component-upload` Phase 1 the
//   domain is composed over a **Component slot** rather than a component —
//   `fixedSlot` here — and `component` is the **Component info** it describes,
//   `{ source, bytes, files }` or `null` for a machine with none.
// - `POST /api/playback/component` → `200 PlaybackCapabilities`, the report
//   **after the swap** — the **Playback component upload**, added by
//   `16-component-upload` Phase 2 (issue #153). `multipart/form-data`, every
//   file part named `component` and told apart by `componentBinary`; `400`
//   for a body that is not multipart, a stray part, a second of either or a
//   missing half; `422` for a pair that will not run; `409` for the
//   **In-use refusal**; `500` for a swap stopped by neither. Nothing new is
//   injected: the route reaches the **Component slot** through the `playback`
//   the router already holds.
// - `DELETE /api/playback/component` → `200 PlaybackCapabilities`, the report
//   **after the fall-back** — the ✕ on the **Component row**, added by
//   `16-component-upload` Phase 4 (issue #155). The same shape the capability
//   read answers, because the screen redraws from the echo rather than
//   reading again; `404` when there is nothing uploaded, the **Default
//   component** being the installer's rather than the maintainer's; `409` for
//   the **In-use refusal**, word for word the one the upload gives; `500` for
//   the slot's fourth outcome.
// - `GET /api/settings` → `200 { subtitleLanguage }`, the household's one
//   preference with the default already applied, so no client has to know
//   what it is.
// - `POST /api/settings/subtitle-language { value }` → `200 { value }` — a
//   **Single-signal write** on the favorite / watched / rating precedent, one
//   route per setting so the roadmap's auto-on adds a sibling and not a
//   shape; `400 { error }` for a missing, empty or non-string value, storing
//   nothing. Membership in the **Language pool** is not checked, and writing
//   the value already held is a harmless `200`.
// - `GET /api/storage` → `200 { mediaPath, bytesUsed, movieCount }`, the
//   **Storage report**: the `mediaPath` the router was composed with,
//   resolved to absolute — the card names a place on the disk, not a place
//   relative to a process; **Space used** over it, `0` when the root is not
//   there yet, so a fresh install has a Storage card and not an error; and
//   `storage.countMovies()`. The two counts of one library disagree by
//   exactly a **Stranded folder**: its bytes count, its title does not.

import express from 'express';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isAbsolute, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createMedia } from '../media/createMedia/createMedia';
import type {
  ComponentSlot,
  InstallOutcome,
  RemoveOutcome,
} from '../playback/componentSlot/componentSlot';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../playback/ffmpegComponent/ffmpegComponent';
import { createSqliteStorage, type LibraryStorage } from '../library';
import {
  componentDir,
  ffmpegIn,
} from '../test-support/componentDir/componentDir';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { newMovie } from '../test-support/newMovie/newMovie';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import {
  DEFAULT_SUBTITLE_LANGUAGE,
  type CodecCapability,
  type PlaybackCapabilities,
  type PlaybackComponentInfo,
  type Settings,
  type StorageReport,
} from '@/types';

// --- per-test resource tracking ------------------------------------------------

const storages: LibraryStorage[] = [];
const servers: Server[] = [];
const cwd = process.cwd();

afterEach(async () => {
  vi.unstubAllEnvs();
  process.chdir(cwd);
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const storage of storages.splice(0)) {
    storage.close();
  }
});

interface Api {
  storage: LibraryStorage;
  baseUrl: string;
  /** The managed media directory, absolute, as the test built it. */
  media: string;
}

/**
 * A fresh library behind a listening API, composed the way `main.ts` composes
 * it, over the **Playback component** given — absent by default, which is the
 * machine CI actually is. `mediaPath` is what the router is handed — the
 * absolute media directory unless the test spells it otherwise; `exists`
 * false leaves the directory unmade, the fresh install before its first copy.
 */
function freshApi({
  component = null,
  componentInfo,
  slot,
  mediaPath,
  exists = true,
}: {
  component?: PlaybackComponent | null;
  /** What the slot says about that component — the **Component info**. */
  componentInfo?: PlaybackComponentInfo;
  /**
   * The **Component slot** itself, for the upload route — the one thing on
   * this page that writes, and the one case where a slot that never changes
   * cannot say what happened.
   */
  slot?: ComponentSlot;
  mediaPath?: string;
  exists?: boolean;
} = {}): Api {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-settings-api-');
  const media = join(dir, 'media');
  if (exists) {
    mkdirSync(media);
  }

  const mediaDomain = createMedia(media);
  const playback = createPlayback(
    media,
    slot ?? fixedSlot(component, componentInfo)
  );
  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      mediaPath ?? media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback }),
      createEnrichment({ storage, client: offlineTmdb(), media: mediaDomain })
    )
  );

  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, media };
}

/** What `ffmpeg -decoders` prints, trimmed to the codecs these tests read. */
const DECODERS = [
  'Decoders:',
  ' V..... = Video',
  ' A..... = Audio',
  ' S..... = Subtitle',
  ' ------',
  ' VFS..D h264                 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10',
  ' VFS..D hevc                 HEVC (High Efficiency Video Coding)',
  ' A....D ac3                  ATSC A/52A (AC-3)',
  ' A....D dts                  DCA (DTS Coherent Acoustics)',
  ' S....D subrip               SubRip subtitle',
].join('\n');

/**
 * A component that answers a fixed decoder listing and nothing else the route
 * under test asks. No probe and no conversion: this slice never opens a film.
 */
function fakeComponent(decoders: string | null): PlaybackComponent {
  return {
    hardwareEncoder: null,
    decoders: () => decoders,
    probe: () => null,
    spawn: (): PlaybackProcess => ({
      stdout: Readable.from([]),
      kill: () => undefined,
    }),
  };
}

const getCapabilities = (baseUrl: string) =>
  fetch(`${baseUrl}/api/playback/capabilities`);

const readCapabilities = async (
  baseUrl: string
): Promise<PlaybackCapabilities> =>
  (await (await getCapabilities(baseUrl)).json()) as PlaybackCapabilities;

const entryFor = (
  reported: PlaybackCapabilities,
  codec: string
): CodecCapability | undefined =>
  reported.codecs.find((candidate) => candidate.codec === codec);

describe('GET /api/playback/capabilities — the machine with no Playback component', () => {
  it('answers 200 with the report as JSON', async () => {
    const { baseUrl } = freshApi();

    const response = await getCapabilities(baseUrl);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('answers a null component over the native rows alone', async () => {
    // `null` is a machine with no component at all — the fresh install before
    // its installer has run, and CI.
    const reported = await readCapabilities(freshApi().baseUrl);

    expect(reported.component).toBeNull();
    expect(reported.codecs.length).toBeGreaterThan(0);
    expect(reported.codecs.every((entry) => entry.support === 'native')).toBe(
      true
    );
    expect(entryFor(reported, 'h264')).toEqual({
      codec: 'h264',
      kind: 'video',
      support: 'native',
    });
    expect(entryFor(reported, 'aac')?.kind).toBe('audio');
  });

  it('carries the raw report, one { codec, kind, support } per row', async () => {
    // The Format catalogue stays on the screen: nothing here is filtered,
    // named or ordered for display.
    const reported = await readCapabilities(freshApi().baseUrl);

    for (const entry of reported.codecs) {
      expect(Object.keys(entry).sort()).toEqual(['codec', 'kind', 'support']);
      expect(['video', 'audio']).toContain(entry.kind);
      expect(['native', 'via-component']).toContain(entry.support);
    }
  });
});

describe('GET /api/playback/capabilities — the component the domain was composed with', () => {
  it('answers the component the slot describes and what its decoders add', async () => {
    const { baseUrl } = freshApi({ component: fakeComponent(DECODERS) });

    const reported = await readCapabilities(baseUrl);

    expect(reported.component).not.toBeNull();
    expect(entryFor(reported, 'hevc')).toEqual({
      codec: 'hevc',
      kind: 'video',
      support: 'via-component',
    });
    expect(entryFor(reported, 'ac3')?.support).toBe('via-component');
    expect(entryFor(reported, 'dts')?.support).toBe('via-component');
    expect(entryFor(reported, 'subrip')).toBeUndefined();
  });

  it('lists a codec both decode once, as native', async () => {
    const { baseUrl } = freshApi({ component: fakeComponent(DECODERS) });

    const reported = await readCapabilities(baseUrl);

    expect(
      reported.codecs.filter((entry) => entry.codec === 'h264')
    ).toHaveLength(1);
    expect(entryFor(reported, 'h264')?.support).toBe('native');
  });

  it('answers the component over the native rows for one that will not say', async () => {
    const { baseUrl } = freshApi({ component: fakeComponent(null) });

    const reported = await readCapabilities(baseUrl);

    expect(reported.component).not.toBeNull();
    expect(reported.codecs.every((entry) => entry.support === 'native')).toBe(
      true
    );
  });

  it('reaches the report through Playback alone — the environment has no say', async () => {
    // A complete component sits in the variable and on PATH, and the domain
    // was composed over none. A route that resolved the slot itself would
    // answer `true` here and disagree with what pressing Play does.
    const dir = componentDir();
    vi.stubEnv('FAMILYFLIX_FFMPEG_PATH', ffmpegIn(dir));
    vi.stubEnv('PATH', dir);
    const { baseUrl } = freshApi();

    const reported = await readCapabilities(baseUrl);

    expect(reported.component).toBeNull();
  });

  it('carries the source, the pair’s bytes and their basenames', async () => {
    // What the **Component row** draws, straight off the slot: where the live
    // component came from, what the pair weighs, and what its two files are
    // called. The route assembles nothing — `Playback.capabilities()` does.
    const { baseUrl } = freshApi({
      component: fakeComponent(DECODERS),
      componentInfo: {
        source: 'uploaded',
        bytes: 98_765_432,
        files: ['ffmpeg.exe', 'ffprobe.exe'],
      },
    });

    const reported = await readCapabilities(baseUrl);

    expect(reported.component).toEqual({
      source: 'uploaded',
      bytes: 98_765_432,
      files: ['ffmpeg.exe', 'ffprobe.exe'],
    });
  });
});

// --- the settings pair -----------------------------------------------------------

const getSettings = (baseUrl: string) => fetch(`${baseUrl}/api/settings`);

const readSettings = async (baseUrl: string): Promise<Settings> =>
  (await (await getSettings(baseUrl)).json()) as Settings;

/** The write, with whatever body the test wants on the wire. */
const postSubtitleLanguage = (baseUrl: string, body: unknown) =>
  fetch(`${baseUrl}/api/settings/subtitle-language`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('GET /api/settings', () => {
  it('answers 200 with the settings as JSON', async () => {
    const { baseUrl } = freshApi();

    const response = await getSettings(baseUrl);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('answers English on a fresh database — the default already applied', async () => {
    const { baseUrl } = freshApi();

    expect(await readSettings(baseUrl)).toEqual({
      subtitleLanguage: DEFAULT_SUBTITLE_LANGUAGE,
    });
    expect(DEFAULT_SUBTITLE_LANGUAGE).toBe('English');
  });

  it('answers the stored value after a write', async () => {
    const { storage, baseUrl } = freshApi();
    storage.setSubtitleLanguage('French');

    expect(await readSettings(baseUrl)).toEqual({ subtitleLanguage: 'French' });
  });
});

describe('POST /api/settings/subtitle-language', () => {
  it('echoes the value it stored', async () => {
    const { baseUrl } = freshApi();

    const response = await postSubtitleLanguage(baseUrl, { value: 'Spanish' });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ value: 'Spanish' });
  });

  it('persists — the repository and the read route both answer it', async () => {
    const { storage, baseUrl } = freshApi();

    await postSubtitleLanguage(baseUrl, { value: 'Spanish' });

    expect(storage.settings().subtitleLanguage).toBe('Spanish');
    expect(await readSettings(baseUrl)).toEqual({
      subtitleLanguage: 'Spanish',
    });
  });

  it('replaces a value already stored — the write is an upsert', async () => {
    const { baseUrl } = freshApi();
    await postSubtitleLanguage(baseUrl, { value: 'Spanish' });

    const response = await postSubtitleLanguage(baseUrl, { value: 'German' });

    expect(response.status).toBe(200);
    expect(await readSettings(baseUrl)).toEqual({ subtitleLanguage: 'German' });
  });

  it('takes the value already held as a harmless 200', async () => {
    const { baseUrl } = freshApi();
    await postSubtitleLanguage(baseUrl, { value: 'Spanish' });

    const response = await postSubtitleLanguage(baseUrl, { value: 'Spanish' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: 'Spanish' });
    expect(await readSettings(baseUrl)).toEqual({
      subtitleLanguage: 'Spanish',
    });
  });

  it('accepts a value outside the pool — a vocabulary, not a constraint', async () => {
    const { baseUrl } = freshApi();

    const response = await postSubtitleLanguage(baseUrl, { value: 'Japanese' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: 'Japanese' });
    expect(await readSettings(baseUrl)).toEqual({
      subtitleLanguage: 'Japanese',
    });
  });

  it.each([
    ['a missing value', {}],
    ['an empty value', { value: '' }],
    ['a number', { value: 3 }],
    ['a boolean', { value: true }],
    ['a null', { value: null }],
    ['an object', { value: { name: 'Spanish' } }],
  ])('answers 400 with an error for %s, storing nothing', async (_, body) => {
    const { storage, baseUrl } = freshApi();
    storage.setSubtitleLanguage('French');

    const response = await postSubtitleLanguage(baseUrl, body);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: unknown };
    expect(typeof payload.error).toBe('string');
    expect((payload.error as string).length).toBeGreaterThan(0);
    expect(storage.settings().subtitleLanguage).toBe('French');
  });
});

// --- the storage report ----------------------------------------------------------

/** A file under the media directory holding exactly `size` bytes. */
function fileOf(media: string, path: string, size: number): void {
  mkdirSync(join(media, path, '..'), { recursive: true });
  writeFileSync(join(media, path), Buffer.alloc(size, 0x2a));
}

const getStorage = (baseUrl: string) => fetch(`${baseUrl}/api/storage`);

const readStorage = async (baseUrl: string): Promise<StorageReport> =>
  (await (await getStorage(baseUrl)).json()) as StorageReport;

describe('GET /api/storage — the answer', () => {
  it('answers 200 with the report as JSON', async () => {
    const { baseUrl } = freshApi();

    const response = await getStorage(baseUrl);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('carries exactly mediaPath, bytesUsed and movieCount', async () => {
    const { baseUrl } = freshApi();

    const report = await readStorage(baseUrl);

    expect(Object.keys(report).sort()).toEqual([
      'bytesUsed',
      'mediaPath',
      'movieCount',
    ]);
    expect(typeof report.mediaPath).toBe('string');
    expect(typeof report.bytesUsed).toBe('number');
    expect(typeof report.movieCount).toBe('number');
  });
});

describe('GET /api/storage — mediaPath', () => {
  it('names the media directory the router was composed with', async () => {
    const { baseUrl, media } = freshApi();

    expect((await readStorage(baseUrl)).mediaPath).toBe(media);
  });

  it('is absolute even when the server was started with a relative path', async () => {
    const { baseUrl, media } = freshApi({ mediaPath: 'media' });
    // The process is where a relative `media` points at the sandbox's copy.
    process.chdir(join(media, '..'));

    const { mediaPath } = await readStorage(baseUrl);

    expect(isAbsolute(mediaPath)).toBe(true);
    expect(resolve(mediaPath)).toBe(media);
  });

  it('is absolute for the ./media default', async () => {
    const { baseUrl, media } = freshApi({ mediaPath: './media' });
    process.chdir(join(media, '..'));

    const { mediaPath } = await readStorage(baseUrl);

    expect(isAbsolute(mediaPath)).toBe(true);
    expect(mediaPath).not.toMatch(/^\.[\\/]/);
    expect(resolve(mediaPath)).toBe(media);
  });
});

describe('GET /api/storage — bytesUsed', () => {
  it('is 0 over an empty media directory', async () => {
    const { baseUrl } = freshApi();

    expect((await readStorage(baseUrl)).bytesUsed).toBe(0);
  });

  it('is the bytes written under the root, nested folders included', async () => {
    const { baseUrl, media } = freshApi();
    fileOf(media, 'Die Hard (1988)/die-hard.mkv', 4_000);
    fileOf(media, 'Die Hard (1988)/poster.jpg', 300);
    fileOf(media, 'Heat (1995)/heat.mp4', 6_000);

    expect((await readStorage(baseUrl)).bytesUsed).toBe(10_300);
  });

  it('is 0, not an error, when the media directory does not exist yet', async () => {
    const { baseUrl } = freshApi({ exists: false });

    const response = await getStorage(baseUrl);

    expect(response.status).toBe(200);
    expect(((await response.json()) as StorageReport).bytesUsed).toBe(0);
  });

  it('is read afresh on every visit — no memoised walk', async () => {
    const { baseUrl, media } = freshApi();
    fileOf(media, 'Heat (1995)/heat.mp4', 6_000);
    expect((await readStorage(baseUrl)).bytesUsed).toBe(6_000);

    fileOf(media, 'Die Hard (1988)/die-hard.mkv', 4_000);

    expect((await readStorage(baseUrl)).bytesUsed).toBe(10_000);
  });
});

describe('GET /api/storage — movieCount', () => {
  it('is 0 on a fresh database', async () => {
    const { baseUrl } = freshApi();

    expect((await readStorage(baseUrl)).movieCount).toBe(0);
  });

  it('is the count off the database', async () => {
    const { storage, baseUrl } = freshApi();
    storage.addMovie(
      newMovie({ title: 'Heat', videoPath: 'Heat (1995)/a.mp4' })
    );
    storage.addMovie(
      newMovie({ title: 'Die Hard', videoPath: 'Die Hard (1988)/b.mkv' })
    );

    expect((await readStorage(baseUrl)).movieCount).toBe(2);
  });

  it('counts the titles and not the folders — a Stranded folder is bytes, not a title', async () => {
    const { storage, baseUrl, media } = freshApi();
    storage.addMovie(
      newMovie({ title: 'Heat', videoPath: 'Heat (1995)/heat.mp4' })
    );
    fileOf(media, 'Heat (1995)/heat.mp4', 6_000);
    fileOf(media, 'Gone (2010)/gone.mkv', 1_234);

    const report = await readStorage(baseUrl);

    expect(report.movieCount).toBe(1);
    expect(report.bytesUsed).toBe(7_234);
  });
});

// --- the upload: POST /api/playback/component --------------------------------------
//
// The **Playback component upload** on the wire. The route's whole job is to
// tell the two halves apart by filename, hand each one's bytes to the
// **Component slot**, and map the slot's refusal to a status — every refusal
// leaving no staged folder behind, so a retry is a fresh attempt.
//
// The slot here is a fake rather than `fixedSlot`, because this is the one
// route on the page that writes: what is being asked is which half the route
// said each part was, what it did with a refusal, and that the body it echoes
// is the report **after** the swap rather than the one from before it.

/**
 * A **Component slot** that accepts an upload and says what it was told.
 *
 * `install()` answers the outcome the test chose; a successful one makes the
 * slot live over a component that decodes what `DECODERS` lists, so the
 * echoed report can be read for rows that were not there a moment earlier.
 * `open()` is the staging folder nobody took back — the invariant behind
 * "every refusal discards `incoming/`", asked without caring whether the
 * route staged before it parsed or after.
 *
 * The outcome is the slot's own `InstallOutcome` rather than a hand-copied
 * union: a reason added to the real one is then a compile error here until
 * this suite covers it, which is exactly how `failed` went untested.
 */
function uploadableSlot(outcome: InstallOutcome = { ok: true }) {
  let component: PlaybackComponent | null = null;
  let info: PlaybackComponentInfo | null = null;
  const taken: { binary: string; bytes: string }[] = [];
  /** One entry per `receive()`, true while nobody has settled it. */
  const staged: { open: boolean }[] = [];

  const slot: ComponentSlot = {
    current: () => component,
    info: () => info,
    receive: () => {
      const folder = { open: true };
      staged.push(folder);

      return {
        take: async (binary: string, bytes: Readable) => {
          taken.push({ binary, bytes: await textOf(bytes) });
        },
        install: () => {
          folder.open = false;
          if (outcome.ok) {
            component = fakeComponent(DECODERS);
            info = {
              source: 'uploaded',
              bytes: 98_765_432,
              files: ['ffmpeg.exe', 'ffprobe.exe'],
            };
          }
          return outcome;
        },
        // Settling twice is a refusal followed by a route being careful, not
        // a second folder: the real slot's discard is as idempotent as `rm -f`.
        discard: () => {
          folder.open = false;
        },
      };
    },
    remove: () => {
      throw new Error('the uploadable slot does not remove');
    },
  };

  return {
    slot,
    taken,
    open: () => staged.filter((folder) => folder.open).length,
  };
}

/** What a part carried, read the way the slot reads it. */
async function textOf(bytes: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of bytes) {
    chunks.push(Buffer.from(chunk as Buffer));
  }
  return Buffer.concat(chunks).toString();
}

/** One file part, the way the zone hands a dropped binary to `FormData`. */
function componentPart(filename: string, contents = 'binary bytes'): File {
  return new File([contents], filename, { type: 'application/octet-stream' });
}

/** The upload, every file part under the one name the route reads. */
function postComponent(baseUrl: string, files: File[]): Promise<Response> {
  const body = new FormData();
  for (const file of files) {
    body.append('component', file);
  }
  return fetch(`${baseUrl}/api/playback/component`, { method: 'POST', body });
}

/** The pair a working upload carries. */
const PAIR = () => [componentPart('ffmpeg.exe'), componentPart('ffprobe.exe')];

/** The `{ error }` a refusal carries. */
const errorOf = async (response: Response): Promise<string> =>
  ((await response.json()) as { error: string }).error;

describe('POST /api/playback/component — the pair goes live', () => {
  it('answers 200 with the whole report, after the swap', async () => {
    // The echo precedent every write in the app keeps: the screen redraws
    // from truth rather than re-fetching, so the two reads cannot disagree.
    const fake = uploadableSlot();
    const { baseUrl } = freshApi({ slot: fake.slot });

    const response = await postComponent(baseUrl, PAIR());

    expect(response.status).toBe(200);
    const reported = (await response.json()) as PlaybackCapabilities;
    expect(reported.component).toEqual({
      source: 'uploaded',
      bytes: 98_765_432,
      files: ['ffmpeg.exe', 'ffprobe.exe'],
    });
  });

  it('carries the rows the new component decodes', async () => {
    const { baseUrl } = freshApi({ slot: uploadableSlot().slot });

    const reported = (await (
      await postComponent(baseUrl, PAIR())
    ).json()) as PlaybackCapabilities;

    expect(entryFor(reported, 'hevc')?.support).toBe('via-component');
    expect(entryFor(reported, 'ac3')?.support).toBe('via-component');
  });

  it('echoes exactly what the capability read answers next', async () => {
    const { baseUrl } = freshApi({ slot: uploadableSlot().slot });

    const echoed = (await (
      await postComponent(baseUrl, PAIR())
    ).json()) as PlaybackCapabilities;

    expect(echoed).toEqual(await readCapabilities(baseUrl));
  });

  it('tells the halves apart by filename, whatever the client called them', async () => {
    // The client sorts nothing. A build downloaded as `ffmpeg-7.1.exe` is an
    // ffmpeg, and the bytes are stored under the platform's own name — which
    // is what makes it resolve as a component afterwards.
    const fake = uploadableSlot();
    const { baseUrl } = freshApi({ slot: fake.slot });

    await postComponent(baseUrl, [
      componentPart('ffmpeg-7.1.exe', 'the converter'),
      componentPart('FFPROBE.EXE', 'the prober'),
    ]);

    expect(fake.taken).toEqual([
      { binary: 'ffmpeg', bytes: 'the converter' },
      { binary: 'ffprobe', bytes: 'the prober' },
    ]);
  });

  it('leaves nothing staged behind it', async () => {
    const fake = uploadableSlot();
    const { baseUrl } = freshApi({ slot: fake.slot });

    expect((await postComponent(baseUrl, PAIR())).status).toBe(200);

    expect(fake.open()).toBe(0);
  });

  it('serves the upload through the five things the router already holds', async () => {
    // Nothing new is injected for this route: it reaches the **Component
    // slot** through the `playback` the router was composed with. A sixth
    // argument here would be a second resolution of the component, and the
    // report and pressing Play could then disagree. (The sixth the router does
    // take is the `enrichment/` domain, issue #203 — not the component.)
    expect(createApiRouter).toHaveLength(6);

    const { baseUrl } = freshApi({ slot: uploadableSlot().slot });

    expect((await postComponent(baseUrl, PAIR())).status).toBe(200);
  });
});

describe('POST /api/playback/component — what is refused at the door', () => {
  it('refuses one half alone with the line that says they go together', async () => {
    const fake = uploadableSlot();
    const { baseUrl } = freshApi({ slot: fake.slot });

    const response = await postComponent(baseUrl, [
      componentPart('ffmpeg.exe'),
    ]);

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe(
      'ffmpeg and ffprobe go together — add both.'
    );
    expect(fake.open()).toBe(0);
  });

  it('refuses a file that is neither half', async () => {
    // The parent's mistake: a `.dll` is what a codec pack used to be, and
    // nothing this app can run.
    const fake = uploadableSlot();
    const { baseUrl } = freshApi({ slot: fake.slot });

    const response = await postComponent(baseUrl, [
      componentPart('avcodec-60.dll'),
      ...PAIR(),
    ]);

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe(
      'Only ffmpeg and ffprobe can be added.'
    );
    expect(fake.open()).toBe(0);
  });

  it('refuses a second of either half', async () => {
    const fake = uploadableSlot();
    const { baseUrl } = freshApi({ slot: fake.slot });

    const response = await postComponent(baseUrl, [
      componentPart('ffmpeg.exe'),
      componentPart('ffmpeg-7.1.exe'),
      componentPart('ffprobe.exe'),
    ]);

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe(
      'Only ffmpeg and ffprobe can be added.'
    );
  });

  it('refuses a body that is not multipart at all', async () => {
    const fake = uploadableSlot();
    const { baseUrl } = freshApi({ slot: fake.slot });

    const response = await fetch(`${baseUrl}/api/playback/component`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ component: 'ffmpeg.exe' }),
    });

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toEqual(expect.any(String));
    expect(fake.open()).toBe(0);
  });

  it('consumes every file part, handled or not', async () => {
    // `busboy` never reaches `close` while a part nobody listened to is still
    // pending, and a hung request is a worse answer than a refused one. The
    // stray part here is the one nothing will take.
    const { baseUrl } = freshApi({ slot: uploadableSlot().slot });

    const response = await postComponent(baseUrl, [
      componentPart('notes.txt', 'x'.repeat(200_000)),
      ...PAIR(),
    ]);

    expect(response.status).toBe(400);
  });

  it('leaves the component that is live where it is', async () => {
    // The refusal costs the family nothing: what was playing films a moment
    // ago is still what the next press of Play converts through.
    const fake = uploadableSlot();
    const { baseUrl } = freshApi({ slot: fake.slot });
    await postComponent(baseUrl, PAIR());

    await postComponent(baseUrl, [componentPart('avcodec-60.dll')]);

    expect((await readCapabilities(baseUrl)).component).toEqual({
      source: 'uploaded',
      bytes: 98_765_432,
      files: ['ffmpeg.exe', 'ffprobe.exe'],
    });
  });
});

describe('POST /api/playback/component — what the slot refuses', () => {
  it('answers 422 for a pair that will not run', async () => {
    // A `.dll`, a renamed text file, a macOS build on a Windows machine, a
    // binary that will not start at all: one sentence for all of them, and
    // the live component never moved.
    const fake = uploadableSlot({ ok: false, reason: 'not-a-component' });
    const { baseUrl } = freshApi({ slot: fake.slot });

    const response = await postComponent(baseUrl, PAIR());

    expect(response.status).toBe(422);
    expect(await errorOf(response)).toBe("That isn't a working ffmpeg build.");
    expect((await readCapabilities(baseUrl)).component).toBeNull();
  });

  it('answers 409 for a component in use', async () => {
    // The **In-use refusal**: a refusal, never a kill. The family's film is
    // not stopped by the maintainer's drop.
    const fake = uploadableSlot({ ok: false, reason: 'in-use' });
    const { baseUrl } = freshApi({ slot: fake.slot });

    const response = await postComponent(baseUrl, PAIR());

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe(
      "The playback component is in use. Stop the film that's playing and try again."
    );
    expect((await readCapabilities(baseUrl)).component).toBeNull();
  });

  it('discards the staged folder on either refusal', async () => {
    // A retry is a fresh attempt and not a repair.
    const refused = uploadableSlot({ ok: false, reason: 'not-a-component' });
    const locked = uploadableSlot({ ok: false, reason: 'in-use' });

    await postComponent(freshApi({ slot: refused.slot }).baseUrl, PAIR());
    await postComponent(freshApi({ slot: locked.slot }).baseUrl, PAIR());

    expect(refused.taken).toHaveLength(2);
    expect(locked.taken).toHaveLength(2);
    expect(refused.open()).toBe(0);
    expect(locked.open()).toBe(0);
  });

  it('answers 400 for a slot that calls the drop incomplete', async () => {
    // The slot says `incomplete` for a half it never received; the route says
    // the same thing the missing-half case says, because it is that case.
    const fake = uploadableSlot({ ok: false, reason: 'incomplete' });
    const { baseUrl } = freshApi({ slot: fake.slot });

    const response = await postComponent(baseUrl, PAIR());

    expect(response.status).toBe(400);
    expect(fake.open()).toBe(0);
  });

  it('answers 500 for a swap that stopped for neither the lock nor the pair', async () => {
    // A full disk, a directory gone from under it: the slot answers `failed`
    // rather than throwing, precisely so the route has something to say — and
    // it does not say `in-use`, because there is no film to go and stop.
    const fake = uploadableSlot({ ok: false, reason: 'failed' });
    const { baseUrl } = freshApi({ slot: fake.slot });

    const response = await postComponent(baseUrl, PAIR());

    expect(response.status).toBe(500);
    expect(await errorOf(response)).toBe(
      'The playback component could not be replaced.'
    );
    expect(fake.open()).toBe(0);
    expect((await readCapabilities(baseUrl)).component).toBeNull();
  });
});

describe('POST /api/playback/component — what the router was composed with', () => {
  it('takes no new argument for the upload', () => {
    // The route reaches the **Component slot** through the `playback` the
    // router already holds. A fifth thing injected here would be a second
    // resolution of the component, and the report and pressing Play could
    // then disagree. (The sixth the router does take is the `enrichment/`
    // domain, issue #203 — not the component.)
    expect(createApiRouter).toHaveLength(6);
  });
});

// --- the remove: DELETE /api/playback/component --------------------------------
//
// The upload route's inverse. The ✕ on the **Component row** sends this, the
// **Component slot** takes the **Uploaded component** out and resolves the
// **Default component** again, and the route answers the report **after** the
// fall-back — the same shape
// `GET /api/playback/capabilities` answers, because the screen redraws from
// the echo rather than reading again, and a second read is a second chance to
// disagree with it. A `204` was rejected for exactly that reason.
//
// Three refusals, and one of them is not an error at heart: the `404` says the
// **Default component** is not removable, which is a fact about ownership —
// it is the installer's, not the maintainer's to take away, and the row that
// offers no ✕ and the route that refuses agree. The `409` is the **In-use
// refusal**, word for word the one the upload gives. The `500` is the slot's
// fourth outcome — a swap stopped by neither the lock nor the pair, answered
// as a value precisely so the route has something to say about it.

/** The **Component info** of an upload waiting to be taken back. */
const UPLOADED: PlaybackComponentInfo = {
  source: 'uploaded',
  bytes: 101_000_000,
  files: ['ffmpeg.exe', 'ffprobe.exe'],
};

/** What the slot falls back to: the installer's build, weighed. */
const FELL_BACK: PlaybackComponentInfo = {
  source: 'default',
  bytes: 98_765_432,
  files: ['ffmpeg.exe', 'ffprobe.exe'],
};

/**
 * A **Component slot** holding an upload, which a remove takes back.
 *
 * A successful remove leaves the component the machine fell back to — the
 * resolver's, which decodes nothing beyond Chromium's own set, or none at all
 * on a machine that never had one. A refused remove changes nothing, which is
 * what "the pair is still live" is asserted through.
 *
 * The outcome is the slot's own `RemoveOutcome`, for the reason the upload's
 * is: a hand-copied union is what let one refusal be unreachable from here.
 */
function removableSlot({
  outcome = { ok: true },
  fallback = 'default',
}: {
  outcome?: RemoveOutcome;
  fallback?: 'default' | 'none';
} = {}) {
  let component: PlaybackComponent | null = fakeComponent(DECODERS);
  let info: PlaybackComponentInfo | null = UPLOADED;

  const slot: ComponentSlot = {
    current: () => component,
    info: () => info,
    receive: () => {
      throw new Error('the removable slot does not receive');
    },
    remove: () => {
      if (outcome.ok) {
        component = fallback === 'default' ? fakeComponent(null) : null;
        info = fallback === 'default' ? FELL_BACK : null;
      }
      return outcome;
    },
  };

  return { slot };
}

/** The ✕, on the wire. */
const deleteComponent = (baseUrl: string): Promise<Response> =>
  fetch(`${baseUrl}/api/playback/component`, { method: 'DELETE' });

describe('DELETE /api/playback/component — the pair taken back', () => {
  it('answers 200 with the report after the fall-back', async () => {
    const { baseUrl } = freshApi({ slot: removableSlot().slot });

    const response = await deleteComponent(baseUrl);

    expect(response.status).toBe(200);
    const reported = (await response.json()) as PlaybackCapabilities;
    expect(reported.component).toEqual(FELL_BACK);
  });

  it('drops the rows the uploaded component added', async () => {
    const { baseUrl } = freshApi({ slot: removableSlot().slot });

    const reported = (await (
      await deleteComponent(baseUrl)
    ).json()) as PlaybackCapabilities;

    expect(entryFor(reported, 'hevc')).toBeUndefined();
    expect(entryFor(reported, 'ac3')).toBeUndefined();
    expect(reported.codecs.every((entry) => entry.support === 'native')).toBe(
      true
    );
  });

  it('echoes exactly what the capability read answers next', async () => {
    // The whole reason this is a `200` and not a `204`: the screen redraws
    // from truth, and the two reads cannot disagree.
    const { baseUrl } = freshApi({ slot: removableSlot().slot });

    const echoed = (await (
      await deleteComponent(baseUrl)
    ).json()) as PlaybackCapabilities;

    expect(echoed).toEqual(await readCapabilities(baseUrl));
  });

  it('answers a null component when the upload was the only one', async () => {
    // There is no default underneath: the **Component row** goes with the
    // pair, and what is left is the machine Chromium alone can play.
    const { baseUrl } = freshApi({
      slot: removableSlot({ fallback: 'none' }).slot,
    });

    const reported = (await (
      await deleteComponent(baseUrl)
    ).json()) as PlaybackCapabilities;

    expect(reported.component).toBeNull();
    expect(reported.codecs.length).toBeGreaterThan(0);
    expect(reported.codecs.every((entry) => entry.support === 'native')).toBe(
      true
    );
  });
});

describe('DELETE /api/playback/component — what the slot refuses', () => {
  it('answers 404 when there is nothing uploaded to take back', async () => {
    // Ownership rather than an error: the **Default component** is the
    // installer's, and the row that offers no ✕ says the same thing.
    const { baseUrl } = freshApi({
      slot: removableSlot({
        outcome: { ok: false, reason: 'nothing-uploaded' },
      }).slot,
    });

    const response = await deleteComponent(baseUrl);

    expect(response.status).toBe(404);
    const said = await errorOf(response);
    expect(said).toMatch(/default/i);
    expect(said).toMatch(/not removable/i);
    expect((await readCapabilities(baseUrl)).component).toEqual(UPLOADED);
  });

  it('answers 409 for a component a conversion is holding open', async () => {
    // The **In-use refusal**: a refusal, never a kill. The maintainer's ✕
    // does not stop the family's film.
    const { baseUrl } = freshApi({
      slot: removableSlot({ outcome: { ok: false, reason: 'in-use' } }).slot,
    });

    const response = await deleteComponent(baseUrl);

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toBe(
      "The playback component is in use. Stop the film that's playing and try again."
    );
    expect((await readCapabilities(baseUrl)).component).toEqual(UPLOADED);
  });

  it('answers 500 for a remove that stopped for neither the lock nor the pair', async () => {
    // The install's fourth refusal, read the other way round, and with its
    // own sentence: what failed was a removal, not a replacement.
    const { baseUrl } = freshApi({
      slot: removableSlot({ outcome: { ok: false, reason: 'failed' } }).slot,
    });

    const response = await deleteComponent(baseUrl);

    expect(response.status).toBe(500);
    expect(await errorOf(response)).toBe(
      'The playback component could not be removed.'
    );
    expect((await readCapabilities(baseUrl)).component).toEqual(UPLOADED);
  });

  it('says what the upload says when the pair is in use', async () => {
    // One sentence for one condition: the drop and the ✕ are refused in the
    // same words, because they are refused by the same lock.
    const removing = freshApi({
      slot: removableSlot({ outcome: { ok: false, reason: 'in-use' } }).slot,
    });
    const installing = freshApi({
      slot: uploadableSlot({ ok: false, reason: 'in-use' }).slot,
    });

    expect(await errorOf(await deleteComponent(removing.baseUrl))).toBe(
      await errorOf(await postComponent(installing.baseUrl, PAIR()))
    );
  });
});
