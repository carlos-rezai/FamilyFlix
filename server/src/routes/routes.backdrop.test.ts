// @vitest-environment node
//
// 76, Whole add, Phase 1 (issue #716): the Backdrop by hand.
//
// The **Backdrop** travels as the Poster does, word for word: a **Picked
// file** is a `backdrop` part; a held **Stored path** on an edit is a
// `backdropPath` field. On an edit the body is the whole record, so sending
// neither removes it. `POST /movies`, `PATCH /movies/:id`, `POST /series` and
// `PATCH /series/:id` store it as `backdrop_path`; a replaced or removed file
// is deleted only after the commit, so a refused save loses nothing. A linked
// title's backdrop is written into its Title folder's `Images/` by the
// **Layout fill**.
//
// Over a real listener composed the way `main.ts` does, a real `:memory:`
// library, a sandboxed media root and a sandboxed Library folder.

import express from 'express';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { FIXTURE_VIDEO } from '../test-support/fixtureVideo/fixtureVideo';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleFrameFill } from '../test-support/idleFrameFill/idleFrameFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../test-support/unfittedArt/unfittedArt';
import type { Episode, Movie, Series } from '@/types';

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

const HEAT_VIDEO = 'Heat (1995)/Heat.1995.mp4';

function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-backdrop-route-');
  const media = join(root, 'media');
  const library = join(root, 'Library');
  mkdirSync(media);
  mkdirSync(join(library, 'Heat (1995)'), { recursive: true });
  copyFileSync(FIXTURE_VIDEO, join(library, ...HEAT_VIDEO.split('/')));
  storage.addLibraryFolder(library);

  const mediaDomain = createMedia(media, unfittedArt());
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
      createLayoutFill({ storage, media: mediaDomain }),
      idleFrameFill()
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    media,
    titleFolder: join(library, 'Heat (1995)'),
  };
}

type Part = [name: string, value: string | File];

const BACKDROP_BYTES = 'a wide still of the harbour';
const BETTER_BYTES = 'a better wide still';

const backdropPart = (filename = 'backdrop.jpg', bytes = BACKDROP_BYTES) =>
  new File([bytes], filename, { type: 'image/jpeg' });

const videoPart = (filename: string): File =>
  new File([new Uint8Array(readFileSync(FIXTURE_VIDEO))], filename, {
    type: 'video/mp4',
  });

function send(url: string, method: 'POST' | 'PATCH', parts: Part[]) {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(url, { method, body });
}

const stored = (media: string, path: string | null | undefined): string =>
  join(media, path ?? '');

// --- The movie kind ----------------------------------------------------------

const KEEPER_FIELDS: Part[] = [
  ['title', 'The Lantern Keeper'],
  ['year', '2019'],
  ['director', ''],
  ['description', ''],
  ['rating', ''],
];

async function addKeeper(baseUrl: string, extra: Part[] = []): Promise<Movie> {
  const response = await send(`${baseUrl}/api/movies`, 'POST', [
    ['mode', 'copy'],
    ...KEEPER_FIELDS,
    ['video', videoPart('lantern.mp4')],
    ...extra,
  ]);
  expect(response.status).toBe(201);
  return (await response.json()) as Movie;
}

/** The movie as the form sends it with nothing re-picked, then `extra`. */
function heldMovie(movie: Movie, extra: Part[] = []): Part[] {
  return [...KEEPER_FIELDS, ['videoPath', movie.videoPath], ...extra];
}

const readMovie = async (baseUrl: string, id: string): Promise<Movie> =>
  (await (await fetch(`${baseUrl}/api/movies/${id}`)).json()) as Movie;

describe('POST /api/movies: the backdrop part', () => {
  it('stores a picked backdrop as the movie’s backdrop, its bytes on disk', async () => {
    const { baseUrl, media } = freshApi();

    const movie = await addKeeper(baseUrl, [['backdrop', backdropPart()]]);

    expect(movie.backdropPath).not.toBeNull();
    expect(readFileSync(stored(media, movie.backdropPath), 'utf8')).toBe(
      BACKDROP_BYTES
    );
    expect((await readMovie(baseUrl, movie.id)).backdropPath).toBe(
      movie.backdropPath
    );
  });
});

describe('PATCH /api/movies/:id: the backdrop', () => {
  it('keeps the held backdrop an edit sends as its Stored path', async () => {
    const { baseUrl, media } = freshApi();
    const movie = await addKeeper(baseUrl, [['backdrop', backdropPart()]]);

    const response = await send(
      `${baseUrl}/api/movies/${movie.id}`,
      'PATCH',
      heldMovie(movie, [['backdropPath', movie.backdropPath ?? '']])
    );

    expect(response.status).toBe(200);
    expect((await readMovie(baseUrl, movie.id)).backdropPath).toBe(
      movie.backdropPath
    );
    expect(readFileSync(stored(media, movie.backdropPath), 'utf8')).toBe(
      BACKDROP_BYTES
    );
  });

  it('replaces it with a new pick, the old file deleted', async () => {
    const { baseUrl, media } = freshApi();
    const movie = await addKeeper(baseUrl, [['backdrop', backdropPart()]]);

    const response = await send(
      `${baseUrl}/api/movies/${movie.id}`,
      'PATCH',
      heldMovie(movie, [['backdrop', backdropPart('wide.jpg', BETTER_BYTES)]])
    );

    expect(response.status).toBe(200);
    const amended = await readMovie(baseUrl, movie.id);
    expect(amended.backdropPath).not.toBe(movie.backdropPath);
    expect(readFileSync(stored(media, amended.backdropPath), 'utf8')).toBe(
      BETTER_BYTES
    );
    expect(existsSync(stored(media, movie.backdropPath))).toBe(false);
  });

  it('adds one to a movie that had none', async () => {
    const { baseUrl, media } = freshApi();
    const movie = await addKeeper(baseUrl);

    const response = await send(
      `${baseUrl}/api/movies/${movie.id}`,
      'PATCH',
      heldMovie(movie, [['backdrop', backdropPart()]])
    );

    expect(response.status).toBe(200);
    const amended = await readMovie(baseUrl, movie.id);
    expect(readFileSync(stored(media, amended.backdropPath), 'utf8')).toBe(
      BACKDROP_BYTES
    );
  });

  it('removes it when the edit sends neither, the old file deleted', async () => {
    const { baseUrl, media } = freshApi();
    const movie = await addKeeper(baseUrl, [['backdrop', backdropPart()]]);

    const response = await send(
      `${baseUrl}/api/movies/${movie.id}`,
      'PATCH',
      heldMovie(movie)
    );

    expect(response.status).toBe(200);
    expect((await readMovie(baseUrl, movie.id)).backdropPath).toBeNull();
    expect(existsSync(stored(media, movie.backdropPath))).toBe(false);
  });

  it('loses nothing when the edit is refused', async () => {
    const { baseUrl, media } = freshApi();
    const movie = await addKeeper(baseUrl, [['backdrop', backdropPart()]]);

    const response = await send(
      `${baseUrl}/api/movies/${movie.id}`,
      'PATCH',
      heldMovie(movie, [
        ['backdrop', backdropPart('wide.jpg', BETTER_BYTES)],
        ['genre', 'Documentaries'],
      ])
    );

    expect(response.status).toBe(400);
    expect((await readMovie(baseUrl, movie.id)).backdropPath).toBe(
      movie.backdropPath
    );
    expect(readFileSync(stored(media, movie.backdropPath), 'utf8')).toBe(
      BACKDROP_BYTES
    );
  });

  it('loses nothing when a removal is refused', async () => {
    const { baseUrl, media } = freshApi();
    const movie = await addKeeper(baseUrl, [['backdrop', backdropPart()]]);

    const response = await send(
      `${baseUrl}/api/movies/${movie.id}`,
      'PATCH',
      heldMovie(movie, [['genre', 'Documentaries']])
    );

    expect(response.status).toBe(400);
    expect((await readMovie(baseUrl, movie.id)).backdropPath).toBe(
      movie.backdropPath
    );
    expect(existsSync(stored(media, movie.backdropPath))).toBe(true);
  });
});

// --- The series kind ---------------------------------------------------------

const HARBOR_FIELDS: Part[] = [
  ['title', 'Harbor and Vine'],
  ['year', '2019–2023'],
  ['creator', ''],
  ['description', ''],
  ['rating', ''],
];

async function addHarbor(baseUrl: string, extra: Part[] = []): Promise<Series> {
  const response = await send(`${baseUrl}/api/series`, 'POST', [
    ['mode', 'copy'],
    ...HARBOR_FIELDS,
    ...extra,
    ['episode', JSON.stringify({ season: 1, number: 1, title: 'Pilot' })],
    ['episodeVideo', videoPart('S01E01.mp4')],
  ]);
  expect(response.status).toBe(201);
  return (await response.json()) as Series;
}

function heldEpisodeField(episode: Episode): Part {
  return [
    'episode',
    JSON.stringify({
      id: episode.id,
      season: episode.season,
      number: episode.number,
      title: episode.title ?? '',
      videoPath: episode.videoPath,
      storedSubtitles: [],
      subtitleLanguages: [],
    }),
  ];
}

/** The series as the form sends it, `art` where the poster's parts go. */
function heldSeries(
  storage: LibraryStorage,
  id: string,
  art: Part[] = [],
  episodes?: Part[]
): Part[] {
  return [
    ...HARBOR_FIELDS,
    ...art,
    ...(episodes ?? storage.listEpisodes(id).map(heldEpisodeField)),
  ];
}

const backdropOf = (storage: LibraryStorage, id: string) =>
  storage.getSeriesDetail(id)?.series.backdropPath ?? null;

const patchSeries = (baseUrl: string, id: string, parts: Part[]) =>
  send(`${baseUrl}/api/series/${encodeURIComponent(id)}`, 'PATCH', parts);

describe('POST /api/series: the backdrop part', () => {
  it('stores a picked backdrop as the series’ backdrop, its bytes on disk', async () => {
    const { storage, baseUrl, media } = freshApi();

    const series = await addHarbor(baseUrl, [['backdrop', backdropPart()]]);

    const held = backdropOf(storage, series.id);
    expect(held).not.toBeNull();
    expect(readFileSync(stored(media, held), 'utf8')).toBe(BACKDROP_BYTES);
  });
});

describe('PATCH /api/series/:id: the backdrop', () => {
  it('keeps the held backdrop an edit sends as its Stored path', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl, [['backdrop', backdropPart()]]);
    const held = backdropOf(storage, series.id);

    const response = await patchSeries(
      baseUrl,
      series.id,
      heldSeries(storage, series.id, [['backdropPath', held ?? '']])
    );

    expect(response.status).toBe(200);
    expect(backdropOf(storage, series.id)).toBe(held);
    expect(readFileSync(stored(media, held), 'utf8')).toBe(BACKDROP_BYTES);
  });

  it('replaces it with a new pick, the old file deleted', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl, [['backdrop', backdropPart()]]);
    const held = backdropOf(storage, series.id);

    const response = await patchSeries(
      baseUrl,
      series.id,
      heldSeries(storage, series.id, [
        ['backdrop', backdropPart('wide.jpg', BETTER_BYTES)],
      ])
    );

    expect(response.status).toBe(200);
    const replaced = backdropOf(storage, series.id);
    expect(replaced).not.toBe(held);
    expect(readFileSync(stored(media, replaced), 'utf8')).toBe(BETTER_BYTES);
    expect(existsSync(stored(media, held))).toBe(false);
  });

  it('removes it when the edit sends neither, the old file deleted', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl, [['backdrop', backdropPart()]]);
    const held = backdropOf(storage, series.id);

    const response = await patchSeries(
      baseUrl,
      series.id,
      heldSeries(storage, series.id)
    );

    expect(response.status).toBe(200);
    expect(backdropOf(storage, series.id)).toBeNull();
    expect(existsSync(stored(media, held))).toBe(false);
  });

  it('loses nothing when the edit is refused', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl, [['backdrop', backdropPart()]]);
    const held = backdropOf(storage, series.id);
    const [pilot] = storage.listEpisodes(series.id);

    // The pilot sent twice is a `400` after the new backdrop's bytes landed.
    const response = await patchSeries(
      baseUrl,
      series.id,
      heldSeries(
        storage,
        series.id,
        [['backdrop', backdropPart('wide.jpg', BETTER_BYTES)]],
        [heldEpisodeField(pilot), heldEpisodeField(pilot)]
      )
    );

    expect(response.status).toBe(400);
    expect(backdropOf(storage, series.id)).toBe(held);
    expect(readFileSync(stored(media, held), 'utf8')).toBe(BACKDROP_BYTES);
  });
});

// --- The Layout fill ---------------------------------------------------------

describe('POST /api/movies: a linked title’s backdrop and the Layout fill', () => {
  it('writes the picked backdrop into the Title folder’s Images/', async () => {
    const { baseUrl, titleFolder } = freshApi();

    const response = await send(`${baseUrl}/api/movies`, 'POST', [
      ['mode', 'link'],
      ['title', 'Heat'],
      ['year', '1995'],
      ['director', ''],
      ['description', ''],
      ['rating', ''],
      ['videoPath', join(titleFolder, 'Heat.1995.mp4')],
      ['backdrop', backdropPart('wide.jpg')],
    ]);

    expect(response.status).toBe(201);
    const images = join(titleFolder, 'Images');
    expect(existsSync(images) ? readdirSync(images) : []).toContain(
      'backdrop.jpg'
    );
    expect(readFileSync(join(images, 'backdrop.jpg'), 'utf8')).toBe(
      BACKDROP_BYTES
    );
  });
});
