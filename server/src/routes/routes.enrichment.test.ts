// @vitest-environment node
//
// 23 — Enrichment, Phase 2: "the tracer — Just this movie" (issue #204).
//
// The **Current enrichment run**'s first two routes, through a real listener
// over a real `:memory:` library and a sandbox media root. The `enrichment/`
// domain is injected as the router's sixth argument, over a
// `createTmdbClient` whose own `fetch` is a fake TMDB — search, detail with
// credits, and image bytes — so nothing here goes online and no route learns
// there is a TMDB.
//
// - `POST /api/enrichment { scope, movieId?, fields, writeSheet,
//   writePosters }` → `201 EnrichmentRun`.
// - `GET /api/enrichment/current` → the run, or `404` when none is held.
//
// The tracer end to end: a film from the library comes back with its
// synopsis, credits, poster and backdrop, and every request that went to
// TMDB's API asked for `en-US`.

import express from 'express';
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import type { EnrichField, EnrichmentRun } from '@/types';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createTmdbClient } from '../enrichment/tmdbClient/tmdbClient';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
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

type Fetch = typeof fetch;

const KEY = '0123456789abcdef0123456789abcdef';

const ALL_FIELDS: EnrichField[] = [
  'synopsis',
  'poster',
  'backdrop',
  'runtime',
  'year',
  'genres',
  'director',
  'cast',
  'originalTitle',
  'tmdbScore',
];

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/** A fake TMDB that knows one film, behind the client's injected `fetch`. */
function fakeTmdb() {
  return vi.fn<Fetch>((input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === 'https://image.tmdb.org') {
      return Promise.resolve(
        new Response(new TextEncoder().encode(`bytes of ${url.pathname}`), {
          status: 200,
        })
      );
    }
    if (url.pathname === '/3/search/movie') {
      return Promise.resolve(
        json({
          page: 1,
          total_results: 1,
          results: [
            {
              id: 550123,
              title: 'The Lantern Keeper',
              original_title: 'Le Gardien du phare',
              release_date: '2019-06-14',
              genre_ids: [18],
              original_language: 'fr',
              poster_path: '/lantern-poster.jpg',
              vote_average: 7.4,
            },
          ],
        })
      );
    }
    if (url.pathname === '/3/movie/550123') {
      return Promise.resolve(
        json({
          id: 550123,
          title: 'The Lantern Keeper',
          original_title: 'Le Gardien du phare',
          overview: 'A keeper tends a light nobody needs any more.',
          release_date: '2019-06-14',
          runtime: 112,
          genres: [{ id: 18, name: 'Drama' }],
          vote_average: 7.456,
          poster_path: '/lantern-poster.jpg',
          backdrop_path: '/lantern-backdrop.jpg',
          credits: {
            cast: [{ name: 'Ada Brennan', order: 0 }],
            crew: [{ name: 'Paul Verhoek', job: 'Director' }],
          },
        })
      );
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

/** A library with a key and one film, behind a listening API. */
async function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  storage.setTmdbKey(KEY);

  const media = sandboxRoot('familyflix-enrich-api-');
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null));
  const tmdbFetch = fakeTmdb();
  const enrichment = createEnrichment({
    storage,
    client: createTmdbClient(tmdbFetch),
    media: mediaDomain,
  });

  const folder = mediaDomain.reserveFolder('The Lantern Keeper', 2019);
  const videoPath = await mediaDomain.storeUpload(
    folder,
    'lantern.mp4',
    Readable.from([Buffer.from('video bytes')])
  );
  const movieId = storage.addMovie({
    title: 'The Lantern Keeper',
    year: 2019,
    videoPath,
  }).id;

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback }),
      enrichment
    )
  );

  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return {
    storage,
    media,
    movieId,
    tmdbFetch,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}

const startSync = (baseUrl: string, movieId: string) =>
  fetch(`${baseUrl}/api/enrichment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'single',
      movieId,
      fields: ALL_FIELDS,
      writeSheet: false,
      writePosters: false,
    }),
  });

/** Poll the current run the way the screen does, until it reaches review. */
async function reviewedRun(baseUrl: string): Promise<EnrichmentRun> {
  return vi.waitFor(async () => {
    const response = await fetch(`${baseUrl}/api/enrichment/current`);
    expect(response.status).toBe(200);
    const run = (await response.json()) as EnrichmentRun;
    expect(run.phase).toBe('review');
    return run;
  });
}

describe('GET /api/enrichment/current', () => {
  it('answers 404 when no Sync has been started', async () => {
    const { baseUrl } = await freshApi();

    const response = await fetch(`${baseUrl}/api/enrichment/current`);

    expect(response.status).toBe(404);
  });
});

describe('POST /api/enrichment — a single-title Sync', () => {
  it('answers 201 with the run, its scope and total known up front', async () => {
    const { baseUrl, movieId } = await freshApi();

    const response = await startSync(baseUrl, movieId);

    expect(response.status).toBe(201);
    const run = (await response.json()) as EnrichmentRun;
    expect(run.scope).toBe('single');
    expect(run.total).toBe(1);
    expect(typeof run.id).toBe('string');
    expect(['running', 'review']).toContain(run.phase);
  });

  it('holds the run it started as the current one', async () => {
    const { baseUrl, movieId } = await freshApi();

    const started = (await (
      await startSync(baseUrl, movieId)
    ).json()) as EnrichmentRun;
    const current = await fetch(`${baseUrl}/api/enrichment/current`);

    expect(current.status).toBe(200);
    expect(((await current.json()) as EnrichmentRun).id).toBe(started.id);
  });

  it('reaches review with the film enriched, its art in its Movie folder', async () => {
    const { baseUrl, movieId, storage, media } = await freshApi();

    await startSync(baseUrl, movieId);
    const run = await reviewedRun(baseUrl);

    expect(run.enriched).toBe(1);
    expect(run.decisions).toEqual([]);
    const movie = storage.getMovie(movieId);
    expect(movie?.tmdbId).toBe(550123);
    expect(movie?.synopsis).toBe(
      'A keeper tends a light nobody needs any more.'
    );
    expect(movie?.director).toBe('Paul Verhoek');
    expect(movie?.cast).toEqual(['Ada Brennan']);
    expect(movie?.posterPath).toBe('the-lantern-keeper-2019/poster.jpg');
    expect(movie?.backdropPath).toBe('the-lantern-keeper-2019/backdrop.jpg');
    expect(
      existsSync(join(media, 'the-lantern-keeper-2019', 'poster.jpg'))
    ).toBe(true);
    expect(
      existsSync(join(media, 'the-lantern-keeper-2019', 'backdrop.jpg'))
    ).toBe(true);
  });

  it('asks TMDB’s API for en-US on every request', async () => {
    const { baseUrl, movieId, tmdbFetch } = await freshApi();

    await startSync(baseUrl, movieId);
    await reviewedRun(baseUrl);

    const apiRequests = tmdbFetch.mock.calls
      .map(
        ([input]) =>
          new URL(input instanceof Request ? input.url : String(input))
      )
      .filter((url) => url.origin === 'https://api.themoviedb.org');
    expect(apiRequests.length).toBeGreaterThan(0);
    for (const url of apiRequests) {
      expect(url.searchParams.get('language'), url.pathname).toBe('en-US');
    }
  });
});
