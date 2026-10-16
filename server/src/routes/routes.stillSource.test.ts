// @vitest-environment node
//
// 44 — Episode stills, Phase 1 (issue #382): the **Still source** through the
// series form's two saves, `POST /api/series` and `PATCH /api/series/:id`.
//
// A freshly picked still is `'picked'`; a held still sent back unchanged keeps
// the source it had — a held `'frame'` included; a removed still clears its
// path and its source together. The source is server side only, so the
// assembled `Episode` never carries it: this suite reads the column itself,
// over an on-disk library read back through a second connection.

import express from 'express';
import { mkdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { openDatabase } from '../db';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { Episode, Series } from '@/types';

const storages: LibraryStorage[] = [];
const servers: Server[] = [];

// Runs before `sandboxRoot`'s sweep, so no open database blocks it on Windows.
afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const storage of storages.splice(0)) {
    storage.close();
  }
});

/** An on-disk library behind a listening API, composed as `main.ts` does. */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  dbPath: string;
} {
  const sandbox = sandboxRoot('familyflix-still-source-');
  const dbPath = join(sandbox, 'library.db');
  const storage = createSqliteStorage(dbPath);
  storages.push(storage);

  const media = join(sandbox, 'media');
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
  return { storage, baseUrl: `http://127.0.0.1:${port}`, dbPath };
}

/** Each episode's still and its source, as the `episodes` table holds them. */
function stillsOf(
  dbPath: string,
  seriesId: string
): Array<{ still_path: string | null; still_source: string | null }> {
  const db = openDatabase(dbPath);
  try {
    return db
      .prepare(
        `SELECT still_path, still_source FROM episodes
         WHERE series_id = ? ORDER BY season_number, episode_number`
      )
      .all(seriesId) as Array<{
      still_path: string | null;
      still_source: string | null;
    }>;
  } finally {
    db.close();
  }
}

const videoPart = (filename: string): File =>
  new File([new Uint8Array(Buffer.from('video bytes'))], filename, {
    type: 'video/mp4',
  });

const stillPart = (filename = 'frame.jpg'): File =>
  new File([new Uint8Array(Buffer.from('image bytes'))], filename, {
    type: 'image/jpeg',
  });

type Part = [name: string, value: string | File];

function send(
  method: 'POST' | 'PATCH',
  url: string,
  parts: Part[]
): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(url, { method, body });
}

/** The series fields the edit sends back unchanged. */
const FIELDS: Part[] = [
  ['title', 'Harbor and Vine'],
  ['year', '2019'],
];

/** _Harbor and Vine_ with `S01E01` and `S01E02`, neither with a still. */
async function addHarbor(baseUrl: string): Promise<Series> {
  const response = await send('POST', `${baseUrl}/api/series`, [
    ...FIELDS,
    ['episode', JSON.stringify({ season: 1, number: 1, title: 'Pilot' })],
    ['episodeVideo', videoPart('S01E01.mp4')],
    ['episode', JSON.stringify({ season: 1, number: 2, title: 'Low Tide' })],
    ['episodeVideo', videoPart('S01E02.mp4')],
  ]);
  expect(response.status).toBe(201);
  return (await response.json()) as Series;
}

/** A held episode's `episode` field, its files as the paths they have. */
function heldEpisode(
  episode: Episode,
  overrides: Record<string, unknown> = {}
): Part {
  return [
    'episode',
    JSON.stringify({
      id: episode.id,
      season: episode.season,
      number: episode.number,
      title: episode.title ?? '',
      videoPath: episode.videoPath,
      storedSubtitles: [],
      ...(episode.stillPath === null ? {} : { stillPath: episode.stillPath }),
      subtitleLanguages: [],
      ...overrides,
    }),
  ];
}

const patchSeries = (baseUrl: string, id: string, parts: Part[]) =>
  send('PATCH', `${baseUrl}/api/series/${encodeURIComponent(id)}`, parts);

describe('the series form writes the Still source', () => {
  it('stores a still picked on POST /api/series with source picked', async () => {
    const { baseUrl, dbPath } = freshApi();

    const response = await send('POST', `${baseUrl}/api/series`, [
      ...FIELDS,
      ['episode', JSON.stringify({ season: 1, number: 1, title: 'Pilot' })],
      ['episodeVideo', videoPart('S01E01.mp4')],
      ['episodeStill', stillPart()],
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    expect(stillsOf(dbPath, series.id)).toEqual([
      {
        still_path: expect.stringMatching(/S01E01-still\.jpg$/),
        still_source: 'picked',
      },
    ]);
  });

  it('stores a still picked on PATCH /api/series/:id with source picked, over a held TMDB one', async () => {
    const { storage, baseUrl, dbPath } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    storage.enrichEpisode(pilot.id, {
      stillPath: 'Harbor and Vine (2019)/season-01/S01E01.still.jpg',
      stillSource: 'tmdb',
    });

    const response = await patchSeries(baseUrl, series.id, [
      ...FIELDS,
      heldEpisode(storage.listEpisodes(series.id)[0], {
        stillPath: undefined,
      }),
      ['episodeStill', stillPart()],
      heldEpisode(lowTide),
      ['episodeStill', stillPart()],
    ]);

    expect(response.status).toBe(200);
    expect(stillsOf(dbPath, series.id)).toEqual([
      {
        still_path: expect.stringMatching(/S01E01-still\.jpg$/),
        still_source: 'picked',
      },
      {
        still_path: expect.stringMatching(/S01E02-still\.jpg$/),
        still_source: 'picked',
      },
    ]);
  });

  it('keeps the source of a held still sent back unchanged, a held frame included', async () => {
    const { storage, baseUrl, dbPath } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    storage.enrichEpisode(pilot.id, {
      stillPath: 'Harbor and Vine (2019)/season-01/S01E01.frame.jpg',
      stillSource: 'frame',
    });
    storage.enrichEpisode(lowTide.id, {
      stillPath: 'Harbor and Vine (2019)/season-01/S01E02.still.jpg',
      stillSource: 'tmdb',
    });

    const response = await patchSeries(baseUrl, series.id, [
      ...FIELDS,
      ...storage.listEpisodes(series.id).map((episode) => heldEpisode(episode)),
    ]);

    expect(response.status).toBe(200);
    expect(stillsOf(dbPath, series.id)).toEqual([
      {
        still_path: 'Harbor and Vine (2019)/season-01/S01E01.frame.jpg',
        still_source: 'frame',
      },
      {
        still_path: 'Harbor and Vine (2019)/season-01/S01E02.still.jpg',
        still_source: 'tmdb',
      },
    ]);
  });

  it('clears still_path and still_source together for a removed still', async () => {
    const { storage, baseUrl, dbPath } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    storage.enrichEpisode(pilot.id, {
      stillPath: 'Harbor and Vine (2019)/season-01/S01E01.frame.jpg',
      stillSource: 'frame',
    });

    const response = await patchSeries(baseUrl, series.id, [
      ...FIELDS,
      heldEpisode(storage.listEpisodes(series.id)[0], {
        stillPath: undefined,
      }),
      heldEpisode(lowTide),
    ]);

    expect(response.status).toBe(200);
    expect(stillsOf(dbPath, series.id)).toEqual([
      { still_path: null, still_source: null },
      { still_path: null, still_source: null },
    ]);
  });
});
