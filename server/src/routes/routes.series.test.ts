// @vitest-environment node
//
// 22 — Series (TV), Phase 1: "a Season-folder show imports as one series"
// (issue #189).
//
// The series' slice of the router's tests, beside the import's, the export's
// and the settings' — a real listener, a real `fetch`, real status codes and
// bodies, over a real `:memory:` library. This phase has one route:
//
// - `GET /api/series` → `200 SeriesHomePayload` — every series the library
//   holds, and `episodeCount`, the episode total across all of them, which is
//   what the Series tab's `N series · M episodes` line reads. No filters yet;
//   the query parser arrives with the tab's search.
//
// The library is filled through `LibraryStorage`'s series writes — `addSeries`
// and `addEpisode` — the same two the importer writes a show through.

import express from 'express';
import { mkdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type {
  GenreListPayload,
  HomePayload,
  SeriesDetail,
  SeriesHomePayload,
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

/** A fresh library behind a listening API, composed the way `main.ts` does. */
function freshApi(): { storage: LibraryStorage; baseUrl: string } {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const media = join(sandboxRoot('familyflix-series-api-'), 'media');
  mkdirSync(media);
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null));

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback })
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}` };
}

/** A series with `episodes` episodes in season 1. */
function seedSeries(
  storage: LibraryStorage,
  title: string,
  episodes: number,
  genres: string[] = ['Drama']
): void {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const series = storage.addSeries({
    title,
    year: 2021,
    creator: 'Mara Quinn',
    genres,
  });
  for (let number = 1; number <= episodes; number += 1) {
    storage.addEpisode(series.id, {
      season: 1,
      number,
      videoPath: `${slug}-2021/season-01/e${number}.mp4`,
    });
  }
}

async function getSeries(baseUrl: string): Promise<{
  status: number;
  body: SeriesHomePayload;
}> {
  const response = await fetch(`${baseUrl}/api/series`);
  return {
    status: response.status,
    body: (await response.json()) as SeriesHomePayload,
  };
}

describe('GET /api/series', () => {
  it('answers 200 with every series the library holds', async () => {
    const { storage, baseUrl } = freshApi();
    seedSeries(storage, 'Harbor & Vine', 3);
    seedSeries(storage, 'Lighthouse Keepers', 2, ['Family']);

    const { status, body } = await getSeries(baseUrl);

    expect(status).toBe(200);
    expect(body.series.map((series) => series.title).sort()).toEqual([
      'Harbor & Vine',
      'Lighthouse Keepers',
    ]);
  });

  it('answers each series as the record, its genres and creator on it', async () => {
    const { storage, baseUrl } = freshApi();
    seedSeries(storage, 'Harbor & Vine', 1, ['Drama', 'Comedy']);

    const { body } = await getSeries(baseUrl);

    expect(body.series[0]).toMatchObject({
      title: 'Harbor & Vine',
      year: 2021,
      creator: 'Mara Quinn',
    });
    expect(typeof body.series[0].id).toBe('string');
    expect(body.series[0].genres.map((genre) => genre.name)).toEqual([
      'Drama',
      'Comedy',
    ]);
  });

  it('answers an empty library as no series and no episodes', async () => {
    const { baseUrl } = freshApi();

    const { status, body } = await getSeries(baseUrl);

    expect(status).toBe(200);
    expect(body.series).toEqual([]);
    expect(body.episodeCount).toBe(0);
  });
});

// 22 — Series (TV), Phase 2 (issue #191): the series page reads one series in
// full. `GET /api/series/:id` answers a `SeriesDetail` — the series, its
// seasons in order each with its episodes in order and its own **Next
// episode**, and the series' Next episode — all derived on the server through
// `nextEpisodeOf`, never stored. An id the library does not hold is `404`.
describe('GET /api/series/:id', () => {
  /** Harbor & Vine: two episodes in season 1, three in season 2. */
  function seedHarbor(storage: LibraryStorage): string {
    const series = storage.addSeries({
      title: 'Harbor & Vine',
      year: 2019,
      endYear: 2023,
      creator: 'Mara Quinn',
      cast: ['Ana Vega', 'Tomas Bell'],
      synopsis: 'Two families, one vineyard.',
      rating: 8,
      genres: ['Drama', 'Comedy'],
    });
    for (const [season, number] of [
      [2, 1],
      [1, 2],
      [2, 3],
      [1, 1],
      [2, 2],
    ]) {
      storage.addEpisode(series.id, {
        season,
        number,
        videoPath: `harbor-vine-2019/season-0${season}/e${number}.mp4`,
      });
    }
    return series.id;
  }

  async function getDetail(
    baseUrl: string,
    id: string
  ): Promise<{ status: number; body: SeriesDetail }> {
    const response = await fetch(`${baseUrl}/api/series/${id}`);
    return {
      status: response.status,
      body: (await response.json()) as SeriesDetail,
    };
  }

  it('answers 200 with the series record, its genres, creator and cast on it', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedHarbor(storage);

    const { status, body } = await getDetail(baseUrl, id);

    expect(status).toBe(200);
    expect(body.series).toMatchObject({
      id,
      title: 'Harbor & Vine',
      year: 2019,
      endYear: 2023,
      creator: 'Mara Quinn',
      cast: ['Ana Vega', 'Tomas Bell'],
      synopsis: 'Two families, one vineyard.',
      rating: 8,
    });
    expect(body.series.genres.map((genre) => genre.name)).toEqual([
      'Drama',
      'Comedy',
    ]);
  });

  it('answers a series with no episodes as no seasons and no next episode', async () => {
    const { storage, baseUrl } = freshApi();
    const series = storage.addSeries({ title: 'Lighthouse Keepers' });

    const { status, body } = await getDetail(baseUrl, series.id);

    expect(status).toBe(200);
    expect(body.seasons).toEqual([]);
    expect(body.next).toBeNull();
  });

  it('answers 404 for a series the library does not hold', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(`${baseUrl}/api/series/no-such-series`);

    expect(response.status).toBe(404);
    // A JSON error, not Express's default HTML page — the movie's 404.
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  });

  it('answers 404 for a movie’s id — a movie is not a series', async () => {
    const { storage, baseUrl } = freshApi();
    const movie = storage.addMovie({
      title: 'Die Hard',
      videoPath: 'die-hard/dh.mp4',
    });

    const response = await fetch(`${baseUrl}/api/series/${movie.id}`);

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
  });
});

// 22 — Series (TV), Phase 2 (issue #192): the series heart.
// `POST /api/series/:id/favorite { value }` is a **Single-signal write** on the
// movie's precedent: exactly a boolean or `400`, a series the library does not
// hold `404` with a JSON error, and on success `200 { value }` — the echo of
// what was stored, which the next read of the series agrees with.
describe('POST /api/series/:id/favorite', () => {
  async function postFavorite(
    baseUrl: string,
    id: string,
    body: unknown
  ): Promise<{ status: number; body: { value?: unknown; error?: unknown } }> {
    const response = await fetch(`${baseUrl}/api/series/${id}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // Read as text first: a route that does not exist answers Express's HTML.
    const text = await response.text();
    let parsed: { value?: unknown; error?: unknown } = {};
    try {
      parsed = JSON.parse(text) as { value?: unknown; error?: unknown };
    } catch {
      parsed = {};
    }
    return { status: response.status, body: parsed };
  }

  async function isFavorite(baseUrl: string, id: string): Promise<boolean> {
    const response = await fetch(`${baseUrl}/api/series/${id}`);
    return ((await response.json()) as SeriesDetail).series.isFavorite;
  }

  it('answers 200 with the value it stored', async () => {
    const { storage, baseUrl } = freshApi();
    const series = storage.addSeries({ title: 'Harbor & Vine' });

    const { status, body } = await postFavorite(baseUrl, series.id, {
      value: true,
    });

    expect(status).toBe(200);
    expect(body).toEqual({ value: true });
  });

  it('keeps the favorite, so the series page and the tab read it back', async () => {
    const { storage, baseUrl } = freshApi();
    const series = storage.addSeries({ title: 'Harbor & Vine' });

    await postFavorite(baseUrl, series.id, { value: true });

    expect(await isFavorite(baseUrl, series.id)).toBe(true);
    const { body } = await getSeries(baseUrl);
    expect(body.series[0].isFavorite).toBe(true);
  });

  it('takes a series back out of Favorites', async () => {
    const { storage, baseUrl } = freshApi();
    const series = storage.addSeries({ title: 'Harbor & Vine' });
    await postFavorite(baseUrl, series.id, { value: true });

    const { status, body } = await postFavorite(baseUrl, series.id, {
      value: false,
    });

    expect(status).toBe(200);
    expect(body).toEqual({ value: false });
    expect(await isFavorite(baseUrl, series.id)).toBe(false);
  });

  it('touches only the series asked for', async () => {
    const { storage, baseUrl } = freshApi();
    const harbor = storage.addSeries({ title: 'Harbor & Vine' });
    const keepers = storage.addSeries({ title: 'Lighthouse Keepers' });

    await postFavorite(baseUrl, harbor.id, { value: true });

    expect(await isFavorite(baseUrl, harbor.id)).toBe(true);
    expect(await isFavorite(baseUrl, keepers.id)).toBe(false);
  });

  it.each([
    ['a string', { value: 'true' }],
    ['a number', { value: 1 }],
    ['null', { value: null }],
    ['a missing value', {}],
  ])('answers 400 for %s, and stores nothing', async (_label, body) => {
    const { storage, baseUrl } = freshApi();
    const series = storage.addSeries({ title: 'Harbor & Vine' });

    const response = await postFavorite(baseUrl, series.id, body);

    expect(response.status).toBe(400);
    expect(typeof response.body.error).toBe('string');
    expect(await isFavorite(baseUrl, series.id)).toBe(false);
  });

  it('answers 404 with a JSON error for a series the library does not hold', async () => {
    const { baseUrl } = freshApi();

    const { status, body } = await postFavorite(baseUrl, 'no-such-series', {
      value: true,
    });

    expect(status).toBe(404);
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  });

  it('answers 404 for a movie’s id — a movie is not a series', async () => {
    const { storage, baseUrl } = freshApi();
    const movie = storage.addMovie({
      title: 'Die Hard',
      videoPath: 'die-hard/dh.mp4',
    });

    const { status, body } = await postFavorite(baseUrl, movie.id, {
      value: true,
    });

    expect(status).toBe(404);
    expect(typeof body.error).toBe('string');
    expect(storage.getMovie(movie.id)?.isFavorite).toBe(false);
  });
});

// 22 — Series (TV), Phase 3 (issue #193): the season page's two writes, both
// on the movie's watched rule — watched forgets the resume position, unwatched
// clears `watched` alone and keeps it.
//
// - `POST /api/series/:id/seasons/:n/watched { value }` marks every episode of
//   one season, and touches no other season.
// - `POST /api/episodes/:id/watched { value }` marks one episode — the route
//   the season page's box and the player's _Play now_ both write through.
//
// A resume position is seeded through `setEpisodeResumePosition`, the
// episode's `setResumePosition`, stamped the same way.

/** POST a JSON body, reading the answer as text so Express's HTML 404 parses. */
async function postJson(
  url: string,
  body: unknown
): Promise<{ status: number; body: { value?: unknown; error?: unknown } }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: { value?: unknown; error?: unknown } = {};
  try {
    parsed = JSON.parse(text) as { value?: unknown; error?: unknown };
  } catch {
    parsed = {};
  }
  return { status: response.status, body: parsed };
}

/** Harbor & Vine: three episodes in season 1, two in season 2. */
function seedTwoSeasons(storage: LibraryStorage): string {
  const series = storage.addSeries({ title: 'Harbor & Vine', year: 2019 });
  for (const [season, number] of [
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 1],
    [2, 2],
  ]) {
    storage.addEpisode(series.id, {
      season,
      number,
      videoPath: `harbor-vine-2019/season-0${season}/e${number}.mp4`,
    });
  }
  return series.id;
}

/** One episode as the series read answers it. */
async function readEpisode(
  baseUrl: string,
  seriesId: string,
  season: number,
  number: number
) {
  const response = await fetch(`${baseUrl}/api/series/${seriesId}`);
  const detail = (await response.json()) as SeriesDetail;
  const episode = detail.seasons
    .find((candidate) => candidate.number === season)
    ?.episodes.find((candidate) => candidate.number === number);
  if (!episode) throw new Error(`no S${season}E${number}`);
  return episode;
}

/** The held episode's id, by its numbers. */
function episodeId(
  storage: LibraryStorage,
  seriesId: string,
  season: number,
  number: number
): string {
  const episode = storage
    .listEpisodes(seriesId)
    .find(
      (candidate) => candidate.season === season && candidate.number === number
    );
  if (!episode) throw new Error(`no S${season}E${number}`);
  return episode.id;
}

describe('POST /api/series/:id/seasons/:n/watched', () => {
  const seasonUrl = (baseUrl: string, id: string, season: number) =>
    `${baseUrl}/api/series/${id}/seasons/${season}/watched`;

  it('answers 200 with the value it stored', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);

    const { status, body } = await postJson(seasonUrl(baseUrl, id, 1), {
      value: true,
    });

    expect(status).toBe(200);
    expect(body).toEqual({ value: true });
  });

  it('marks every episode of the season watched', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);

    await postJson(seasonUrl(baseUrl, id, 1), { value: true });

    for (const number of [1, 2, 3]) {
      const episode = await readEpisode(baseUrl, id, 1, number);
      expect(episode.watched).toBe(true);
      expect(episode.status).toBe('watched');
    }
  });

  it('touches no other season', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);

    await postJson(seasonUrl(baseUrl, id, 1), { value: true });

    expect((await readEpisode(baseUrl, id, 1, 1)).watched).toBe(true);
    for (const number of [1, 2]) {
      expect((await readEpisode(baseUrl, id, 2, number)).watched).toBe(false);
    }
  });

  it('forgets every resume position in the season when it marks it watched', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);
    storage.setEpisodeResumePosition(episodeId(storage, id, 1, 2), 600);

    await postJson(seasonUrl(baseUrl, id, 1), { value: true });

    const episode = await readEpisode(baseUrl, id, 1, 2);
    expect(episode.resumePositionSeconds).toBe(0);
    expect(episode.status).toBe('watched');
  });

  it('clears watched on every episode when it marks the season unwatched', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);
    await postJson(seasonUrl(baseUrl, id, 1), { value: true });

    const { status, body } = await postJson(seasonUrl(baseUrl, id, 1), {
      value: false,
    });

    expect(status).toBe(200);
    expect(body).toEqual({ value: false });
    for (const number of [1, 2, 3]) {
      expect((await readEpisode(baseUrl, id, 1, number)).watched).toBe(false);
    }
  });

  it('keeps a resume position when it marks the season unwatched', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);
    storage.setEpisodeResumePosition(episodeId(storage, id, 1, 2), 600);

    await postJson(seasonUrl(baseUrl, id, 1), { value: false });

    const episode = await readEpisode(baseUrl, id, 1, 2);
    expect(episode.resumePositionSeconds).toBe(600);
    expect(episode.status).toBe('in-progress');
  });

  it.each([
    ['a string', { value: 'true' }],
    ['a number', { value: 1 }],
    ['null', { value: null }],
    ['a missing value', {}],
  ])('answers 400 for %s, and marks nothing', async (_label, body) => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);

    const response = await postJson(seasonUrl(baseUrl, id, 1), body);

    expect(response.status).toBe(400);
    expect(typeof response.body.error).toBe('string');
    expect((await readEpisode(baseUrl, id, 1, 1)).watched).toBe(false);
  });

  it('answers 404 with a JSON error for a series the library does not hold', async () => {
    const { baseUrl } = freshApi();

    const { status, body } = await postJson(
      seasonUrl(baseUrl, 'no-such-series', 1),
      { value: true }
    );

    expect(status).toBe(404);
    expect(typeof body.error).toBe('string');
  });

  it('answers 404 for a season the series does not have', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);

    const { status, body } = await postJson(seasonUrl(baseUrl, id, 9), {
      value: true,
    });

    expect(status).toBe(404);
    expect(typeof body.error).toBe('string');
  });

  it('answers 404 for a movie’s id — a movie is not a series', async () => {
    const { storage, baseUrl } = freshApi();
    const movie = storage.addMovie({
      title: 'Die Hard',
      videoPath: 'die-hard/dh.mp4',
    });

    const { status, body } = await postJson(seasonUrl(baseUrl, movie.id, 1), {
      value: true,
    });

    expect(status).toBe(404);
    expect(typeof body.error).toBe('string');
    expect(storage.getMovie(movie.id)?.watched).toBe(false);
  });
});

describe('POST /api/episodes/:id/watched', () => {
  const watchedUrl = (baseUrl: string, id: string) =>
    `${baseUrl}/api/episodes/${id}/watched`;

  it('answers 200 with the value it stored, and marks the episode watched', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);

    const { status, body } = await postJson(
      watchedUrl(baseUrl, episodeId(storage, id, 1, 2)),
      { value: true }
    );

    expect(status).toBe(200);
    expect(body).toEqual({ value: true });
    expect((await readEpisode(baseUrl, id, 1, 2)).status).toBe('watched');
  });

  it('marks only the episode asked for', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);

    await postJson(watchedUrl(baseUrl, episodeId(storage, id, 1, 2)), {
      value: true,
    });

    expect((await readEpisode(baseUrl, id, 1, 2)).watched).toBe(true);
    expect((await readEpisode(baseUrl, id, 1, 1)).watched).toBe(false);
    expect((await readEpisode(baseUrl, id, 1, 3)).watched).toBe(false);
  });

  it('forgets the resume position when it marks the episode watched', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);
    const episode = episodeId(storage, id, 1, 2);
    storage.setEpisodeResumePosition(episode, 600);

    await postJson(watchedUrl(baseUrl, episode), { value: true });

    expect((await readEpisode(baseUrl, id, 1, 2)).resumePositionSeconds).toBe(
      0
    );
  });

  it('clears watched and keeps the resume position when it marks it unwatched', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);
    const episode = episodeId(storage, id, 1, 2);
    await postJson(watchedUrl(baseUrl, episode), { value: true });
    storage.setEpisodeResumePosition(episode, 600);

    const { status, body } = await postJson(watchedUrl(baseUrl, episode), {
      value: false,
    });

    expect(status).toBe(200);
    expect(body).toEqual({ value: false });
    const read = await readEpisode(baseUrl, id, 1, 2);
    expect(read.watched).toBe(false);
    expect(read.resumePositionSeconds).toBe(600);
    expect(read.status).toBe('in-progress');
  });

  it.each([
    ['a string', { value: 'true' }],
    ['a number', { value: 1 }],
    ['null', { value: null }],
    ['a missing value', {}],
  ])('answers 400 for %s, and marks nothing', async (_label, body) => {
    const { storage, baseUrl } = freshApi();
    const id = seedTwoSeasons(storage);

    const response = await postJson(
      watchedUrl(baseUrl, episodeId(storage, id, 1, 2)),
      body
    );

    expect(response.status).toBe(400);
    expect(typeof response.body.error).toBe('string');
    expect((await readEpisode(baseUrl, id, 1, 2)).watched).toBe(false);
  });

  it('answers 404 with a JSON error for an episode the library does not hold', async () => {
    const { baseUrl } = freshApi();

    const { status, body } = await postJson(
      watchedUrl(baseUrl, 'no-such-episode'),
      { value: true }
    );

    expect(status).toBe(404);
    expect(typeof body.error).toBe('string');
  });

  it('answers 404 for a movie’s id — a movie is not an episode', async () => {
    const { storage, baseUrl } = freshApi();
    const movie = storage.addMovie({
      title: 'Die Hard',
      videoPath: 'die-hard/dh.mp4',
    });

    const { status, body } = await postJson(watchedUrl(baseUrl, movie.id), {
      value: true,
    });

    expect(status).toBe(404);
    expect(typeof body.error).toBe('string');
    expect(storage.getMovie(movie.id)?.watched).toBe(false);
  });
});

// 22 — Series (TV), Phase 5 (issue #195): Continue Watching on the Series tab.
// `GET /api/series` answers `continueWatching` — one entry per series, for its
// earliest part-watched episode (season, then episode order), each carrying the
// episode and its series' id and title; ordered by `last_watched_at`, most
// recent first, and capped at 15. A part-watched episode is the movie's
// in-progress: a resume position and not watched. The Movies tab's
// `GET /api/home` Continue row stays films only. The row's rules are
// `library/series/browse`'s suite; this one keeps the entry's shape on the wire.
describe('GET /api/series — continue watching', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Stamp a resume position at a fixed instant, so the order is told apart. */
  function resumeAt(
    storage: LibraryStorage,
    episodeId: string,
    seconds: number,
    at: string
  ): void {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(at));
    storage.setEpisodeResumePosition(episodeId, seconds);
    vi.useRealTimers();
  }

  /** The series by title, and its episodes in season, then episode order. */
  function episodesOf(storage: LibraryStorage, title: string) {
    const series = storage
      .getSeriesHome()
      .series.find((candidate) => candidate.title === title);
    if (series === undefined) {
      throw new Error(`No series ${title}`);
    }
    return { series, episodes: storage.listEpisodes(series.id) };
  }

  it('answers an entry for a series with a part-watched episode, carrying the episode and its series', async () => {
    const { storage, baseUrl } = freshApi();
    seedSeries(storage, 'Harbor & Vine', 3);
    const { series, episodes } = episodesOf(storage, 'Harbor & Vine');
    resumeAt(storage, episodes[1].id, 600, '2026-06-01T00:00:00.000Z');

    const { body } = await getSeries(baseUrl);

    expect(body.continueWatching).toHaveLength(1);
    const [entry] = body.continueWatching;
    expect(entry.series).toEqual({ id: series.id, title: 'Harbor & Vine' });
    expect(entry.episode.id).toBe(episodes[1].id);
    expect(entry.episode.season).toBe(1);
    expect(entry.episode.number).toBe(2);
    expect(entry.episode.resumePositionSeconds).toBe(600);
  });

  it('keeps the Movies tab’s Continue row films only', async () => {
    const { storage, baseUrl } = freshApi();
    storage.addMovie({
      title: 'Halfway',
      videoPath: 'Halfway/halfway.mp4',
      resumePositionSeconds: 600,
      lastWatchedAt: '2026-06-01T00:00:00.000Z',
    });
    seedSeries(storage, 'Harbor & Vine', 2);
    resumeAt(
      storage,
      episodesOf(storage, 'Harbor & Vine').episodes[0].id,
      60,
      '2026-06-09T00:00:00.000Z'
    );

    const response = await fetch(`${baseUrl}/api/home`);
    const body = (await response.json()) as HomePayload;

    expect(body.continueWatching.map((movie) => movie.title)).toEqual([
      'Halfway',
    ]);
  });
});

// 22 — Series (TV), Phase 9 (issue #199): the Series tab's filters.
//
// `GET /api/series` reads the movie home's own query — `q`, `genre`, `rating`,
// `sort` — through the same parser, and applies it to the grid, the count line
// and the Continue row alike. `GET /api/series/genres` is the Series tab's
// Genre dropdown: genres counted in series, with the series total. The
// filters' and sorts' SQL is `library/series/browse`'s suite; this one keeps
// that each parameter is parsed and reaches it, and the 400s.

/** A series added at a fixed instant, so `recently-added` is told apart. */
function addSeriesAt(
  storage: LibraryStorage,
  at: string,
  input: Parameters<LibraryStorage['addSeries']>[0],
  episodes = 1
) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(at));
  const series = storage.addSeries(input);
  vi.useRealTimers();
  const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  for (let number = 1; number <= episodes; number += 1) {
    storage.addEpisode(series.id, {
      season: 1,
      number,
      videoPath: `${slug}/season-01/e${number}.mp4`,
    });
  }
  return series;
}

/** Three series told apart by every key a sort or filter reads. */
function seedShelf(storage: LibraryStorage) {
  const alder = addSeriesAt(
    storage,
    '2026-01-02T00:00:00.000Z',
    { title: 'Alder Street', year: 2015, rating: 6, genres: ['Comedy'] },
    2
  );
  const harbor = addSeriesAt(
    storage,
    '2026-01-03T00:00:00.000Z',
    { title: 'Harbor & Vine', year: 2019, rating: 9, genres: ['Drama'] },
    3
  );
  const lighthouse = addSeriesAt(
    storage,
    '2026-01-01T00:00:00.000Z',
    {
      title: 'Lighthouse Keepers',
      year: 2022,
      rating: 7,
      genres: ['Drama', 'Family'],
    },
    4
  );
  return { alder, harbor, lighthouse };
}

async function getSeriesAt(
  baseUrl: string,
  search: string
): Promise<{ status: number; body: SeriesHomePayload }> {
  const response = await fetch(`${baseUrl}/api/series${search}`);
  return {
    status: response.status,
    body: (await response.json()) as SeriesHomePayload,
  };
}

const titles = (body: SeriesHomePayload) =>
  body.series.map((series) => series.title);

describe('GET /api/series — the query', () => {
  it('narrows the series to a title search', async () => {
    const { storage, baseUrl } = freshApi();
    seedShelf(storage);

    const { status, body } = await getSeriesAt(baseUrl, '?q=harbor');

    expect(status).toBe(200);
    expect(titles(body)).toEqual(['Harbor & Vine']);
  });

  it('answers a search that finds nothing as no series and no episodes', async () => {
    const { storage, baseUrl } = freshApi();
    seedShelf(storage);

    const { status, body } = await getSeriesAt(baseUrl, '?q=zzz');

    expect(status).toBe(200);
    expect(body).toEqual({
      series: [],
      episodeCount: 0,
      continueWatching: [],
    });
  });

  it('narrows the series to one genre', async () => {
    const { storage, baseUrl } = freshApi();
    seedShelf(storage);

    const { body } = await getSeriesAt(baseUrl, '?genre=Drama&sort=a-z');

    expect(titles(body)).toEqual(['Harbor & Vine', 'Lighthouse Keepers']);
  });

  it('keeps only the series rated at or above the minimum', async () => {
    const { storage, baseUrl } = freshApi();
    seedShelf(storage);
    addSeriesAt(storage, '2026-01-04T00:00:00.000Z', {
      title: 'Unrated Show',
    });

    const { body } = await getSeriesAt(baseUrl, '?rating=7&sort=a-z');

    expect(titles(body)).toEqual(['Harbor & Vine', 'Lighthouse Keepers']);
  });

  it('orders by recently added when no sort is asked for', async () => {
    const { storage, baseUrl } = freshApi();
    seedShelf(storage);

    const { body } = await getSeriesAt(baseUrl, '');

    expect(titles(body)).toEqual([
      'Harbor & Vine',
      'Alder Street',
      'Lighthouse Keepers',
    ]);
  });

  it('orders by title for a-z', async () => {
    const { storage, baseUrl } = freshApi();
    seedShelf(storage);

    const { body } = await getSeriesAt(baseUrl, '?sort=a-z');

    expect(titles(body)).toEqual([
      'Alder Street',
      'Harbor & Vine',
      'Lighthouse Keepers',
    ]);
  });

  it('answers 400 for a sort it does not know', async () => {
    const { baseUrl } = freshApi();

    const { status } = await getSeriesAt(baseUrl, '?sort=sideways');

    expect(status).toBe(400);
  });

  it('answers 400 for a minimum rating off the scale', async () => {
    const { baseUrl } = freshApi();

    const { status } = await getSeriesAt(baseUrl, '?rating=11');

    expect(status).toBe(400);
  });
});

describe('GET /api/series/genres', () => {
  it('answers each genre series carry, counted in series, with the series total', async () => {
    const { storage, baseUrl } = freshApi();
    seedShelf(storage);
    addSeriesAt(storage, '2026-01-04T00:00:00.000Z', {
      title: 'Untagged Show',
    });

    const response = await fetch(`${baseUrl}/api/series/genres`);
    const body = (await response.json()) as GenreListPayload;

    expect(response.status).toBe(200);
    // Four series; Lighthouse Keepers is tagged twice, Untagged Show not at all.
    expect(body.total).toBe(4);
    expect(
      Object.fromEntries(body.genres.map((genre) => [genre.name, genre.count]))
    ).toEqual({ Comedy: 1, Drama: 2, Family: 1 });
  });

  it('answers an empty library as no series and no genres', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(`${baseUrl}/api/series/genres`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ total: 0, genres: [] });
  });
});

describe('the Movies tab beside the Series tab’s filters', () => {
  it('keeps GET /api/genres counting movies only', async () => {
    const { storage, baseUrl } = freshApi();
    storage.addMovie({
      title: 'Halfway',
      videoPath: 'Halfway/halfway.mp4',
      genres: ['Action'],
    });
    addSeriesAt(storage, '2026-01-01T00:00:00.000Z', {
      title: 'Harbor & Vine',
      genres: ['Drama'],
    });

    const response = await fetch(`${baseUrl}/api/genres`);
    const body = (await response.json()) as GenreListPayload;

    expect(body.total).toBe(1);
    expect(body.genres.map((genre) => genre.name)).toEqual(['Action']);
  });

  it('keeps GET /api/home narrowed to films only under the same query', async () => {
    const { storage, baseUrl } = freshApi();
    storage.addMovie({
      title: 'Harbor Lights',
      videoPath: 'Harbor Lights/harbor.mp4',
      genres: ['Drama'],
    });
    addSeriesAt(storage, '2026-01-01T00:00:00.000Z', {
      title: 'Harbor & Vine',
      genres: ['Drama'],
    });

    const response = await fetch(`${baseUrl}/api/home?q=harbor&genre=Drama`);
    const body = (await response.json()) as HomePayload;

    expect(
      body.rows.flatMap((row) => row.movies.map((movie) => movie.title))
    ).toEqual(['Harbor Lights']);
  });
});
