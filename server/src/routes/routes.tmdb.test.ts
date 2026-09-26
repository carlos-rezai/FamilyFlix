// @vitest-environment node
//
// 23 — Enrichment, Phase 1: "the TMDB key" (issue #203).
//
// The TMDB key's two routes, beside the Settings hub's: a real listener, a
// real `fetch` from the test, real status codes and bodies, over a real
// `:memory:` library. The fifth server domain, `enrichment/`, is injected into
// the router as its sixth argument — `createEnrichment({ storage, client })`
// over a `createTmdbClient` whose own `fetch` is a fake, so nothing here goes
// online and no route learns there is a TMDB.
//
// - `POST /api/tmdb/key { key }` — the test and the save in one: `200 { key }`
//   and stored only when TMDB accepts it; `400` for an empty key; `422` when
//   TMDB refuses it; `503` when TMDB cannot be reached. A refused or
//   unreachable key leaves whatever was stored before exactly as it was.
// - `GET /api/tmdb/key` → `{ key: string | null }`.
// - `GET /api/settings` is **not** widened: the player's `fetchSettings`
//   never carries the key.

import express from 'express';
import { mkdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
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

/** What TMDB's side of the wire does with every request. */
type Tmdb = 'accepts' | 'refuses' | 'unreachable';

/** A fake TMDB behind the client's injected `fetch`. */
function fakeTmdb(tmdb: Tmdb) {
  return vi.fn<Fetch>(() => {
    if (tmdb === 'unreachable') {
      return Promise.reject(new TypeError('fetch failed'));
    }
    const accepted = tmdb === 'accepts';
    return Promise.resolve(
      new Response(
        JSON.stringify(
          accepted
            ? { success: true, status_code: 1 }
            : { success: false, status_code: 7 }
        ),
        {
          status: accepted ? 200 : 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
  });
}

interface Api {
  storage: LibraryStorage;
  baseUrl: string;
  tmdbFetch: ReturnType<typeof fakeTmdb>;
}

/** A fresh library behind a listening API, composed the way `main.ts` is. */
function freshApi(tmdb: Tmdb = 'accepts'): Api {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const media = join(sandboxRoot('familyflix-tmdb-api-'), 'media');
  mkdirSync(media);
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null));
  const tmdbFetch = fakeTmdb(tmdb);
  const enrichment = createEnrichment({
    storage,
    client: createTmdbClient(tmdbFetch),
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
  return { storage, baseUrl: `http://127.0.0.1:${port}`, tmdbFetch };
}

const V3_KEY = '0123456789abcdef0123456789abcdef';

const postKey = (baseUrl: string, body: unknown) =>
  fetch(`${baseUrl}/api/tmdb/key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const readKey = async (baseUrl: string): Promise<unknown> =>
  (await (await fetch(`${baseUrl}/api/tmdb/key`)).json()) as unknown;

describe('GET /api/tmdb/key', () => {
  it('answers { key: null } on a fresh library', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(`${baseUrl}/api/tmdb/key`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ key: null });
  });

  it('answers the stored key', async () => {
    const { baseUrl, storage } = freshApi();
    storage.setTmdbKey(V3_KEY);

    expect(await readKey(baseUrl)).toEqual({ key: V3_KEY });
  });
});

describe('POST /api/tmdb/key — accepted', () => {
  it('answers 200 { key } when TMDB accepts the key', async () => {
    const { baseUrl } = freshApi('accepts');

    const response = await postKey(baseUrl, { key: V3_KEY });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ key: V3_KEY });
  });

  it('asks TMDB with the key it was given', async () => {
    const { baseUrl, tmdbFetch } = freshApi('accepts');

    await postKey(baseUrl, { key: V3_KEY });

    expect(tmdbFetch).toHaveBeenCalled();
    const [input] = tmdbFetch.mock.calls[0];
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.searchParams.get('api_key')).toBe(V3_KEY);
  });

  it('stores the accepted key, so the read answers it', async () => {
    const { baseUrl, storage } = freshApi('accepts');

    await postKey(baseUrl, { key: V3_KEY });

    expect(storage.tmdbKey()).toBe(V3_KEY);
    expect(await readKey(baseUrl)).toEqual({ key: V3_KEY });
  });

  it('replaces a key already stored', async () => {
    const { baseUrl, storage } = freshApi('accepts');
    storage.setTmdbKey('old-key');

    await postKey(baseUrl, { key: V3_KEY });

    expect(await readKey(baseUrl)).toEqual({ key: V3_KEY });
  });
});

describe('POST /api/tmdb/key — empty', () => {
  it.each<[string, unknown]>([
    ['an empty key', { key: '' }],
    ['a blank key', { key: '   ' }],
    ['no key at all', {}],
    ['a key that is not a string', { key: 42 }],
  ])(
    'answers 400 for %s, asking TMDB nothing and storing nothing',
    async (_label, body) => {
      const { baseUrl, storage, tmdbFetch } = freshApi('accepts');

      const response = await postKey(baseUrl, body);

      expect(response.status).toBe(400);
      expect(tmdbFetch).not.toHaveBeenCalled();
      expect(storage.tmdbKey()).toBeNull();
    }
  );
});

describe('POST /api/tmdb/key — refused', () => {
  it('answers 422 when TMDB refuses the key', async () => {
    const { baseUrl } = freshApi('refuses');

    const response = await postKey(baseUrl, { key: V3_KEY });

    expect(response.status).toBe(422);
  });

  it('stores nothing on a fresh library', async () => {
    const { baseUrl } = freshApi('refuses');

    await postKey(baseUrl, { key: V3_KEY });

    expect(await readKey(baseUrl)).toEqual({ key: null });
  });

  it('leaves the key already stored as it was', async () => {
    const { baseUrl, storage } = freshApi('refuses');
    storage.setTmdbKey('kept-key');

    await postKey(baseUrl, { key: V3_KEY });

    expect(await readKey(baseUrl)).toEqual({ key: 'kept-key' });
  });
});

describe('POST /api/tmdb/key — unreachable', () => {
  it('answers 503 when TMDB cannot be reached', async () => {
    const { baseUrl } = freshApi('unreachable');

    const response = await postKey(baseUrl, { key: V3_KEY });

    expect(response.status).toBe(503);
  });

  it('stores nothing, and leaves a key already stored as it was', async () => {
    const { baseUrl, storage } = freshApi('unreachable');
    storage.setTmdbKey('kept-key');

    await postKey(baseUrl, { key: V3_KEY });

    expect(await readKey(baseUrl)).toEqual({ key: 'kept-key' });
  });
});

describe('GET /api/settings — not widened', () => {
  it('does not carry a stored key', async () => {
    const { baseUrl } = freshApi('accepts');
    await postKey(baseUrl, { key: V3_KEY });

    const response = await fetch(`${baseUrl}/api/settings`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(Object.keys(body)).toEqual(['subtitleLanguage']);
    expect(JSON.stringify(body)).not.toContain(V3_KEY);
  });
});
