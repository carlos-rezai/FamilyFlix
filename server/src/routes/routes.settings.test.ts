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
// The initiative's four routes, one suite:
//
// - `GET /api/playback/capabilities` → `200 { component, codecs }`, the raw
//   **Codec report** — `{ codec, kind, support }` per row, `support` one of
//   `native | via-component` — with the **Format catalogue** left to the
//   screen that draws it. The route reaches the report through
//   `Playback.capabilities()` and nothing else, which is what the fake
//   component handed to `createPlayback` asserts: what the route answers is
//   what that component's `decoders()` said, and neither the environment nor
//   a binary on PATH has a say.
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
import { createImporter } from '../import-export/createImporter/createImporter';
import { createMedia } from '../media/createMedia/createMedia';
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
import { newMovie } from '../test-support/newMovie/newMovie';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import {
  DEFAULT_SUBTITLE_LANGUAGE,
  type CodecCapability,
  type PlaybackCapabilities,
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
  mediaPath,
  exists = true,
}: {
  component?: PlaybackComponent | null;
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
  const playback = createPlayback(media, component);
  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      mediaPath ?? media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback })
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

  it('answers component false over the native rows alone', async () => {
    const reported = await readCapabilities(freshApi().baseUrl);

    expect(reported.component).toBe(false);
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
  it('answers component true and what the fake component’s decoders add', async () => {
    const { baseUrl } = freshApi({ component: fakeComponent(DECODERS) });

    const reported = await readCapabilities(baseUrl);

    expect(reported.component).toBe(true);
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

  it('answers component true over the native rows for a component that will not say', async () => {
    const { baseUrl } = freshApi({ component: fakeComponent(null) });

    const reported = await readCapabilities(baseUrl);

    expect(reported.component).toBe(true);
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

    expect(reported.component).toBe(false);
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
