// @vitest-environment node
//
// 70, Video quality, Phase 7: the filter (issue #670).
//
// Every route that reads `?rating=` also reads `?quality=`, the rung
// lowercased (`4k`, `1080p`, `720p`, `480p`), as the **Library query**'s
// `minQuality`. Movies are kept on their own `video_quality` and series on
// their **Series quality**, both ranked on the **Quality ladder**, so a rung
// keeps every title at or above it and drops the unmeasured ones; the filter
// combines with genre and rating. A value off the ladder is a 400.
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

  const media = join(sandboxRoot('familyflix-quality-filter-'), 'media');
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

async function moviesAt(baseUrl: string, search: string): Promise<string[]> {
  const response = await fetch(`${baseUrl}/api/movies?sort=a-z&${search}`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as MovieGridPayload;
  return body.movies.map((movie) => movie.title);
}

async function seriesAt(baseUrl: string, search: string): Promise<string[]> {
  const response = await fetch(`${baseUrl}/api/series?sort=a-z&${search}`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as SeriesHomePayload;
  return body.series.map((series) => series.title);
}

describe('?quality= on the movies', () => {
  it('keeps the films at or above the rung and drops the unmeasured ones', async () => {
    const { baseUrl, storage } = freshApi();
    seedFilms(storage);

    expect(await moviesAt(baseUrl, 'quality=4k')).toEqual(['Film 4K']);
    expect(await moviesAt(baseUrl, 'quality=1080p')).toEqual([
      'Film 1080p',
      'Film 4K',
    ]);
    expect(await moviesAt(baseUrl, 'quality=720p')).toEqual([
      'Film 1080p',
      'Film 4K',
      'Film 720p',
    ]);
    expect(await moviesAt(baseUrl, 'quality=480p')).toEqual([
      'Film 1080p',
      'Film 480p',
      'Film 4K',
      'Film 720p',
    ]);
  });

  it('narrows the home rows and its sections the same way', async () => {
    const { baseUrl, storage } = freshApi();
    seedFilms(storage);

    const response = await fetch(`${baseUrl}/api/home?quality=1080p`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as HomePayload;
    const comedy = body.rows.find((row) => row.genre === 'Comedy');
    expect(comedy?.movies.map((movie) => movie.title).sort()).toEqual([
      'Film 1080p',
      'Film 4K',
    ]);
  });

  it('combines with the genre and the rating', async () => {
    const { baseUrl, storage } = freshApi();
    seedFilms(storage);
    storage.addMovie(
      newMovie({
        title: 'Weepie 4K',
        videoPath: 'Weepie/weepie.mkv',
        genres: ['Drama'],
        rating: 8,
        videoQuality: '4K',
      })
    );
    storage.addMovie(
      newMovie({
        title: 'Low-rated 4K',
        videoPath: 'Low/low.mkv',
        genres: ['Comedy'],
        rating: 4,
        videoQuality: '4K',
      })
    );

    expect(
      await moviesAt(baseUrl, 'quality=1080p&genre=Comedy&rating=8')
    ).toEqual(['Film 1080p', 'Film 4K']);
  });
});

describe('?quality= on the series', () => {
  it('keeps the series whose Series quality is at or above the rung', async () => {
    const { baseUrl, storage } = freshApi();
    seedSeries(storage);

    expect(await seriesAt(baseUrl, 'quality=4k')).toEqual(['Show 4K']);
    expect(await seriesAt(baseUrl, 'quality=720p')).toEqual([
      'Show 4K',
      'Show 720p',
    ]);
    expect(await seriesAt(baseUrl, 'quality=480p')).toEqual([
      'Show 480p',
      'Show 4K',
      'Show 720p',
    ]);
  });

  it('narrows the By genre rows the same way, combined with genre and rating', async () => {
    const { baseUrl, storage } = freshApi();
    seedSeries(storage);
    storage.addSeries(
      { title: 'Drama 4K', genres: ['Drama'], rating: 8 },
      episodes('Drama 4K', ['4K'])
    );
    storage.addSeries(
      { title: 'Low-rated 4K', genres: ['Comedy'], rating: 4 },
      episodes('Low-rated 4K', ['4K'])
    );

    const response = await fetch(
      `${baseUrl}/api/series/rows?sort=a-z&quality=720p&genre=Comedy&rating=8`
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SeriesRowsPayload;
    expect(body.rows.map((row) => row.genre)).toEqual(['Comedy']);
    expect(body.rows[0].series.map((series) => series.title)).toEqual([
      'Show 4K',
      'Show 720p',
    ]);
  });
});

describe('?quality= off the ladder', () => {
  it.each([
    ['/api/home', '8k'],
    ['/api/movies', '1080'],
    ['/api/series', 'best'],
    ['/api/series/rows', '2160p'],
  ])('answers %s?quality=%s with 400 Invalid quality', async (path, value) => {
    const { baseUrl } = freshApi();

    const response = await fetch(`${baseUrl}${path}?quality=${value}`);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: `Invalid quality: ${value}`,
    });
  });
});
