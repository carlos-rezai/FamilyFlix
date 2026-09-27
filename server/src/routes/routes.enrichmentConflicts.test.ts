// @vitest-environment node
//
// 23 — Enrichment, Phase 5: "conflict Decisions" (issue #208).
//
// _Apply choices_ over HTTP, through a real listener over a real `:memory:`
// library and a sandbox media root. The `enrichment/` domain is injected as
// the router's sixth argument over a `createTmdbClient` whose own `fetch` is
// a fake TMDB, so nothing here goes online.
//
// - `POST /api/enrichment/current/decisions/:id/apply { choices }` → `204`,
//   the chosen side of each **Field conflict** written, the row off the run
//   and counted into `enriched`.

import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import type { Decision, EnrichField, EnrichmentRun } from '@/types';
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

const OURS = 'A lighthouse keeper on a fading coast takes in a runaway girl…';
const THEIRS = 'On a storm-battered coast, a keeper shelters a runaway.';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/** TMDB's _The Lantern Keeper_: a year, a director and a synopsis of its own. */
const LANTERN = {
  id: 201,
  title: 'The Lantern Keeper',
  original_title: 'Le Gardien du phare',
  overview: THEIRS,
  release_date: '2018-10-02',
  runtime: 104,
  genres: [{ id: 18, name: 'Drama' }],
  vote_average: 7.4,
  poster_path: '/lantern-poster.jpg',
  backdrop_path: '/lantern-backdrop.jpg',
  credits: {
    cast: [{ name: 'Mara Quill', order: 0 }],
    crew: [{ name: 'Eleanor Past-Whitlock', job: 'Director' }],
  },
};

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
    if (url.pathname === '/3/movie/201') {
      return Promise.resolve(json(LANTERN));
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

/** A library with a key and _The Lantern Keeper_, behind a listening API. */
async function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  storage.setTmdbKey(KEY);

  const media = sandboxRoot('familyflix-enrich-conflicts-api-');
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null));
  const enrichment = createEnrichment({
    storage,
    client: createTmdbClient(fakeTmdb()),
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
    tmdbId: 201,
    synopsis: OURS,
    director: 'Eleanor Past',
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
  return { storage, movieId, baseUrl: `http://127.0.0.1:${port}` };
}

const post = (url: string, body: unknown) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function currentRun(baseUrl: string): Promise<EnrichmentRun> {
  return vi.waitFor(async () => {
    const response = await fetch(`${baseUrl}/api/enrichment/current`);
    expect(response.status).toBe(200);
    const run = (await response.json()) as EnrichmentRun;
    expect(run.phase).toBe('review');
    return run;
  });
}

/** Sync everything and wait for the review; answers its one Decision. */
async function reviewedConflict(baseUrl: string): Promise<Decision> {
  const started = await post(`${baseUrl}/api/enrichment`, {
    scope: 'all',
    fields: ALL_FIELDS,
    writeSheet: false,
    writePosters: false,
  });
  expect(started.status).toBe(201);
  const run = await currentRun(baseUrl);
  expect(run.decisions).toHaveLength(1);
  expect(run.decisions[0].kind).toBe('conflict');
  return run.decisions[0];
}

const applyUrl = (baseUrl: string, id: string) =>
  `${baseUrl}/api/enrichment/current/decisions/${encodeURIComponent(id)}/apply`;

describe('POST /api/enrichment/current/decisions/:id/apply', () => {
  it('answers 204 and writes the side chosen for each field', async () => {
    const { baseUrl, storage, movieId } = await freshApi();
    const { id } = await reviewedConflict(baseUrl);

    const response = await post(applyUrl(baseUrl, id), {
      choices: { synopsis: 'tmdb', year: 'mine', director: 'tmdb' },
    });

    expect(response.status).toBe(204);
    const movie = storage.getMovie(movieId);
    expect(movie?.synopsis).toBe(THEIRS);
    expect(movie?.year).toBe(2019);
    expect(movie?.director).toBe('Eleanor Past-Whitlock');
  });

  it('takes the row off the run and counts it as enriched', async () => {
    const { baseUrl } = await freshApi();
    const { id } = await reviewedConflict(baseUrl);

    await post(applyUrl(baseUrl, id), {
      choices: { synopsis: 'tmdb', year: 'tmdb', director: 'tmdb' },
    });

    const run = await currentRun(baseUrl);
    expect(run.decisions).toEqual([]);
    expect(run.enriched).toBe(1);
  });
});
