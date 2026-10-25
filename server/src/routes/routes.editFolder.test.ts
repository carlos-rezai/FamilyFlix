// @vitest-environment node
//
// 51, Library audit, the follow-up: "an edit owns its folder" (issue #468).
//
// `PATCH /api/movies/:id` and `PATCH /api/series/:id` reserve a folder when
// the title's recorded **Media folder** is gone, and record it as the title's
// Media folder when the edit commits, so a later Delete finds it. The movie
// edit's rollback removes a folder it reserved, as the series edit's does; an
// edit that reuses its recorded folder is unchanged.
//
// A title "whose recorded folder is gone" is seeded straight into storage with
// a `mediaFolder` naming nothing on disk, its video a Stored path under it that
// is gone too (the household's dead film). Over a real listener, a real
// `:memory:` library and a sandboxed media root.

import express from 'express';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, posix } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia, type Media } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { Episode, Movie } from '@/types';

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

/** A fresh library behind a listening API, composed the way `main.ts` does. */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  mediaDomain: Media;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const media = join(sandboxRoot('familyflix-edit-folder-'), 'media');
  mkdirSync(media);
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null), () => null);

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
  return { storage, baseUrl: `http://127.0.0.1:${port}`, media, mediaDomain };
}

type Part = [name: string, value: string | File];

function patch(url: string, parts: Part[]): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(url, { method: 'PATCH', body });
}

const posterPart = (filename = 'poster.jpg'): File =>
  new File([new Uint8Array(Buffer.from('image bytes'))], filename, {
    type: 'image/jpeg',
  });

const bytes = (text: string) => Readable.from([Buffer.from(text)]);

/** Every entry directly under the media root. */
const topLevel = (media: string): string[] =>
  existsSync(media) ? readdirSync(media).sort() : [];

/** The film's fields as the form sends them back. */
function filmFields(movie: Movie): Part[] {
  return [
    ['title', movie.title],
    ['year', String(movie.year ?? '')],
    ['director', movie.director ?? ''],
    ['description', movie.synopsis ?? ''],
    ['rating', String(movie.rating ?? '')],
  ];
}

const GONE = 'gone-folder';

/** _The Lantern Keeper_, its recorded folder and its copied video gone. */
function addGoneFilm(storage: LibraryStorage): Movie {
  return storage.addMovie({
    title: 'The Lantern Keeper',
    year: 2019,
    videoPath: `${GONE}/lantern.mp4`,
    mediaFolder: GONE,
  });
}

/** _The Lantern Keeper_, its video and poster in its recorded folder. */
async function addHeldFilm(
  storage: LibraryStorage,
  mediaDomain: Media
): Promise<{ movie: Movie; folder: string }> {
  const recorded = mediaDomain.reserveFolder('The Lantern Keeper', 2019);
  const videoPath = await mediaDomain.storeUpload(
    recorded,
    'lantern.mp4',
    bytes('video')
  );
  const posterPath = await mediaDomain.storeUpload(
    recorded,
    'poster.jpg',
    bytes('poster')
  );
  const folder = posix.dirname(videoPath);
  const movie = storage.addMovie({
    title: 'The Lantern Keeper',
    year: 2019,
    videoPath,
    posterPath,
    mediaFolder: folder,
  });
  return { movie, folder };
}

/** A held episode's `episode` field, its files as the paths they have. */
function heldEpisode(episode: Episode): Part {
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

/** The series' fields and held episodes, with a new poster picked. */
function seriesBodyWithPoster(storage: LibraryStorage, id: string): Part[] {
  return [
    ['title', 'Harbor and Vine'],
    ['year', '2019'],
    ['creator', ''],
    ['description', ''],
    ['rating', ''],
    ['poster', posterPart('harbor.jpg')],
    ...storage.listEpisodes(id).map(heldEpisode),
  ];
}

describe('PATCH /api/movies/:id over a recorded folder that is gone', () => {
  it('records the folder it reserved for a new poster as the film’s Media folder', async () => {
    const { storage, baseUrl, media } = freshApi();
    const movie = addGoneFilm(storage);

    const response = await patch(`${baseUrl}/api/movies/${movie.id}`, [
      ...filmFields(movie),
      ['poster', posterPart()],
      ['videoPath', movie.videoPath],
    ]);

    expect(response.status).toBe(200);
    const saved = (await response.json()) as Movie;
    const folder = storage.mediaFolderOf('movie', movie.id);
    expect(folder).toBe('the-lantern-keeper-2019');
    expect(posix.dirname(saved.posterPath ?? '')).toBe(folder);
    expect(existsSync(join(media, folder ?? ''))).toBe(true);
  });

  it('leaves nothing in media/ after a Delete of the edited film', async () => {
    const { storage, baseUrl, media } = freshApi();
    const movie = addGoneFilm(storage);
    const edited = await patch(`${baseUrl}/api/movies/${movie.id}`, [
      ...filmFields(movie),
      ['poster', posterPart()],
      ['videoPath', movie.videoPath],
    ]);
    expect(edited.status).toBe(200);

    const response = await fetch(`${baseUrl}/api/movies/${movie.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);
    expect(topLevel(media)).toEqual([]);
  });

  it('leaves no new folder behind when the edit is refused', async () => {
    const { storage, baseUrl, media } = freshApi();
    const movie = addGoneFilm(storage);

    // A body with no video is refused by the Save gate after the poster has
    // already landed in the folder the edit reserved.
    const response = await patch(`${baseUrl}/api/movies/${movie.id}`, [
      ...filmFields(movie),
      ['poster', posterPart()],
    ]);

    expect(response.status).toBe(400);
    expect(topLevel(media)).toEqual([]);
    expect(storage.mediaFolderOf('movie', movie.id)).toBe(GONE);
  });
});

describe('PATCH /api/series/:id over a recorded folder that is gone', () => {
  it('records the folder it reserved as the series’ Media folder', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = storage.addSeries(
      { title: 'Harbor and Vine', year: 2019, mediaFolder: GONE },
      [{ season: 1, number: 1, videoPath: `${GONE}/season-01/S01E01.mp4` }]
    );

    const response = await patch(
      `${baseUrl}/api/series/${series.id}`,
      seriesBodyWithPoster(storage, series.id)
    );

    expect(response.status).toBe(200);
    const folder = storage.mediaFolderOf('series', series.id);
    expect(folder).toBe('harbor-and-vine-2019');
    expect(existsSync(join(media, folder ?? ''))).toBe(true);
    const poster = storage.getSeriesDetail(series.id)?.series.posterPath;
    expect(posix.dirname(poster ?? '')).toBe(folder);
  });
});

describe('an edit that reuses its recorded folder is unchanged', () => {
  it('keeps a film’s recorded folder and lands its new poster there', async () => {
    const { storage, baseUrl, media, mediaDomain } = freshApi();
    const { movie, folder } = await addHeldFilm(storage, mediaDomain);

    const response = await patch(`${baseUrl}/api/movies/${movie.id}`, [
      ...filmFields(movie),
      ['poster', posterPart('poster-new.jpg')],
      ['videoPath', movie.videoPath],
    ]);

    expect(response.status).toBe(200);
    const saved = (await response.json()) as Movie;
    expect(storage.mediaFolderOf('movie', movie.id)).toBe(folder);
    expect(posix.dirname(saved.posterPath ?? '')).toBe(folder);
    expect(topLevel(media)).toEqual([folder]);
  });

  it('a refused film edit removes only its own file from the folder it reused', async () => {
    const { storage, baseUrl, media, mediaDomain } = freshApi();
    const { movie, folder } = await addHeldFilm(storage, mediaDomain);
    const before = readdirSync(join(media, folder)).sort();

    const response = await patch(`${baseUrl}/api/movies/${movie.id}`, [
      ...filmFields(movie),
      ['poster', posterPart('poster-new.jpg')],
    ]);

    expect(response.status).toBe(400);
    expect(readdirSync(join(media, folder)).sort()).toEqual(before);
    expect(storage.mediaFolderOf('movie', movie.id)).toBe(folder);
  });

  it('keeps a series’ recorded folder', async () => {
    const { storage, baseUrl, mediaDomain } = freshApi();
    const recorded = mediaDomain.reserveFolder('Harbor and Vine', 2019);
    const videoPath = await mediaDomain.storeUpload(
      mediaDomain.seasonFolder(recorded, 1),
      'S01E01.mp4',
      bytes('video')
    );
    const folder = posix.dirname(posix.dirname(videoPath));
    const series = storage.addSeries(
      { title: 'Harbor and Vine', year: 2019, mediaFolder: folder },
      [{ season: 1, number: 1, videoPath }]
    );

    const response = await patch(
      `${baseUrl}/api/series/${series.id}`,
      seriesBodyWithPoster(storage, series.id)
    );

    expect(response.status).toBe(200);
    expect(storage.mediaFolderOf('series', series.id)).toBe(folder);
    const poster = storage.getSeriesDetail(series.id)?.series.posterPath;
    expect(posix.dirname(poster ?? '')).toBe(folder);
  });
});
