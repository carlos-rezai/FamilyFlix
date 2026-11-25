// @vitest-environment node
//
// 73, Header fit, Phase 3 (issue #696): the filter by quality is gone. A
// held `?quality=`, a rung or not, is read past as any unknown parameter:
// every browse answers 200 with the whole library, replacing 70's filter
// and its `400 Invalid quality`.
//
// Over a real listener and a real `:memory:` library, `routes.movieGrid`'s
// harness.

import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { unfittedArt } from '../test-support/unfittedArt/unfittedArt';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleFrameFill } from '../test-support/idleFrameFill/idleFrameFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import { newMovie } from '../test-support/newMovie/newMovie';
import type {
  HomePayload,
  MovieGridPayload,
  NewEpisode,
  SeriesHomePayload,
  SeriesRowsPayload,
  VideoQuality,
} from '@/types';

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

/** A fresh library behind a listening API. */
function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const media = join(sandboxRoot('familyflix-quality-ignored-'), 'media');
  mkdirSync(media);
  const mediaDomain = createMedia(media, unfittedArt());
  const playback = createPlayback(media, fixedSlot(null), () => null);

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
        frameFill: idleFrameFill(),
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
  return { baseUrl: `http://127.0.0.1:${port}`, storage };
}

/** One film per rung and one unmeasured, all Comedy, all rated 8. */
function seedFilms(storage: LibraryStorage) {
  const rungs: (VideoQuality | undefined)[] = [
    '4K',
    '1080p',
    '720p',
    '480p',
    'SD',
    undefined,
  ];
  for (const rung of rungs) {
    const title = `Film ${rung ?? 'unmeasured'}`;
    storage.addMovie(
      newMovie({
        title,
        videoPath: `${title}/${title}.mkv`,
        genres: ['Comedy'],
        rating: 8,
        ...(rung === undefined ? {} : { videoQuality: rung }),
      })
    );
  }
}

/** Season 1's episodes, one per rung given (`undefined` unmeasured). */
function episodes(
  folder: string,
  rungs: (VideoQuality | undefined)[]
): NewEpisode[] {
  return rungs.map((rung, index) => ({
    season: 1,
    number: index + 1,
    videoPath: `${folder}/Season 01/e${index + 1}.mkv`,
    ...(rung === undefined ? {} : { videoQuality: rung }),
  }));
}

/**
 * Four series whose **Series quality** is the rung most episodes are on: a
 * mostly-4K show, a mostly-720p show with one 4K episode (so its Series
 * quality, not its best episode, decides), a 480p show, and one with no
 * measured episode at all.
 */
function seedSeries(storage: LibraryStorage) {
  storage.addSeries(
    { title: 'Show 4K', genres: ['Comedy'], rating: 8 },
    episodes('Show 4K', ['4K', '4K', '720p'])
  );
  storage.addSeries(
    { title: 'Show 720p', genres: ['Comedy'], rating: 8 },
    episodes('Show 720p', ['720p', '720p', '4K'])
  );
  storage.addSeries(
    { title: 'Show 480p', genres: ['Comedy'], rating: 8 },
    episodes('Show 480p', ['480p'])
  );
  storage.addSeries(
    { title: 'Show unmeasured', genres: ['Comedy'], rating: 8 },
    episodes('Show unmeasured', [undefined, undefined])
  );
}

const ALL_FILMS = [
  'Film 1080p',
  'Film 480p',
  'Film 4K',
  'Film 720p',
  'Film SD',
  'Film unmeasured',
];

const ALL_SERIES = ['Show 480p', 'Show 4K', 'Show 720p', 'Show unmeasured'];

async function ok<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`);
  expect(response.status).toBe(200);
  return (await response.json()) as T;
}

describe('a held ?quality= on the movies', () => {
  it('answers GET /api/home?quality=4k with the whole library', async () => {
    const { baseUrl, storage } = freshApi();
    seedFilms(storage);

    const body = await ok<HomePayload>(baseUrl, '/api/home?quality=4k');

    const comedy = body.rows.find((row) => row.genre === 'Comedy');
    expect(comedy?.movies.map((movie) => movie.title).sort()).toEqual(
      ALL_FILMS
    );
  });

  it('answers GET /api/movies?quality=1080p with every film', async () => {
    const { baseUrl, storage } = freshApi();
    seedFilms(storage);

    const body = await ok<MovieGridPayload>(
      baseUrl,
      '/api/movies?sort=a-z&quality=1080p'
    );

    expect(body.movies.map((movie) => movie.title)).toEqual(ALL_FILMS);
  });
});

describe('a held ?quality= on the series', () => {
  it('answers GET /api/series?quality=nope with the whole library', async () => {
    const { baseUrl, storage } = freshApi();
    seedSeries(storage);

    const body = await ok<SeriesHomePayload>(
      baseUrl,
      '/api/series?sort=a-z&quality=nope'
    );

    expect(body.series.map((series) => series.title)).toEqual(ALL_SERIES);
  });

  it('answers GET /api/series/rows?quality=4k with every series', async () => {
    const { baseUrl, storage } = freshApi();
    seedSeries(storage);

    const body = await ok<SeriesRowsPayload>(
      baseUrl,
      '/api/series/rows?sort=a-z&quality=4k'
    );

    expect(body.rows.map((row) => row.genre)).toEqual(['Comedy']);
    expect(body.rows[0].series.map((series) => series.title)).toEqual(
      ALL_SERIES
    );
  });
});
