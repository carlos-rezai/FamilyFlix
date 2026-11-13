// @vitest-environment node
//
// 63, Row view, Phase 5 (issue #612): `GET /api/series/genre/:name` and
// `GET /api/series/genre-less`, the series Genre page's two reads.
//
// Each reads the **genre query** through `genreQueryOr400` and answers
// `GenrePayload`'s shape in series (`{ genre, total, series }`), or 400 on a
// query it cannot read, and both are registered ahead of `/series/:id` so
// neither path is read as a series id. Over a real listener and a real
// `:memory:` library, `routes.seriesRows`' harness.

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

  const media = join(sandboxRoot('familyflix-series-genre-'), 'media');
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
interface GenreBody {
  genre: string;
  total: number;
  series: { title: string }[];
}

async function getBody(url: string): Promise<GenreBody> {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return (await response.json()) as GenreBody;
}

describe('GET /api/series/genre/:name', () => {
  it('answers the genre’s series for the query it carries', async () => {
    const { baseUrl, storage } = freshApi();
    storage.addSeries({ title: 'Harbor Days', genres: ['Drama'] });
    storage.addSeries({ title: 'Lighthouse Keepers', genres: ['Drama'] });
    storage.addSeries({ title: 'Harbor Laughs', genres: ['Comedy'] });

    const body = await getBody(
      `${baseUrl}/api/series/genre/Drama?q=harbor&sort=a-z`
    );

    expect(Object.keys(body).sort()).toEqual(['genre', 'series', 'total']);
    expect(body.genre).toBe('Drama');
    expect(body.total).toBe(2);
    expect(body.series.map((s) => s.title)).toEqual(['Harbor Days']);
  });

  it('answers every series in the genre, uncapped', async () => {
    const { baseUrl, storage } = freshApi();
    for (let n = 1; n <= 20; n += 1) {
      storage.addSeries({
        title: `Show ${String(n).padStart(2, '0')}`,
        genres: ['Drama'],
      });
    }

    const body = await getBody(`${baseUrl}/api/series/genre/Drama`);

    expect(body.series).toHaveLength(20);
    expect(body.total).toBe(20);
  });

  it('decodes a genre whose name has a space in it', async () => {
    const { baseUrl } = freshApi();

    const body = await getBody(`${baseUrl}/api/series/genre/Science%20Fiction`);

    // The seeded pool holds no two-word genre, so what this asserts is the
    // decode, not the hit, as the movie route's test does.
    expect(body).toEqual({ genre: 'Science Fiction', total: 0, series: [] });
  });

  it('answers 400 on a sort it does not recognise', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(
      `${baseUrl}/api/series/genre/Drama?sort=sideways`
    );

    expect(response.status).toBe(400);
  });
});

describe('GET /api/series/genre-less', () => {
  it('answers every series with no genre for the query it carries', async () => {
    const { baseUrl, storage } = freshApi();
    storage.addSeries({ title: 'Loose Tape', genres: [] });
    storage.addSeries({ title: 'Attic Reel', genres: [] });
    storage.addSeries({ title: 'Harbor Days', genres: ['Drama'] });

    const body = await getBody(`${baseUrl}/api/series/genre-less?sort=a-z`);

    expect(body.genre).toBe('');
    expect(body.total).toBe(2);
    expect(body.series.map((s) => s.title)).toEqual([
      'Attic Reel',
      'Loose Tape',
    ]);
  });

  it('answers 400 on a sort it does not recognise', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(
      `${baseUrl}/api/series/genre-less?sort=sideways`
    );

    expect(response.status).toBe(400);
  });

  it('is never read as a series id', async () => {
    const { baseUrl } = freshApi();

    const body = await getBody(`${baseUrl}/api/series/genre-less`);

    expect(body).toEqual({ genre: '', total: 0, series: [] });
  });
});
