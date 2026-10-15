// @vitest-environment node
//
// 41 — Review at scale, Phase 6: "Skip all in the Sync review" (issue #362).
//
// `POST /api/enrichment/current/decisions/dismiss { ids }` — the bulk Skip
// behind _Skip all_ beside a chosen kind: `200` with the whole **Current
// enrichment run**, every id it holds taken off and nothing written, so the
// screen redraws from the echo; an id not held is passed over, not refused;
// `400` with a sentence for an `ids` that is not a non-empty string array
// (read in `enrichmentBody`), the domain never asked; `404` with no run.
// `routes.importDismiss.test.ts`' shape over `routes.enrichmentDecisions`'
// fake TMDB: two films, one `ambiguous` and one `missing`, so the review
// holds two Decisions.

import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { ENRICH_FIELDS, type EnrichmentRun } from '@/types';
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

/**
 * A fake TMDB where two releases share _Harbor Lights_ — an `ambiguous`
 * Decision — and any other query finds nothing — a `missing` one.
 */
function fakeTmdb() {
  return vi.fn<Fetch>((input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/3/search/movie') {
      const results =
        url.searchParams.get('query') === 'Harbor Lights'
          ? [result(101, 1963), result(102, 2019)]
          : [];
      return Promise.resolve(
        json({ page: 1, total_results: results.length, results })
      );
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  });
}

async function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  storage.setTmdbKey(KEY);

  const media = sandboxRoot('familyflix-enrich-dismiss-api-');
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null), () => null);
  const enrichment = createEnrichment({
    storage,
    client: createTmdbClient(fakeTmdb()),
    media: mediaDomain,
  });

  for (const [title, year] of [
    ['Harbor Lights', 1963],
    ['Quiet Orchard', 1990],
  ] as const) {
    const folder = mediaDomain.reserveFolder(title, year);
    const videoPath = await mediaDomain.storeUpload(
      folder,
      'film.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
    storage.addMovie({ title, year, videoPath });
  }

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
  return { storage, baseUrl: `http://127.0.0.1:${port}` };
}

const getCurrent = (baseUrl: string) =>
  fetch(`${baseUrl}/api/enrichment/current`);

const postDismiss = (baseUrl: string, body: unknown): Promise<Response> =>
  fetch(`${baseUrl}/api/enrichment/current/decisions/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function untilReview(baseUrl: string): Promise<EnrichmentRun> {
  return vi.waitFor(
    async () => {
      const response = await getCurrent(baseUrl);
      expect(response.status).toBe(200);
      const run = (await response.json()) as EnrichmentRun;
      expect(run.phase).toBe('review');
      return run;
    },
    { timeout: 10_000 }
  );
}

/** A library Sync over both films, in review with its two Decisions. */
async function inReview() {
  const api = await freshApi();
  const started = await fetch(`${api.baseUrl}/api/enrichment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'all',
      fields: [...ENRICH_FIELDS],
      writeSheet: false,
      writePosters: false,
    }),
  });
  expect(started.status).toBe(201);
  const run = await untilReview(api.baseUrl);
  const kinds = run.decisions.map((decision) => decision.kind).sort();
  if (kinds.join() !== 'ambiguous,missing') {
    throw new Error(`two Decisions wanted: ${JSON.stringify(run)}`);
  }
  return { ...api, run };
}

const ids = (run: EnrichmentRun) => run.decisions.map((each) => each.id);

const idOf = (run: EnrichmentRun, kind: string) =>
  run.decisions.find((each) => each.kind === kind)?.id as string;

describe('POST /api/enrichment/current/decisions/dismiss — 200', () => {
  it('answers the whole snapshot, every id asked taken off and the rest kept', async () => {
    const { baseUrl, run } = await inReview();
    const asked = [idOf(run, 'missing')];

    const response = await postDismiss(baseUrl, { ids: asked });

    expect(response.status).toBe(200);
    const echo = (await response.json()) as EnrichmentRun;
    expect(echo.id).toBe(run.id);
    expect(echo.phase).toBe('review');
    expect(echo.enriched).toBe(run.enriched);
    expect(ids(echo)).toEqual(ids(run).filter((id) => !asked.includes(id)));
  });

  it('takes them off for good, writing nothing: the current run reads the same afterwards', async () => {
    const { baseUrl, run, storage } = await inReview();

    const echo = (await (
      await postDismiss(baseUrl, { ids: ids(run) })
    ).json()) as EnrichmentRun;

    expect(echo.decisions).toEqual([]);
    const after = (await (await getCurrent(baseUrl)).json()) as EnrichmentRun;
    expect(ids(after)).toEqual([]);
    expect(after.enriched).toBe(run.enriched);
    expect(
      storage
        .listMovies({ sort: 'a-z' })
        .every((movie) => movie.tmdbId === null)
    ).toBe(true);
  });

  it('passes over an id it does not hold, taking the rest off', async () => {
    const { baseUrl, run } = await inReview();
    const ambiguous = idOf(run, 'ambiguous');

    const response = await postDismiss(baseUrl, {
      ids: ['no-such-decision', ambiguous],
    });

    expect(response.status).toBe(200);
    const echo = (await response.json()) as EnrichmentRun;
    expect(ids(echo)).toEqual(ids(run).filter((id) => id !== ambiguous));
  });

  it('answers the snapshot unchanged when it holds none of the ids', async () => {
    const { baseUrl, run } = await inReview();

    const response = await postDismiss(baseUrl, { ids: ['gone', 'never'] });

    expect(response.status).toBe(200);
    expect(ids((await response.json()) as EnrichmentRun)).toEqual(ids(run));
  });
});

describe('POST /api/enrichment/current/decisions/dismiss — 400', () => {
  it.each([
    ['no ids at all', {}],
    ['an empty list', { ids: [] }],
    ['a string, not a list', { ids: 'd1' }],
    ['a list holding a number', { ids: [1] }],
  ])('refuses %s in a sentence, taking nothing off', async (_, body) => {
    const { baseUrl, run } = await inReview();

    const response = await postDismiss(baseUrl, body);

    expect(response.status).toBe(400);
    const { error } = (await response.json()) as { error: unknown };
    expect(typeof error).toBe('string');
    expect(error as string).toMatch(/^[A-Z].*\.$/);
    const after = (await (await getCurrent(baseUrl)).json()) as EnrichmentRun;
    expect(ids(after)).toEqual(ids(run));
  });
});

describe('POST /api/enrichment/current/decisions/dismiss — 404', () => {
  it('answers 404 when there is no run, with a reason', async () => {
    const { baseUrl } = await freshApi();

    const response = await postDismiss(baseUrl, { ids: ['d1'] });

    expect(response.status).toBe(404);
    const { error } = (await response.json()) as { error: unknown };
    expect(typeof error).toBe('string');
  });
});
