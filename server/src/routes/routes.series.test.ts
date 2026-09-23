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
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { SeriesDetail, SeriesHomePayload } from '@/types';

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

  it('answers the episode total across every series', async () => {
    const { storage, baseUrl } = freshApi();
    seedSeries(storage, 'Harbor & Vine', 3);
    seedSeries(storage, 'Lighthouse Keepers', 2);

    const { body } = await getSeries(baseUrl);

    expect(body.episodeCount).toBe(5);
  });

  it('answers an empty library as no series and no episodes', async () => {
    const { baseUrl } = freshApi();

    const { status, body } = await getSeries(baseUrl);

    expect(status).toBe(200);
    expect(body.series).toEqual([]);
    expect(body.episodeCount).toBe(0);
  });

  it('counts no movie as a series', async () => {
    const { storage, baseUrl } = freshApi();
    storage.addMovie({ title: 'Die Hard', videoPath: 'die-hard/dh.mp4' });

    const { body } = await getSeries(baseUrl);

    expect(body.series).toEqual([]);
    expect(body.episodeCount).toBe(0);
  });
});

// 22 — Series (TV), Phase 1 (issue #190): the Series tab draws the watched
// badge on a series whose every episode is watched, so each series answers
// `watched` — derived, never stored. Episodes are marked through the
// library's `markEpisodeWatched`, the movie's `markWatched` over an episode.
describe('GET /api/series — watched', () => {
  it('answers a series watched when every episode is watched', async () => {
    const { storage, baseUrl } = freshApi();
    seedSeries(storage, 'Harbor & Vine', 2);
    const [series] = storage.getSeriesHome().series;
    for (const episode of storage.listEpisodes(series.id)) {
      storage.markEpisodeWatched(episode.id);
    }

    const { body } = await getSeries(baseUrl);

    expect(body.series[0].watched).toBe(true);
  });

  it('answers a series with one episode left not watched', async () => {
    const { storage, baseUrl } = freshApi();
    seedSeries(storage, 'Harbor & Vine', 2);
    const [series] = storage.getSeriesHome().series;
    const [first] = storage.listEpisodes(series.id);
    storage.markEpisodeWatched(first.id);

    const { body } = await getSeries(baseUrl);

    expect(body.series[0].watched).toBe(false);
  });

  it('answers a series nobody has started not watched', async () => {
    const { storage, baseUrl } = freshApi();
    seedSeries(storage, 'Harbor & Vine', 2);

    const { body } = await getSeries(baseUrl);

    expect(body.series[0].watched).toBe(false);
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

  /** `S01E02`, the way the assertions below read an episode. */
  const tag = (episode: { season: number; number: number } | null) =>
    episode === null
      ? null
      : `S${String(episode.season).padStart(2, '0')}E${String(
          episode.number
        ).padStart(2, '0')}`;

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

  it('answers the seasons in order, each with its episodes in order', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedHarbor(storage);

    const { body } = await getDetail(baseUrl, id);

    expect(body.seasons.map((season) => season.number)).toEqual([1, 2]);
    expect(body.seasons[0].episodes.map(tag)).toEqual(['S01E01', 'S01E02']);
    expect(body.seasons[1].episodes.map(tag)).toEqual([
      'S02E01',
      'S02E02',
      'S02E03',
    ]);
  });

  it('answers each episode with its derived watch status', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedHarbor(storage);
    storage.markEpisodeWatched(storage.listEpisodes(id)[0].id);

    const { body } = await getDetail(baseUrl, id);

    expect(body.seasons[0].episodes.map((episode) => episode.status)).toEqual([
      'watched',
      'unwatched',
    ]);
  });

  it('answers the first episode as next for a show nobody has started', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedHarbor(storage);

    const { body } = await getDetail(baseUrl, id);

    expect(tag(body.next)).toBe('S01E01');
    expect(body.seasons.map((season) => tag(season.next))).toEqual([
      'S01E01',
      'S02E01',
    ]);
  });

  it('answers the series’ next episode across seasons once one is finished', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedHarbor(storage);
    const [s1e1, s1e2, s2e1] = storage.listEpisodes(id);
    for (const episode of [s1e1, s1e2, s2e1]) {
      storage.markEpisodeWatched(episode.id);
    }

    const { body } = await getDetail(baseUrl, id);

    expect(tag(body.next)).toBe('S02E02');
  });

  it('answers each season’s own next episode', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedHarbor(storage);
    const [s1e1, s1e2, s2e1] = storage.listEpisodes(id);
    for (const episode of [s1e1, s1e2, s2e1]) {
      storage.markEpisodeWatched(episode.id);
    }

    const { body } = await getDetail(baseUrl, id);

    // Season 1 is finished, so its next is its first; season 2 picks up at E02.
    expect(body.seasons.map((season) => tag(season.next))).toEqual([
      'S01E01',
      'S02E02',
    ]);
  });

  it('answers the series watched once every episode is, and not before', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedHarbor(storage);
    const episodes = storage.listEpisodes(id);
    for (const episode of episodes.slice(0, -1)) {
      storage.markEpisodeWatched(episode.id);
    }

    expect((await getDetail(baseUrl, id)).body.series.watched).toBe(false);

    storage.markEpisodeWatched(episodes[episodes.length - 1].id);

    const { body } = await getDetail(baseUrl, id);
    expect(body.series.watched).toBe(true);
    expect(tag(body.next)).toBe('S01E01');
  });

  it('answers a series with no episodes as no seasons and no next episode', async () => {
    const { storage, baseUrl } = freshApi();
    const series = storage.addSeries({ title: 'Lighthouse Keepers' });

    const { status, body } = await getDetail(baseUrl, series.id);

    expect(status).toBe(200);
    expect(body.seasons).toEqual([]);
    expect(body.next).toBeNull();
  });

  it('answers only the series asked for', async () => {
    const { storage, baseUrl } = freshApi();
    const id = seedHarbor(storage);
    seedSeries(storage, 'Lighthouse Keepers', 4);

    const { body } = await getDetail(baseUrl, id);

    expect(body.series.title).toBe('Harbor & Vine');
    expect(
      body.seasons.flatMap((season) => season.episodes).map((e) => e.seriesId)
    ).toEqual([id, id, id, id, id]);
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
