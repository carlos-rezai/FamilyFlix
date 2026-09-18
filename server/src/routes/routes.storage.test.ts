// @vitest-environment node
//
// 15 — Settings hub, Phase 4: "the Storage card" (issue #146).
//
// The **Storage report** on the wire — `GET /api/storage` → `200 { mediaPath,
// bytesUsed, movieCount }` — beside the settings slice of the router's tests:
// a real listener, a real `fetch`, real status codes and bodies, over a real
// `:memory:` library and a real media directory under `sandboxRoot`. Nothing
// new is injected: the route composes three reads the router already holds —
// the `mediaPath` it was composed with, resolved to absolute; **Space used**
// over it; and `storage.countMovies()`.
//
// Absolute even when the server was started with `./media`: the card names a
// place on the disk, not a place relative to a process. `bytesUsed` is the
// bytes under the root, `0` when the root is not there yet, so a fresh
// install has a Storage card and not an error. And the two counts of one
// library disagree by exactly a **Stranded folder**: its bytes count, its
// title does not.

import express from 'express';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isAbsolute, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { newMovie } from '../test-support/newMovie/newMovie';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { StorageReport } from '@/types';

// --- per-test resource tracking ------------------------------------------------

const storages: LibraryStorage[] = [];
const servers: Server[] = [];
const cwd = process.cwd();

afterEach(async () => {
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
 * it. `mediaPath` is what the router is handed — the absolute media directory
 * unless the test spells it otherwise; `exists` false leaves the directory
 * unmade, the fresh install before its first copy.
 */
function freshApi({
  mediaPath,
  exists = true,
}: { mediaPath?: string; exists?: boolean } = {}): Api {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-storage-api-');
  const media = join(dir, 'media');
  if (exists) {
    mkdirSync(media);
  }

  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, null);
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
