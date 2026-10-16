// @vitest-environment node
//
// 41 — Link or copy, Phase 6: "an unreachable folder" (issue #346).
//
// A **Linked video** whose **Library folder** can't be reached says so rather
// than reading as a missing file: the playback read and the stream answer
// `503 { error }`, for a film and an episode, and the body names no path —
// what is or is not on this disk is not something the API reports back. `404`
// still means the file is gone from a folder that is there. And reach is read
// per request, so a folder plugged back in plays again with nothing cached.
//
// Over a real listener, a real `:memory:` library, a sandboxed media root and a
// sandboxed Library folder, the Playback's folder reader composed over
// `storage` the way `main.ts` composes it — `routes.linkedVideo`'s harness.

import express from 'express';
import { copyFileSync, mkdirSync, renameSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { FIXTURE_VIDEO } from '../test-support/fixtureVideo/fixtureVideo';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
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

const LINKED_FILM = 'Heat (1995)/Heat.1995.mp4';
const LINKED_EPISODE = 'Harbor and Vine/Season 01/S01E01.mp4';

/**
 * A fresh library behind a listening API, a managed media root and one listed
 * Library folder, `Movies/`, holding a linked film and a linked episode.
 */
function freshApi(): {
  baseUrl: string;
  library: string;
  filmId: string;
  episodeId: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-unreachable-api-');
  const media = join(root, 'media');
  const library = join(root, 'Movies');
  mkdirSync(media);
  mkdirSync(library);
  const folderId = storage.addLibraryFolder(library).id;

  const film = storage.addMovie({
    title: 'Heat',
    year: 1995,
    videoPath: LINKED_FILM,
    videoFolderId: folderId,
    mediaFolder: 'heat-1995',
  });
  const series = storage.addSeries(
    {
      title: 'Harbor and Vine',
      year: 2019,
      mediaFolder: 'harbor-and-vine-2019',
    },
    [
      {
        season: 1,
        number: 1,
        title: 'Pilot',
        videoPath: LINKED_EPISODE,
        videoFolderId: folderId,
      },
    ]
  );
  const [episode] = storage.listEpisodes(series.id);

  const mediaDomain = createMedia(media);
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) => storage.libraryFolders().find((f) => f.id === id)?.path ?? null
  );

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
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    library,
    filmId: film.id,
    episodeId: episode?.id ?? '',
  };
}

/** Put the ten-second fixture film at a path under a root. */
function placeFixture(root: string, relative: string): void {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  copyFileSync(FIXTURE_VIDEO, file);
}

/** The two byte routes of one playable. */
function byteRoutes(kind: 'movies' | 'episodes', id: string): string[] {
  return [`/api/${kind}/${id}/playback`, `/api/${kind}/${id}/stream`];
}

/** Take the Library folder away, as a drive unplugged would. */
function unplug(library: string): () => void {
  const away = `${library}-unplugged`;
  renameSync(library, away);
  return () => renameSync(away, library);
}

describe('a linked video whose Library folder is out of reach', () => {
  for (const kind of ['movies', 'episodes'] as const) {
    it(`answers 503 with an error and no path, for the ${kind} playback read and stream`, async () => {
      const api = freshApi();
      placeFixture(api.library, LINKED_FILM);
      placeFixture(api.library, LINKED_EPISODE);
      unplug(api.library);
      const id = kind === 'movies' ? api.filmId : api.episodeId;

      for (const route of byteRoutes(kind, id)) {
        const response = await fetch(`${api.baseUrl}${route}`);
        expect(response.status, route).toBe(503);
        const body = (await response.json()) as { error?: unknown };
        expect(typeof body.error, route).toBe('string');
        const text = JSON.stringify(body);
        expect(text).not.toContain('Movies');
        expect(text).not.toContain('Heat.1995');
        expect(text).not.toContain('S01E01');
        expect(text).not.toContain('unplugged');
      }
    });
  }
});

describe('a linked video missing from a folder that is there', () => {
  for (const kind of ['movies', 'episodes'] as const) {
    it(`still answers 404 for the ${kind} playback read and stream`, async () => {
      // The folder reads, the file is not in it: the film is gone, not away.
      const api = freshApi();
      const id = kind === 'movies' ? api.filmId : api.episodeId;

      for (const route of byteRoutes(kind, id)) {
        const response = await fetch(`${api.baseUrl}${route}`);
        expect(response.status, route).toBe(404);
      }
    });
  }
});

describe('a Library folder that comes back', () => {
  for (const kind of ['movies', 'episodes'] as const) {
    it(`plays the ${kind} video again, with nothing cached`, async () => {
      const api = freshApi();
      placeFixture(api.library, LINKED_FILM);
      placeFixture(api.library, LINKED_EPISODE);
      const id = kind === 'movies' ? api.filmId : api.episodeId;
      const [read, stream] = byteRoutes(kind, id);

      const plugBack = unplug(api.library);
      expect((await fetch(`${api.baseUrl}${read}`)).status).toBe(503);

      plugBack();
      const answered = await fetch(`${api.baseUrl}${read}`);
      expect(answered.status).toBe(200);
      expect(((await answered.json()) as { path: string }).path).toBe('direct');
      const streamed = await fetch(`${api.baseUrl}${stream}`);
      expect(streamed.status).toBe(200);
      await streamed.arrayBuffer();
    });
  }
});
