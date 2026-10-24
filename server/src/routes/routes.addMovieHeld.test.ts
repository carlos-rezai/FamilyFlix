// @vitest-environment node
//
// 51 — Library audit, Phase 7 (issue #450): the movie add refuses a held
// video.
//
// `POST /api/movies` in **Link** asks the **Held video** rule
// (`storage.titleHolding`) of the found video's Library folder and relative
// path. A video a held title already plays, a film's **Linked video** or an
// episode's, is refused `409` with _<Title> already plays this file._, the
// holder's own title, the way a held **Show folder** is refused (log 48 Q10).
// The refusal adds nothing: no row, no Media folder. A video no title holds
// adds as before, a held film's Collection folder sibling included.
//
// Over a real listener, a real `fetch`, a real `:memory:` library, a sandboxed
// media root and one listed Library folder `Films/` beside it.

import express from 'express';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { Movie } from '@/types';

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

/** An MP4 that reports its own length, so a runtime needs no component. */
function mp4Of(seconds: number): Buffer {
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt8(0, 0);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16);

  const box = (type: string, payload: Buffer): Buffer => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(8 + payload.length, 0);
    header.write(type, 4, 'latin1');
    return Buffer.concat([header, payload]);
  };

  return Buffer.concat([
    box('ftyp', Buffer.from('isom', 'latin1')),
    box('moov', box('mvhd', mvhd)),
  ]);
}

/** Write a video at `path`, its folder made first. */
function videoAt(path: string): string {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, mp4Of(6000));
  return path;
}

/**
 * A fresh library behind a listening API, composed the way `main.ts` does,
 * with `Films/` listed: Heat in a folder of its own, two Star Wars films in a
 * Collection folder, and an episode of Harbor and Vine.
 */
function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-add-movie-held-');
  const media = join(root, 'media');
  const films = join(root, 'Films');
  mkdirSync(media);
  mkdirSync(films);
  const folderId = storage.addLibraryFolder(films).id;

  const heat = videoAt(join(films, 'Heat (1995)', 'Heat.1995.mp4'));
  const hope = videoAt(
    join(films, 'Star Wars', 'Star.Wars.A.New.Hope.1977.mp4')
  );
  const jedi = videoAt(join(films, 'Star Wars', 'Return.of.the.Jedi.1983.mp4'));
  const pilot = videoAt(
    join(films, 'Harbor and Vine', 'Harbor.and.Vine.S01E01.Pilot.mp4')
  );

  const mediaDomain = createMedia(media);
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) => storage.libraryFolders().find((f) => f.id === id)?.path ?? null
  );

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback }),
      createEnrichment({
        storage,
        client: offlineTmdb(),
        media: mediaDomain,
        playback,
      })
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    media,
    folderId,
    files: { heat, hope, jedi, pilot },
  };
}

type Part = [name: string, value: string];

/** A Link add of the found video at `videoPath`, titled `title`. */
function linkAdd(baseUrl: string, title: string, videoPath: string) {
  const parts: Part[] = [
    ['mode', 'link'],
    ['title', title],
    ['year', ''],
    ['director', ''],
    ['description', ''],
    ['rating', ''],
    ['videoPath', videoPath],
  ];
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(`${baseUrl}/api/movies`, { method: 'POST', body });
}

const titles = (storage: LibraryStorage): string[] =>
  storage
    .listMovies({ sort: 'a-z' })
    .map((movie) => movie.title)
    .sort();

describe('POST /api/movies — a video a held film already plays', () => {
  it('answers 409 naming the film that plays it', async () => {
    const { baseUrl, files } = freshApi();
    expect((await linkAdd(baseUrl, 'Heat', files.heat)).status).toBe(201);

    const response = await linkAdd(baseUrl, 'Heat (again)', files.heat);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'Heat already plays this file.',
    });
  });

  it('adds no row and no Media folder', async () => {
    const { storage, baseUrl, media, files } = freshApi();
    await linkAdd(baseUrl, 'Heat', files.heat);
    const mediaBefore = readdirSync(media).sort();

    await linkAdd(baseUrl, 'Heat (again)', files.heat);

    expect(titles(storage)).toEqual(['Heat']);
    expect(readdirSync(media).sort()).toEqual(mediaBefore);
  });
});

describe('POST /api/movies — a video a held episode already plays', () => {
  it('answers 409 naming the series, and adds nothing', async () => {
    const { storage, baseUrl, folderId, files } = freshApi();
    storage.addSeries({ title: 'Harbor and Vine', mediaFolder: 'harbor' }, [
      {
        season: 1,
        number: 1,
        videoPath: 'Harbor and Vine/Harbor.and.Vine.S01E01.Pilot.mp4',
        videoFolderId: folderId,
      },
    ]);

    const response = await linkAdd(baseUrl, 'Pilot', files.pilot);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'Harbor and Vine already plays this file.',
    });
    expect(titles(storage)).toEqual([]);
  });
});

describe('POST /api/movies — a video no title holds', () => {
  it('adds a held film’s Collection folder sibling as before', async () => {
    const { storage, baseUrl, folderId, files } = freshApi();
    expect((await linkAdd(baseUrl, 'A New Hope', files.hope)).status).toBe(201);

    const response = await linkAdd(baseUrl, 'Return of the Jedi', files.jedi);

    expect(response.status).toBe(201);
    const movie = (await response.json()) as Movie;
    expect(storage.getMovie(movie.id)).toMatchObject({
      videoPath: 'Star Wars/Return.of.the.Jedi.1983.mp4',
      videoFolderId: folderId,
    });
    expect(titles(storage)).toEqual(['A New Hope', 'Return of the Jedi']);
  });
});
