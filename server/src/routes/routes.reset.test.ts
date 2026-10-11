// @vitest-environment node
//
// 37 — Factory reset, Phase 1: "the reset wire" (issue #298).
//
// `POST /api/reset`, composed in the route over the five domains it touches —
// `DELETE /movies/:id`'s precedent — and answered over a real listener, a real
// `:memory:` library and a real managed media directory. Its order is the
// point: the two `409`s first, so a running import or Sync erases nothing; then
// the Sync in review let go, the transaction, the media root emptied, the
// uploaded component taken back with its outcome ignored; and last the import
// in review let go. Then `204`.

import express from 'express';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia, type Media } from '../media/createMedia/createMedia';
import type {
  ComponentSlot,
  RemoveOutcome,
} from '../playback/componentSlot/componentSlot';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../playback/ffmpegComponent/ffmpegComponent';
import { fakeTmdb, TMDB_KEY } from '../test-support/fakeTmdb/fakeTmdb';
import { heldCopy } from '../test-support/heldCopy/heldCopy';
import { libraryFixture } from '../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type {
  EnrichmentRun,
  HomePayload,
  ImportRun,
  PlaybackCapabilities,
  PlaybackComponentInfo,
} from '@/types';

const IMPORT_RUNNING =
  'An import is running. Stop it before erasing everything.';
const SYNC_RUNNING = 'A sync is running. Stop it before erasing everything.';
const ERASE_FAILED = 'Could not erase the library';

// --- per-test resource tracking ------------------------------------------------

const storages: LibraryStorage[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const storage of storages.splice(0)) {
    storage.close();
  }
});

// --- the component slot ---------------------------------------------------------

function fakeComponent(): PlaybackComponent {
  return {
    hardwareEncoder: null,
    decoders: () => null,
    probe: () => null,
    spawn: (): PlaybackProcess => ({
      stdout: Readable.from([]),
      kill: () => undefined,
    }),
  };
}

const UPLOADED: PlaybackComponentInfo = {
  source: 'uploaded',
  bytes: 101_000_000,
  files: ['ffmpeg.exe', 'ffprobe.exe'],
};

const FELL_BACK: PlaybackComponentInfo = {
  source: 'default',
  bytes: 98_765_432,
  files: ['ffmpeg.exe', 'ffprobe.exe'],
};

/**
 * A **Component slot** holding an upload, the remove falling back to the
 * **Default component** — or refusing with `outcome`, the pair staying live.
 */
function uploadedSlot(outcome: RemoveOutcome = { ok: true }) {
  let info: PlaybackComponentInfo | null = UPLOADED;
  const component = fakeComponent();
  let removes = 0;

  const slot: ComponentSlot = {
    current: () => component,
    info: () => info,
    receive: () => {
      throw new Error('the reset never receives a component');
    },
    remove: () => {
      removes += 1;
      if (outcome.ok) {
        info = FELL_BACK;
      }
      return outcome;
    },
  };

  return { slot, removes: () => removes };
}

// --- the composed API -------------------------------------------------------------

/**
 * A filled library — a film with its files, a listed folder, a stored key — a
 * filled managed media directory and an uploaded component, behind a
 * listening API composed the way `main.ts` composes it.
 */
async function filledApi({
  seam = (real) => real,
  removal,
}: {
  seam?: (real: Media) => Media;
  removal?: RemoveOutcome;
} = {}) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-reset-api-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } = libraryFixture(dir);

  const mediaDomain = seam(createMedia(media));
  const { slot, removes } = uploadedSlot(removal);
  const playback = createPlayback(media, slot);
  const importer = createImporter({ storage, media: mediaDomain, playback });
  const tmdb = fakeTmdb();
  const enrichment = createEnrichment({
    storage,
    client: tmdb,
    media: mediaDomain,
  });

  const folder = mediaDomain.reserveFolder('The Lantern Keeper', 2019);
  const videoPath = await mediaDomain.storeUpload(
    folder,
    'lantern.mp4',
    Readable.from([Buffer.from('video bytes')])
  );
  const movieId = storage.addMovie({
    title: 'The Lantern Keeper',
    year: 2019,
    videoPath,
    genres: ['Drama'],
    isFavorite: true,
  }).id;
  storage.addLibraryFolder(root);
  storage.setTmdbKey(TMDB_KEY);
  writeFileSync(join(media, 'stray.txt'), 'loose file');

  const app = express();
  app.use(
    '/api',
    createApiRouter(storage, media, playback, mediaDomain, importer, enrichment)
  );

  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;

  return {
    storage,
    media,
    root,
    sheet,
    movieId,
    videoPath,
    tmdb,
    removes,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}

const postReset = (baseUrl: string) =>
  fetch(`${baseUrl}/api/reset`, { method: 'POST' });

const readHome = async (baseUrl: string) =>
  (await (await fetch(`${baseUrl}/api/home`)).json()) as HomePayload;

const readComponent = async (baseUrl: string) =>
  (
    (await (
      await fetch(`${baseUrl}/api/playback/capabilities`)
    ).json()) as PlaybackCapabilities
  ).component;

const startImport = (baseUrl: string, sheet: string, root: string) =>
  fetch(`${baseUrl}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetPath: sheet, rootPath: root }),
  });

const startSync = (baseUrl: string, movieId: string) =>
  fetch(`${baseUrl}/api/enrichment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'single',
      movieId,
      fields: ['synopsis'],
      writeSheet: false,
      writePosters: false,
    }),
  });

async function importReviewed(baseUrl: string): Promise<ImportRun> {
  return vi.waitFor(
    async () => {
      const response = await fetch(`${baseUrl}/api/import/current`);
      expect(response.status).toBe(200);
      const run = (await response.json()) as ImportRun;
      expect(run.phase).toBe('review');
      return run;
    },
    { timeout: 10_000 }
  );
}

async function syncReviewed(baseUrl: string): Promise<EnrichmentRun> {
  return vi.waitFor(async () => {
    const response = await fetch(`${baseUrl}/api/enrichment/current`);
    expect(response.status).toBe(200);
    const run = (await response.json()) as EnrichmentRun;
    expect(run.phase).toBe('review');
    return run;
  });
}

/** What a refused reset must leave exactly where it was. */
async function expectNothingErased(
  api: Awaited<ReturnType<typeof filledApi>>
): Promise<void> {
  expect(api.storage.getMovie(api.movieId)).not.toBeNull();
  expect(api.storage.libraryFolders()).toHaveLength(1);
  expect(api.storage.tmdbKey()).toBe(TMDB_KEY);
  expect(readFileSync(join(api.media, api.videoPath), 'utf8')).toBe(
    'video bytes'
  );
  expect(existsSync(join(api.media, 'stray.txt'))).toBe(true);
  expect(api.removes()).toBe(0);
  expect(await readComponent(api.baseUrl)).toEqual(UPLOADED);
}

// --- the reset ------------------------------------------------------------------------

describe('POST /api/reset — everything erased', () => {
  it('answers 204', async () => {
    const { baseUrl } = await filledApi();

    const response = await postReset(baseUrl);

    expect(response.status).toBe(204);
  });

  it('leaves the home empty', async () => {
    const { baseUrl } = await filledApi();
    const before = await readHome(baseUrl);
    expect(before.rows.length + before.favorites.length).toBeGreaterThan(0);

    await postReset(baseUrl);

    const home = await readHome(baseUrl);
    expect(home.continueWatching).toEqual([]);
    expect(home.favorites).toEqual([]);
    expect(home.rows).toEqual([]);
  });

  it('erases the folders list and every setting, the genre pool kept', async () => {
    const { baseUrl, storage } = await filledApi();
    const pool = storage.listGenrePool();

    await postReset(baseUrl);

    expect(storage.libraryFolders()).toEqual([]);
    expect(storage.tmdbKey()).toBeNull();
    expect(storage.listGenrePool()).toEqual(pool);
    expect(pool).toHaveLength(12);
  });

  it('empties the media root and keeps it', async () => {
    const { baseUrl, media } = await filledApi();

    await postReset(baseUrl);

    expect(statSync(media).isDirectory()).toBe(true);
    expect(readdirSync(media)).toEqual([]);
  });

  it('takes the uploaded component back, the Default component reported again', async () => {
    const { baseUrl, removes } = await filledApi();

    await postReset(baseUrl);

    expect(removes()).toBe(1);
    expect(await readComponent(baseUrl)).toEqual(FELL_BACK);
  });
});

describe('POST /api/reset — a component that will not go', () => {
  it.each(['in-use', 'failed'] as const)(
    'answers 204 over a %s refusal, the library erased anyway',
    async (reason) => {
      const { baseUrl, media, storage } = await filledApi({
        removal: { ok: false, reason },
      });

      const response = await postReset(baseUrl);

      expect(response.status).toBe(204);
      expect(storage.countMovies()).toBe(0);
      expect(readdirSync(media)).toEqual([]);
      expect(await readComponent(baseUrl)).toEqual(UPLOADED);
    }
  );
});

describe('POST /api/reset — a running import', () => {
  it('answers 409 with the sentence and erases nothing', async () => {
    const { seam, reached, release } = heldCopy();
    const api = await filledApi({ seam });
    try {
      expect((await startImport(api.baseUrl, api.sheet, api.root)).status).toBe(
        201
      );
      await reached;
      const run = (await (
        await fetch(`${api.baseUrl}/api/import/current`)
      ).json()) as ImportRun;
      expect(run.phase).toMatch(/^(scanning|importing)$/);

      const response = await postReset(api.baseUrl);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: IMPORT_RUNNING });
      await expectNothingErased(api);
    } finally {
      release();
      await importReviewed(api.baseUrl);
    }
  });
});

describe('POST /api/reset — a running Sync', () => {
  it('answers 409 with the sentence and erases nothing', async () => {
    const api = await filledApi();
    const held = api.tmdb.hold('searchMovie');
    try {
      expect((await startSync(api.baseUrl, api.movieId)).status).toBe(201);
      await held.reached;

      const response = await postReset(api.baseUrl);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: SYNC_RUNNING });
      await expectNothingErased(api);
    } finally {
      held.release();
      await syncReviewed(api.baseUrl);
    }
  });
});

describe('POST /api/reset — a database that refuses', () => {
  it('answers 500 with the sentence, the media root and the component untouched', async () => {
    const api = await filledApi();
    vi.spyOn(api.storage, 'reset').mockImplementation(() => {
      throw new Error('SQLITE_BUSY');
    });

    const response = await postReset(api.baseUrl);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: ERASE_FAILED });
    await expectNothingErased(api);
  });
});

describe('POST /api/reset — runs in review', () => {
  it('lets an import in review go and erases everything', async () => {
    const { baseUrl, sheet, root, storage } = await filledApi();
    expect((await startImport(baseUrl, sheet, root)).status).toBe(201);
    await importReviewed(baseUrl);

    const response = await postReset(baseUrl);

    expect(response.status).toBe(204);
    expect((await fetch(`${baseUrl}/api/import/current`)).status).toBe(404);
    expect(storage.countMovies()).toBe(0);
  });

  it('lets a Sync in review go and erases everything', async () => {
    const { baseUrl, movieId, storage } = await filledApi();
    expect((await startSync(baseUrl, movieId)).status).toBe(201);
    await syncReviewed(baseUrl);

    const response = await postReset(baseUrl);

    expect(response.status).toBe(204);
    expect((await fetch(`${baseUrl}/api/enrichment/current`)).status).toBe(404);
    expect(storage.countMovies()).toBe(0);
  });
});

// --- the boundary -----------------------------------------------------------------------

/** Every shipping `.ts` under a directory: neither a test nor a fixture. */
function shippingSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return shippingSources(path);
    }
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
      ? [path]
      : [];
  });
}

describe('the router and SQLite', () => {
  it('reaches the database only through LibraryStorage, never importing db/', () => {
    const importsDb = /from\s+['"](?:\.\.\/)+db(?:\/[^'"]*)?['"]/;

    const offenders = shippingSources(
      dirname(fileURLToPath(import.meta.url))
    ).filter((file) => importsDb.test(readFileSync(file, 'utf8')));

    expect(offenders).toEqual([]);
  });
});
