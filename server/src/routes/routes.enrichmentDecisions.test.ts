// @vitest-environment node
//
// 23 — Enrichment, Phase 4: "ambiguous and missing Decisions" (issue #207).
//
// The review's three **Decision** routes, through a real listener over a real
// `:memory:` library and a sandbox media root. The `enrichment/` domain is
// injected as the router's sixth argument over a `createTmdbClient` whose own
// `fetch` is a fake TMDB, so nothing here goes online.
//
// - `POST /api/enrichment/current/decisions/:id/search { query }` →
//   `200 Decision`.
// - `POST /api/enrichment/current/decisions/:id/pick { tmdbId }` → `204`,
//   the film written through the same path as a Confident title.
// - `DELETE /api/enrichment/current/decisions/:id` → `204` · `404` (_Skip_).

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

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const result = (id: number, year: number) => ({
  id,
  title: 'Harbor Lights',
  original_title: 'Harbor Lights',
  release_date: `${year}-06-14`,
  genre_ids: [18],
  original_language: 'en',
  poster_path: `/poster-${id}.jpg`,
  vote_average: 7.1,
});

const detail = (id: number, year: number) => ({
  ...result(id, year),
  overview: `The ${year} Harbor Lights.`,
  runtime: 98,
  genres: [{ id: 18, name: 'Drama' }],
  backdrop_path: `/backdrop-${id}.jpg`,
  credits: {
    cast: [{ name: `Lead of ${id}`, order: 0 }],
    crew: [{ name: `Director of ${id}`, job: 'Director' }],
  },
});

/**
 * A fake TMDB where two releases share _Harbor Lights_ and any other query
 * finds nothing.
 */
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
      const results =
        url.searchParams.get('query') === 'Harbor Lights'
          ? [result(101, 1963), result(102, 2019)]
          : [];
      return Promise.resolve(
        json({ page: 1, total_results: results.length, results })
      );
    }
    if (url.pathname === '/3/movie/101') {
      return Promise.resolve(json(detail(101, 1963)));
    }
    if (url.pathname === '/3/movie/102') {
      return Promise.resolve(json(detail(102, 2019)));
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

/** A library with a key and _Harbor Lights_, behind a listening API. */
async function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  storage.setTmdbKey(KEY);

  const media = sandboxRoot('familyflix-enrich-decisions-api-');
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null));
  const enrichment = createEnrichment({
    storage,
    client: createTmdbClient(fakeTmdb()),
    media: mediaDomain,
  });

  const folder = mediaDomain.reserveFolder('Harbor Lights', 1963);
  const videoPath = await mediaDomain.storeUpload(
    folder,
    'harbor.mp4',
    Readable.from([Buffer.from('video bytes')])
  );
  const movieId = storage.addMovie({
    title: 'Harbor Lights',
    year: 1963,
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

/** Sync everything and wait for the review; answers its one Decision. */
async function reviewedDecision(baseUrl: string): Promise<Decision> {
  const started = await fetch(`${baseUrl}/api/enrichment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'all',
      fields: ALL_FIELDS,
      writeSheet: false,
      writePosters: false,
    }),
  });
  expect(started.status).toBe(201);
  const run = await currentRun(baseUrl);
  expect(run.decisions).toHaveLength(1);
  return run.decisions[0];
}

async function currentRun(baseUrl: string): Promise<EnrichmentRun> {
  return vi.waitFor(async () => {
    const response = await fetch(`${baseUrl}/api/enrichment/current`);
    expect(response.status).toBe(200);
    const run = (await response.json()) as EnrichmentRun;
    expect(run.phase).toBe('review');
    return run;
  });
}

const decisionUrl = (baseUrl: string, id: string) =>
  `${baseUrl}/api/enrichment/current/decisions/${encodeURIComponent(id)}`;

const post = (url: string, body: unknown) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/enrichment/current/decisions/:id/search', () => {
  it('answers 200 with the Decision, its candidates the search’s', async () => {
    const { baseUrl } = await freshApi();
    const { id } = await reviewedDecision(baseUrl);

    const response = await post(`${decisionUrl(baseUrl, id)}/search`, {
      query: 'Harbor Lights',
    });

    expect(response.status).toBe(200);
    const decision = (await response.json()) as Decision;
    expect(decision.id).toBe(id);
    expect(decision.kind).toBe('ambiguous');
    if (decision.kind !== 'ambiguous') return;
    expect(decision.candidates.map((each) => each.tmdbId)).toEqual([101, 102]);
    expect(decision.candidates[0].posterUrl).toBe(
      'https://image.tmdb.org/t/p/w185/poster-101.jpg'
    );
  });

  it('answers 200 with a missing Decision when nothing matched', async () => {
    const { baseUrl } = await freshApi();
    const { id } = await reviewedDecision(baseUrl);

    const response = await post(`${decisionUrl(baseUrl, id)}/search`, {
      query: 'Harbour Lites',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        id,
        kind: 'missing',
        query: 'Harbour Lites',
        reason: 'Nothing on TMDB matched “Harbour Lites”.',
      })
    );
  });
});

describe('POST /api/enrichment/current/decisions/:id/pick', () => {
  it('answers 204 and writes the picked film', async () => {
    const { baseUrl, storage, movieId } = await freshApi();
    const { id } = await reviewedDecision(baseUrl);

    const response = await post(`${decisionUrl(baseUrl, id)}/pick`, {
      tmdbId: 102,
    });

    expect(response.status).toBe(204);
    const movie = storage.getMovie(movieId);
    expect(movie?.tmdbId).toBe(102);
    expect(movie?.synopsis).toBe('The 2019 Harbor Lights.');
    expect(movie?.director).toBe('Director of 102');
  });

  it('takes the row off the run and counts it as enriched', async () => {
    const { baseUrl } = await freshApi();
    const { id } = await reviewedDecision(baseUrl);

    await post(`${decisionUrl(baseUrl, id)}/pick`, { tmdbId: 101 });

    const run = await currentRun(baseUrl);
    expect(run.decisions).toEqual([]);
    expect(run.enriched).toBe(1);
  });
});

describe('DELETE /api/enrichment/current/decisions/:id — Skip', () => {
  it('answers 204 and takes the row off the run', async () => {
    const { baseUrl, storage, movieId } = await freshApi();
    const { id } = await reviewedDecision(baseUrl);

    const response = await fetch(decisionUrl(baseUrl, id), {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);
    const run = await currentRun(baseUrl);
    expect(run.decisions).toEqual([]);
    expect(run.enriched).toBe(0);
    expect(storage.getMovie(movieId)?.tmdbId).toBeNull();
  });

  it('answers 404 for a row already skipped', async () => {
    const { baseUrl } = await freshApi();
    const { id } = await reviewedDecision(baseUrl);
    await fetch(decisionUrl(baseUrl, id), { method: 'DELETE' });

    const response = await fetch(decisionUrl(baseUrl, id), {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
  });
});
