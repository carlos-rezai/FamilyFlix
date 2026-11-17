// @vitest-environment node
//
// 67, Export paths, Phase 2 (issue #645): the maintainer's case over the wire.
//
// Titles recorded at `Movies/<title>` under one **Library folder**, their art
// in managed storage and their Title folders on disk holding the videos alone.
// The library is exported (`POST /api/export`), Factory reset
// (`POST /api/reset`), the inner `Movies/` folder linked as a Library folder
// (`POST /api/library-folders`) and the Export's sheet uploaded from its
// `Meta/` folder (`POST /api/import`, Link). Every title is back, no
// **Problem** is raised, and every poster is set: each path cell is found
// under the run's **Sheet root**, the Export folder.
//
// Through a real listener and a real `fetch` over a real `:memory:` library,
// `routes.exportSourceFolders.test.ts`'s seam.

import express from 'express';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import type { ComponentSlot } from '../playback/componentSlot/componentSlot';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { newMovie } from '../test-support/newMovie/newMovie';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import type { ImportRun } from '@/types';

const NAME = 'familyflix-collection_17-11-2026';

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

/**
 * A **Component slot** with nothing uploaded: the reset's remove answers
 * `nothing-uploaded`, which leaves the erase standing.
 */
const emptySlot = (): ComponentSlot => ({
  current: () => null,
  info: () => null,
  receive: () => {
    throw new Error('this suite uploads no component');
  },
  remove: () => ({ ok: false, reason: 'nothing-uploaded' }),
});

/** Write `bytes` at `path`, its folders made on the way. */
function put(path: string, bytes: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

/** A fresh library over an empty media directory, served on a free port. */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  dir: string;
  media: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-export-paths-api-');
  const media = join(dir, 'media');
  mkdirSync(media);

  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, emptySlot(), () => null);
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({
        storage,
        media: mediaDomain,
        playback,
        librarySheet: idleLibrarySheet(),
        layoutFill: idleLayoutFill(),
      }),
      createEnrichment({
        storage,
        client: offlineTmdb(),
        media: mediaDomain,
        playback,
        layoutFill: createLayoutFill({ storage, media: mediaDomain }),
      }),
      createLayoutFill({ storage, media: mediaDomain })
    )
  );

  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, dir, media };
}

/** The two films: their Title folders under `Movies/`, their art stored. */
const FILMS = [
  { title: 'Amelie', year: 2001, slug: 'amelie-2001', genre: 'Romance' },
  { title: 'Die Hard', year: 1988, slug: 'die-hard-1988', genre: 'Action' },
] as const;

/**
 * One Library folder, `Library/`, recording each film at
 * `Movies/<Title (Year)>`: its video alone on disk there, its poster and
 * backdrop in managed storage. Answers the inner `Movies/` folder.
 */
function addLibrary(
  storage: LibraryStorage,
  dir: string,
  media: string
): string {
  const library = join(dir, 'Library');
  const movies = join(library, 'Movies');
  const folder = storage.addLibraryFolder(library);
  for (const { title, year, slug, genre } of FILMS) {
    const titleFolder = `${title} (${year})`;
    put(join(movies, titleFolder, `${slug}.mp4`), 'video bytes');
    put(join(media, slug, 'poster.jpg'), `${title} poster`);
    put(join(media, slug, 'backdrop.jpg'), `${title} backdrop`);
    const movie = storage.addMovie(
      newMovie({
        title,
        year,
        genres: [genre],
        videoPath: `${slug}/${slug}.mp4`,
        posterPath: `${slug}/poster.jpg`,
        backdropPath: `${slug}/backdrop.jpg`,
      })
    );
    expect(
      storage.setSourceFolder(movie.id, folder.id, `Movies/${titleFolder}`)
    ).toBe(true);
  }
  return movies;
}

const post = (baseUrl: string, path: string, body?: object) =>
  fetch(`${baseUrl}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** The snapshot once the run has reached review, or a failure if it never does. */
async function untilReview(baseUrl: string): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const response = await fetch(`${baseUrl}/api/import/current`);
    const run =
      response.status === 200 ? ((await response.json()) as ImportRun) : null;
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * The maintainer's case up to review: export, Factory reset, link the inner
 * folder, upload the Export's sheet from its `Meta/` folder in Link.
 */
async function exportedResetAndUploaded(): Promise<{
  storage: LibraryStorage;
  run: ImportRun;
}> {
  const { storage, baseUrl, dir, media } = freshApi();
  const movies = addLibrary(storage, dir, media);
  const destination = join(dir, 'Backups');
  mkdirSync(destination);

  expect(
    (
      await post(baseUrl, '/export', {
        name: NAME,
        format: 'csv',
        destination,
        images: true,
        subtitles: true,
      })
    ).status
  ).toBe(201);
  expect((await post(baseUrl, '/reset')).status).toBe(204);
  expect(storage.listMovies({ sort: 'a-z' })).toEqual([]);
  expect(
    (await post(baseUrl, '/library-folders', { path: movies })).status
  ).toBe(201);
  expect(
    (
      await post(baseUrl, '/import', {
        sheetPath: join(destination, NAME, 'Meta', 'familyflix-library.csv'),
        mode: 'link',
      })
    ).status
  ).toBe(201);

  return { storage, run: await untilReview(baseUrl) };
}

describe('POST /api/import: an Export of a nested library, uploaded after a Factory reset', () => {
  it('brings every title back with no Problem', async () => {
    const { storage, run } = await exportedResetAndUploaded();

    expect(run.problems).toEqual([]);
    expect(
      storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title)
    ).toEqual(['Amelie', 'Die Hard']);
  });

  it('sets every poster from the Export folder', async () => {
    const { storage } = await exportedResetAndUploaded();

    expect(
      storage.listMovies({ sort: 'a-z' }).map((movie) => ({
        title: movie.title,
        poster: movie.posterPath !== null,
        backdrop: movie.backdropPath !== null,
      }))
    ).toEqual([
      { title: 'Amelie', poster: true, backdrop: true },
      { title: 'Die Hard', poster: true, backdrop: true },
    ]);
  });
});
