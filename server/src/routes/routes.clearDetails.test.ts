// @vitest-environment node
//
// 47 — Manage library, Phase 3: "Clear details" (issue #409).
//
// `POST /api/movies/:id/clear-details` and `POST /api/series/:id/clear-details`
// → `200 LibraryTitle`, the echo the **Title row** redraws from — its
// **Details state** `none` — and `404` for an id that kind does not hold. The
// route calls `clearMovieDetails` / `clearSeriesDetails`, one transaction each,
// then removes the **Stored paths** they let go from managed storage: **row
// first, then bytes, best-effort**, the delete's rule. Everything else under
// the title's Media folder — the video, the subtitles — stays.
//
// Over a real listener, a real `:memory:` library and a sandboxed media root,
// `routes.libraryTitles`' harness.

import express from 'express';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-clear-details-');
  const media = join(root, 'media');
  mkdirSync(media);

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
  return { baseUrl: `http://127.0.0.1:${port}`, storage, media };
}

type Api = ReturnType<typeof freshApi>;

/** A file at a path under the media root, its directories made. */
function place(api: Api, relative: string): void {
  const file = join(api.media, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, 'bytes');
}

const held = (api: Api, relative: string) =>
  existsSync(join(api.media, relative));

/** A copied film a Sync has filled, every file on disk. */
function syncedFilm(api: Api) {
  for (const file of [
    'coco-2017/coco.mkv',
    'coco-2017/coco.en.srt',
    'coco-2017/poster.jpg',
    'coco-2017/backdrop.jpg',
  ]) {
    place(api, file);
  }
  const film = api.storage.addMovie({
    title: 'Coco',
    videoPath: 'coco-2017/coco.mkv',
    mediaFolder: 'coco-2017',
    subtitles: [{ path: 'coco-2017/coco.en.srt', language: 'English' }],
  });
  api.storage.enrichMovie(film.id, {
    tmdbId: 354912,
    year: 2017,
    synopsis: 'A boy in the Land of the Dead.',
    posterPath: 'coco-2017/poster.jpg',
    backdropPath: 'coco-2017/backdrop.jpg',
  });
  return film;
}

/** A copied show a Sync has filled: its art, a Season poster and a Still. */
function syncedShow(api: Api) {
  for (const file of [
    'bluey/season-01/e01.mkv',
    'bluey/poster.jpg',
    'bluey/backdrop.jpg',
    'bluey/S01-poster.jpg',
    'bluey/season-01/e01.jpg',
  ]) {
    place(api, file);
  }
  const show = api.storage.addSeries({ title: 'Bluey', mediaFolder: 'bluey' }, [
    { season: 1, number: 1, videoPath: 'bluey/season-01/e01.mkv' },
  ]);
  api.storage.enrichSeries(show.id, {
    tmdbId: 82728,
    year: 2018,
    endYear: 2024,
    posterPath: 'bluey/poster.jpg',
    backdropPath: 'bluey/backdrop.jpg',
  });
  api.storage.setSeasonPoster(show.id, 1, 'bluey/S01-poster.jpg');
  const [episode] = api.storage.listEpisodes(show.id);
  api.storage.enrichEpisode(episode!.id, {
    title: 'Magic Xylophone',
    stillPath: 'bluey/season-01/e01.jpg',
    stillSource: 'tmdb',
  });
  return show;
}

const clear = (api: Api, kind: 'movies' | 'series', id: string) =>
  fetch(`${api.baseUrl}/api/${kind}/${encodeURIComponent(id)}/clear-details`, {
    method: 'POST',
  });

interface WireTitle {
  kind: string;
  id: string;
  title: string;
  year: number | null;
  endYear?: number | null;
  details: string;
}

describe('POST /api/movies/:id/clear-details', () => {
  it('answers 200 with the redrawn Library title, its details none', async () => {
    const api = freshApi();
    const film = syncedFilm(api);

    const response = await clear(api, 'movies', film.id);

    expect(response.status).toBe(200);
    const body = (await response.json()) as WireTitle;
    expect(body).toMatchObject({
      kind: 'movie',
      id: film.id,
      title: 'Coco',
      year: null,
      details: 'none',
    });
  });

  it('echoes the row the list read would draw now', async () => {
    const api = freshApi();
    const film = syncedFilm(api);

    const echo = (await (
      await clear(api, 'movies', film.id)
    ).json()) as WireTitle;
    const list = (await (
      await fetch(`${api.baseUrl}/api/library-titles`)
    ).json()) as { movies: WireTitle[] };

    expect(echo).toEqual(list.movies[0]);
  });

  it('clears the film’s row', async () => {
    const api = freshApi();
    const film = syncedFilm(api);

    await clear(api, 'movies', film.id);

    const cleared = api.storage.getMovie(film.id)!;
    expect(cleared.tmdbId).toBeNull();
    expect(cleared.synopsis).toBeNull();
    expect(cleared.posterPath).toBeNull();
  });

  it('removes the let-go poster and backdrop from managed storage', async () => {
    const api = freshApi();
    const film = syncedFilm(api);

    await clear(api, 'movies', film.id);

    expect(held(api, 'coco-2017/poster.jpg')).toBe(false);
    expect(held(api, 'coco-2017/backdrop.jpg')).toBe(false);
  });

  it('keeps the video and the subtitles on disk', async () => {
    const api = freshApi();
    const film = syncedFilm(api);

    await clear(api, 'movies', film.id);

    expect(held(api, 'coco-2017/coco.mkv')).toBe(true);
    expect(held(api, 'coco-2017/coco.en.srt')).toBe(true);
  });

  it('still answers 200 when a let-go file is already gone — best-effort', async () => {
    const api = freshApi();
    const film = syncedFilm(api);
    api.storage.enrichMovie(film.id, { posterPath: 'coco-2017/missing.jpg' });

    const response = await clear(api, 'movies', film.id);

    expect(response.status).toBe(200);
    expect(api.storage.getMovie(film.id)?.posterPath).toBeNull();
  });

  it('answers 404 for an id the library does not hold', async () => {
    const api = freshApi();

    expect((await clear(api, 'movies', 'nope')).status).toBe(404);
  });

  it('answers 404 for a series’ id', async () => {
    const api = freshApi();
    const show = syncedShow(api);

    expect((await clear(api, 'movies', show.id)).status).toBe(404);
    expect(api.storage.getSeries(show.id)?.tmdbId).toBe(82728);
  });
});

describe('POST /api/series/:id/clear-details', () => {
  it('answers 200 with the redrawn Library title, its details none', async () => {
    const api = freshApi();
    const show = syncedShow(api);

    const response = await clear(api, 'series', show.id);

    expect(response.status).toBe(200);
    const body = (await response.json()) as WireTitle;
    expect(body).toMatchObject({
      kind: 'series',
      id: show.id,
      title: 'Bluey',
      year: null,
      endYear: null,
      details: 'none',
    });
  });

  it('echoes the row the list read would draw now', async () => {
    const api = freshApi();
    const show = syncedShow(api);

    const echo = (await (
      await clear(api, 'series', show.id)
    ).json()) as WireTitle;
    const list = (await (
      await fetch(`${api.baseUrl}/api/library-titles`)
    ).json()) as { series: WireTitle[] };

    expect(echo).toEqual(list.series[0]);
  });

  it('removes the show’s art, its Season poster and its Still from managed storage', async () => {
    const api = freshApi();
    const show = syncedShow(api);

    await clear(api, 'series', show.id);

    for (const file of [
      'bluey/poster.jpg',
      'bluey/backdrop.jpg',
      'bluey/S01-poster.jpg',
      'bluey/season-01/e01.jpg',
    ]) {
      expect(held(api, file)).toBe(false);
    }
  });

  it('keeps the episode’s video on disk', async () => {
    const api = freshApi();
    const show = syncedShow(api);

    await clear(api, 'series', show.id);

    expect(held(api, 'bluey/season-01/e01.mkv')).toBe(true);
  });

  it('answers 404 for an id the library does not hold', async () => {
    const api = freshApi();

    expect((await clear(api, 'series', 'nope')).status).toBe(404);
  });

  it('answers 404 for a film’s id', async () => {
    const api = freshApi();
    const film = syncedFilm(api);

    expect((await clear(api, 'series', film.id)).status).toBe(404);
    expect(api.storage.getMovie(film.id)?.tmdbId).toBe(354912);
  });
});
