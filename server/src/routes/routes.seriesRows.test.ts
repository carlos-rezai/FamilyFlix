// @vitest-environment node
//
// 63, Row view, Phase 4 (issue #611): `GET /api/series/rows`, Series under
// **By genre**.
//
// The route reads the one **Library query** through `libraryQueryOr400` and
// answers `SeriesRowsPayload` (`{ rows, other, favorites, continueWatching }`),
// or 400 on a query it cannot read, and is registered ahead of `/series/:id`
// so `rows` is never read as a series id. Over a real listener and a real
// `:memory:` library, `routes.movieGrid`' harness.

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
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';

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

  const media = join(sandboxRoot('familyflix-series-rows-'), 'media');
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

/** The payload's shape as the wire carries it. */
interface RowsBody {
  rows: { genre: string; count: number; series: { title: string }[] }[];
  other: { count: number; series: { title: string }[] } | null;
  favorites: { title: string }[];
  continueWatching: { series: { title: string } }[];
}

describe('GET /api/series/rows', () => {
  it('answers the series rows payload for the query it carries', async () => {
    const { baseUrl, storage } = freshApi();
    storage.addSeries({ title: 'Harbor Days', genres: ['Drama'] });
    storage.addSeries({ title: 'Lighthouse Keepers', genres: ['Drama'] });
    storage.addSeries({
      title: 'Harbor Tapes',
      genres: [],
      isFavorite: true,
    });

    const response = await fetch(
      `${baseUrl}/api/series/rows?q=harbor&sort=a-z`
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as RowsBody;
    expect(Object.keys(body).sort()).toEqual([
      'continueWatching',
      'favorites',
      'other',
      'rows',
    ]);
    expect(
      body.rows.map((row) => [
        row.genre,
        row.count,
        row.series.map((s) => s.title),
      ])
    ).toEqual([['Drama', 2, ['Harbor Days']]]);
    expect(body.other?.series.map((s) => s.title)).toEqual(['Harbor Tapes']);
    expect(body.favorites.map((s) => s.title)).toEqual(['Harbor Tapes']);
    expect(body.continueWatching).toEqual([]);
  });

  it('answers 400 on a sort it does not recognise', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(`${baseUrl}/api/series/rows?sort=sideways`);

    expect(response.status).toBe(400);
  });

  it('answers 400 on a rating minimum off the scale', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(`${baseUrl}/api/series/rows?rating=11`);

    expect(response.status).toBe(400);
  });

  it('is never read as a series id', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(`${baseUrl}/api/series/rows`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as RowsBody;
    expect(body).toEqual({
      rows: [],
      other: null,
      favorites: [],
      continueWatching: [],
    });
  });
});
