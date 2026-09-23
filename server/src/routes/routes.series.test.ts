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
import type { SeriesHomePayload } from '@/types';

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
