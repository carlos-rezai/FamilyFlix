// @vitest-environment node
//
// 63, Row view, Phase 3 (issue #610): `GET /api/movies`, Movies under **All**.
//
// The route reads the one **Library query** through `libraryQueryOr400` and
// answers `MovieGridPayload` (`{ movies, continueWatching }`), or 400 on a
// query it cannot read, as `/api/home` does. Over a real listener and a real
// `:memory:` library, `routes.libraryTitles`' harness.

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
import { newMovie } from '../test-support/newMovie/newMovie';
import type { MovieGridPayload } from '@/types';

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

  const media = join(sandboxRoot('familyflix-movie-grid-'), 'media');
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

describe('GET /api/movies', () => {
  it('answers the movie grid payload for the query it carries', async () => {
    const { baseUrl, storage } = freshApi();
    storage.addMovie(newMovie({ title: 'Comic Caper', genres: ['Comedy'] }));
    storage.addMovie(
      newMovie({
        title: 'Comic Relief',
        genres: [],
        resumePositionSeconds: 600,
      })
    );
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));

    const response = await fetch(`${baseUrl}/api/movies?q=comic&sort=a-z`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as MovieGridPayload;
    expect(Object.keys(body).sort()).toEqual(['continueWatching', 'movies']);
    expect(body.movies.map((m) => m.title)).toEqual([
      'Comic Caper',
      'Comic Relief',
    ]);
    expect(body.continueWatching.map((m) => m.title)).toEqual(['Comic Relief']);
  });

  it('answers 400 on a sort it does not recognise', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(`${baseUrl}/api/movies?sort=sideways`);

    expect(response.status).toBe(400);
  });

  it('answers 400 on a rating minimum off the scale', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(`${baseUrl}/api/movies?rating=11`);

    expect(response.status).toBe(400);
  });
});
