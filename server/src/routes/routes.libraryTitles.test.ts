// @vitest-environment node
//
// 47 — Manage library, Phase 1: "the list, read-only" (issue #407).
//
// `GET /api/library-titles` → `{ movies, series }`, the **Manage library
// page**'s one read for both tabs: every **Library title** A–Z, each with
// `kind`, its **Details state**, and `path` absolute — a linked title's
// **Source folder** (a **Collection folder** film's video), else its **Media
// folder** — `originalPath` the Source folder of a copied title found in a
// **Library folder**, and `linkedFiles`, `media/linkedFiles`' answer, `null`
// for a copied title. A show with one linked episode is linked. Reach is read
// afresh on every call, so a Library folder unplugged answers `unreachable`
// and plugged back in answers as before.
//
// Over a real listener, a real `:memory:` library, a sandboxed media root and
// a sandboxed Library folder, `routes.unreachableFolder`'s harness.

import express from 'express';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
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

/** A file at a path under a root, its directories made. */
function place(root: string, relative: string): void {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, 'bytes');
}

/**
 * A fresh library behind a listening API, a managed media root and one listed
 * Library folder, `Movies/`, empty until a test fills it.
 */
function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-library-titles-');
  const media = join(root, 'media');
  const library = join(root, 'Movies');
  mkdirSync(media);
  mkdirSync(library);
  const folderId = storage.addLibraryFolder(library).id;

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
    baseUrl: `http://127.0.0.1:${port}`,
    storage,
    root,
    media,
    library,
    folderId,
  };
}

type Api = ReturnType<typeof freshApi>;

/** A film linked where it lies, in a Source folder of its own. */
function linkedFilm(api: Api, title: string, folder: string, file: string) {
  place(api.library, `${folder}/${file}`);
  const film = api.storage.addMovie({
    title,
    videoPath: `${folder}/${file}`,
    videoFolderId: api.folderId,
    mediaFolder: `${title.toLowerCase()}-managed`,
  });
  api.storage.setSourceFolder(film.id, api.folderId, folder);
  return film;
}

interface WireTitle {
  kind: string;
  id: string;
  title: string;
  year: number | null;
  path: string;
  linkedFiles: string | null;
  originalPath: string | null;
  details: string;
  files?: number;
  endYear?: number | null;
  seasons?: number;
  episodes?: number;
}

async function readTitles(
  api: Api
): Promise<{ status: number; movies: WireTitle[]; series: WireTitle[] }> {
  const response = await fetch(`${api.baseUrl}/api/library-titles`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    movies: WireTitle[];
    series: WireTitle[];
  };
  return { status: response.status, ...body };
}

const titled = (list: WireTitle[], title: string) =>
  list.find((entry) => entry.title === title);

describe('GET /api/library-titles — both kinds', () => {
  it('answers 200 with two empty lists on a fresh library', async () => {
    const api = freshApi();

    const { status, movies, series } = await readTitles(api);

    expect(status).toBe(200);
    expect(movies).toEqual([]);
    expect(series).toEqual([]);
  });

  it('answers the films and the series apart, each A–Z and each kinded', async () => {
    const api = freshApi();
    api.storage.addMovie({ title: 'zodiac', videoPath: 'zodiac/z.mkv' });
    api.storage.addMovie({ title: 'Alien', videoPath: 'alien/a.mkv' });
    api.storage.addSeries({ title: 'Wanderers', mediaFolder: 'wanderers' });
    api.storage.addSeries({ title: 'beacon Hill', mediaFolder: 'beacon' });

    const { movies, series } = await readTitles(api);

    expect(movies.map((movie) => [movie.kind, movie.title])).toEqual([
      ['movie', 'Alien'],
      ['movie', 'zodiac'],
    ]);
    expect(series.map((show) => [show.kind, show.title])).toEqual([
      ['series', 'beacon Hill'],
      ['series', 'Wanderers'],
    ]);
  });

  it('answers a film’s id, year, files and Details state', async () => {
    const api = freshApi();
    const film = api.storage.addMovie({
      title: 'Heat',
      year: 1995,
      videoPath: 'heat-1995/Heat.mkv',
      mediaFolder: 'heat-1995',
      subtitles: [{ path: 'heat-1995/Heat.en.srt', language: 'English' }],
    });

    const { movies } = await readTitles(api);

    expect(titled(movies, 'Heat')).toMatchObject({
      kind: 'movie',
      id: film.id,
      year: 1995,
      files: 2,
      details: 'own',
    });
  });

  it('answers a show’s Year range, season and episode counts', async () => {
    const api = freshApi();
    api.storage.addSeries(
      {
        title: 'Harbor and Vine',
        year: 2019,
        endYear: 2023,
        mediaFolder: 'harbor',
      },
      [
        { season: 1, number: 1, videoPath: 'harbor/season-01/S01E01.mkv' },
        { season: 1, number: 2, videoPath: 'harbor/season-01/S01E02.mkv' },
        { season: 2, number: 1, videoPath: 'harbor/season-02/S02E01.mkv' },
      ]
    );

    const { series } = await readTitles(api);

    expect(titled(series, 'Harbor and Vine')).toMatchObject({
      kind: 'series',
      year: 2019,
      endYear: 2023,
      seasons: 2,
      episodes: 3,
      details: 'own',
    });
  });
});

describe('GET /api/library-titles — the paths, absolute', () => {
  it('answers a linked film’s Source folder, whole as its Linked files', async () => {
    const api = freshApi();
    linkedFilm(api, 'Heat', 'Heat (1995)', 'Heat.1995.mkv');

    const { movies } = await readTitles(api);

    expect(titled(movies, 'Heat')).toMatchObject({
      path: join(api.library, 'Heat (1995)'),
      linkedFiles: 'folder',
      originalPath: null,
    });
  });

  it('answers a Collection folder film’s video, its Linked files its videos', async () => {
    const api = freshApi();
    place(api.library, 'Collection/Heat.mkv');
    place(api.library, 'Collection/Coco.mkv');
    for (const [title, file] of [
      ['Heat', 'Heat.mkv'],
      ['Coco', 'Coco.mkv'],
    ] as const) {
      const film = api.storage.addMovie({
        title,
        videoPath: `Collection/${file}`,
        videoFolderId: api.folderId,
        mediaFolder: `${title.toLowerCase()}-managed`,
      });
      api.storage.setSourceFolder(film.id, api.folderId, 'Collection', file);
    }

    const { movies } = await readTitles(api);

    expect(titled(movies, 'Heat')).toMatchObject({
      path: join(api.library, 'Collection', 'Heat.mkv'),
      linkedFiles: 'videos',
    });
    expect(titled(movies, 'Coco')).toMatchObject({
      path: join(api.library, 'Collection', 'Coco.mkv'),
      linkedFiles: 'videos',
    });
  });

  it('answers a copied film’s Media folder, with no Linked files and no original', async () => {
    const api = freshApi();
    api.storage.addMovie({
      title: 'Heat',
      videoPath: 'heat-1995/Heat.mkv',
      mediaFolder: 'heat-1995',
    });

    const { movies } = await readTitles(api);

    expect(titled(movies, 'Heat')).toMatchObject({
      path: join(api.media, 'heat-1995'),
      linkedFiles: null,
      originalPath: null,
    });
  });

  it('answers a copied film found in a Library folder with its original’s path', async () => {
    const api = freshApi();
    place(api.library, 'Heat (1995)/Heat.1995.mkv');
    const film = api.storage.addMovie({
      title: 'Heat',
      videoPath: 'heat-1995/Heat.1995.mkv',
      mediaFolder: 'heat-1995',
    });
    api.storage.setSourceFolder(film.id, api.folderId, 'Heat (1995)');

    const { movies } = await readTitles(api);

    expect(titled(movies, 'Heat')).toMatchObject({
      path: join(api.media, 'heat-1995'),
      linkedFiles: null,
      originalPath: join(api.library, 'Heat (1995)'),
    });
  });

  it('answers a linked show’s Show folder', async () => {
    const api = freshApi();
    place(api.library, 'Harbor and Vine/Season 01/S01E01.mkv');
    const show = api.storage.addSeries(
      { title: 'Harbor and Vine', mediaFolder: 'harbor' },
      [
        {
          season: 1,
          number: 1,
          videoPath: 'Harbor and Vine/Season 01/S01E01.mkv',
          videoFolderId: api.folderId,
        },
      ]
    );
    api.storage.setSourceFolder(show.id, api.folderId, 'Harbor and Vine');

    const { series } = await readTitles(api);

    expect(titled(series, 'Harbor and Vine')).toMatchObject({
      path: join(api.library, 'Harbor and Vine'),
      linkedFiles: 'folder',
    });
  });

  it('answers a show with one linked episode as linked, its linked episodes only', async () => {
    const api = freshApi();
    place(api.library, 'Harbor and Vine/Season 01/S01E01.mkv');
    place(api.library, 'Harbor and Vine/Season 01/S01E02.mkv');
    const show = api.storage.addSeries(
      { title: 'Harbor and Vine', mediaFolder: 'harbor' },
      [
        {
          season: 1,
          number: 1,
          videoPath: 'Harbor and Vine/Season 01/S01E01.mkv',
          videoFolderId: api.folderId,
        },
        { season: 1, number: 2, videoPath: 'harbor/season-01/S01E02.mkv' },
      ]
    );
    api.storage.setSourceFolder(show.id, api.folderId, 'Harbor and Vine');

    const { series } = await readTitles(api);

    expect(titled(series, 'Harbor and Vine')?.linkedFiles).toBe('videos');
  });

  it('answers loose episodes at the Library folder’s root as videos, never the folder', async () => {
    const api = freshApi();
    place(api.library, 'Harbor.S01E01.mkv');
    const show = api.storage.addSeries(
      { title: 'Harbor', mediaFolder: 'harbor' },
      [
        {
          season: 1,
          number: 1,
          videoPath: 'Harbor.S01E01.mkv',
          videoFolderId: api.folderId,
        },
      ]
    );
    api.storage.setSourceFolder(show.id, api.folderId, '');

    const { series } = await readTitles(api);

    expect(titled(series, 'Harbor')?.linkedFiles).toBe('videos');
  });

  it('answers a copied show’s Series folder, with no Linked files', async () => {
    const api = freshApi();
    api.storage.addSeries({ title: 'Harbor and Vine', mediaFolder: 'harbor' }, [
      { season: 1, number: 1, videoPath: 'harbor/season-01/S01E01.mkv' },
    ]);

    const { series } = await readTitles(api);

    expect(titled(series, 'Harbor and Vine')).toMatchObject({
      path: join(api.media, 'harbor'),
      linkedFiles: null,
    });
  });
});

describe('GET /api/library-titles — reach, read afresh', () => {
  it('answers an unreadable Library folder’s linked title as unreachable, its path kept', async () => {
    const api = freshApi();
    linkedFilm(api, 'Heat', 'Heat (1995)', 'Heat.1995.mkv');
    renameSync(api.library, join(api.root, 'Unplugged'));

    const { movies } = await readTitles(api);

    expect(titled(movies, 'Heat')).toMatchObject({
      linkedFiles: 'unreachable',
      path: join(api.library, 'Heat (1995)'),
    });
  });

  it('reads reach on every call: unplugged, then plugged back in', async () => {
    const api = freshApi();
    linkedFilm(api, 'Heat', 'Heat (1995)', 'Heat.1995.mkv');

    expect(titled((await readTitles(api)).movies, 'Heat')?.linkedFiles).toBe(
      'folder'
    );

    renameSync(api.library, join(api.root, 'Unplugged'));
    expect(titled((await readTitles(api)).movies, 'Heat')?.linkedFiles).toBe(
      'unreachable'
    );

    renameSync(join(api.root, 'Unplugged'), api.library);
    expect(titled((await readTitles(api)).movies, 'Heat')?.linkedFiles).toBe(
      'folder'
    );
  });

  it('answers a copied title the same while its Library folder is unplugged', async () => {
    const api = freshApi();
    place(api.library, 'Heat (1995)/Heat.1995.mkv');
    const film = api.storage.addMovie({
      title: 'Heat',
      videoPath: 'heat-1995/Heat.1995.mkv',
      mediaFolder: 'heat-1995',
    });
    api.storage.setSourceFolder(film.id, api.folderId, 'Heat (1995)');
    renameSync(api.library, join(api.root, 'Unplugged'));

    const { movies } = await readTitles(api);

    expect(titled(movies, 'Heat')).toMatchObject({
      linkedFiles: null,
      path: join(api.media, 'heat-1995'),
    });
  });
});
