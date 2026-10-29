// @vitest-environment node
//
// 23 — Enrichment, Phase 3: "setup's readiness" (issue #206).
//
// `GET /api/enrichment` → `200 EnrichmentSummary`, through a real listener
// over a real `:memory:` library. The `enrichment/` domain is injected as the
// router's sixth argument over a `createTmdbClient` whose own `fetch` is a
// fake TMDB, so nothing here goes online: offline means the server's own
// reachability probe went unanswered.

import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import type { EnrichmentSummary } from '@/types';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createTmdbClient } from '../enrichment/tmdbClient/tmdbClient';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { newMovie } from '../test-support/newMovie/newMovie';
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

/** A TMDB that answers everything with an empty 200. */
const answeringTmdb = () =>
  vi.fn<Fetch>(() =>
    Promise.resolve(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  );

/** No TMDB at all: a network with nothing behind it. */
const unreachableTmdb = () =>
  vi.fn<Fetch>(() => Promise.reject(new TypeError('fetch failed')));

async function freshApi(tmdbFetch: Fetch = answeringTmdb()) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const media = sandboxRoot('familyflix-enrich-summary-api-');
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null), () => null);
  const enrichment = createEnrichment({
    storage,
    client: createTmdbClient(tmdbFetch),
    media: mediaDomain,
    playback,
  });

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

async function readSummary(baseUrl: string): Promise<EnrichmentSummary> {
  const response = await fetch(`${baseUrl}/api/enrichment`);
  expect(response.status).toBe(200);
  return (await response.json()) as EnrichmentSummary;
}

describe('GET /api/enrichment — the summary', () => {
  it('answers an empty library with zeros, not an error', async () => {
    const { baseUrl } = await freshApi();

    expect(await readSummary(baseUrl)).toEqual({
      total: 0,
      complete: 0,
      gaps: 0,
      lastSyncedAt: null,
      keySet: false,
      online: true,
      libraryFolders: [],
    });
  });

  it('counts movies and series, and those with Full details', async () => {
    const { storage, baseUrl } = await freshApi();
    storage.addMovie(
      newMovie({
        title: 'Complete',
        synopsis: 'Has everything.',
        posterPath: 'complete/poster.jpg',
      })
    );
    storage.addMovie(newMovie({ title: 'Bare' }));
    storage.addSeries({ title: 'Bare Show' });

    expect(await readSummary(baseUrl)).toMatchObject({
      total: 3,
      complete: 1,
    });
  });

  it('says a key is set, and when a Sync last reached review', async () => {
    const { storage, baseUrl } = await freshApi();
    storage.setTmdbKey(KEY);
    storage.setEnrichmentLastSyncedAt('2026-09-26T09:30:00.000Z');

    expect(await readSummary(baseUrl)).toMatchObject({
      keySet: true,
      lastSyncedAt: '2026-09-26T09:30:00.000Z',
    });
  });

  it('is offline when the server’s probe of TMDB goes unanswered', async () => {
    const { baseUrl } = await freshApi(unreachableTmdb());

    expect((await readSummary(baseUrl)).online).toBe(false);
  });
});

// 54, Scan new folders, Phase 5 (issue #496): `?since=<ISO>` asks for the
// added window too, the count _Just what was added_ shows: three films a run
// brought in, not the film held from before it.
describe('GET /api/enrichment?since=: the added window', () => {
  const SINCE = '2026-10-01T12:00:00.000Z';

  /** Run `add` with the clock at `iso`, so the rows it writes carry it. */
  function at(iso: string, add: () => void) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
    try {
      add();
    } finally {
      vi.useRealTimers();
    }
  }

  it('counts the three films a run brought in as added', async () => {
    const { storage, baseUrl } = await freshApi();
    at('2026-09-30T08:00:00.000Z', () =>
      storage.addMovie(newMovie({ title: 'Held Before' }))
    );
    at('2026-10-01T12:05:00.000Z', () => {
      storage.addMovie(newMovie({ title: 'First' }));
      storage.addMovie(newMovie({ title: 'Second' }));
      storage.addMovie(newMovie({ title: 'Third' }));
    });

    const response = await fetch(
      `${baseUrl}/api/enrichment?since=${encodeURIComponent(SINCE)}`
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 4, added: 3 });
    expect(await readSummary(baseUrl)).not.toHaveProperty('added');
  });
});
