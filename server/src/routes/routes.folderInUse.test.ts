// @vitest-environment node
//
// 41 — Link or copy, Phase 7: "a folder in use can't be removed" (issue #347).
//
// `DELETE /api/library-folders/:id` answers `409 { error }` while any **Linked
// video** plays from the folder: _N titles play from this folder. Delete them
// before removing it._, singular at one. The count is films plus series with
// a linked episode there — a series is one title however many of its
// episodes the folder holds. A folder whose titles were all copied is removed
// with `204` as before, and its titles are kept.
//
// Over a real listener and a real `:memory:` library, the linked rows written
// through `NewMovie.videoFolderId` / `NewEpisode.videoFolderId` —
// `routes.unreachableFolder`'s harness.

import express from 'express';
import { mkdirSync } from 'node:fs';
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
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { LibraryFolder } from '@/types';

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

interface Api {
  baseUrl: string;
  storage: LibraryStorage;
  /** The one listed Library folder, `Movies/`. */
  folderId: string;
}

/** A fresh library behind a listening API, one Library folder listed. */
function freshApi(): Api {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-folder-in-use-api-');
  const media = join(root, 'media');
  const library = join(root, 'Movies');
  mkdirSync(media);
  mkdirSync(library);
  const folderId = storage.addLibraryFolder(library).id;

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
  return { baseUrl: `http://127.0.0.1:${port}`, storage, folderId };
}

/** A film whose video plays from the folder. */
function linkedFilm(api: Api, title: string, year: number): string {
  return api.storage.addMovie({
    title,
    year,
    videoPath: `${title} (${year})/${title}.mp4`,
    videoFolderId: api.folderId,
    mediaFolder: `${title.toLowerCase()}-${year}`,
  }).id;
}

/** A series with `count` episodes of season 1 playing from the folder. */
function linkedSeries(api: Api, title: string, count: number): string {
  return api.storage.addSeries(
    { title, year: 2019, mediaFolder: `${title.toLowerCase()}-2019` },
    Array.from({ length: count }, (_, index) => ({
      season: 1,
      number: index + 1,
      title: `Episode ${index + 1}`,
      videoPath: `${title}/Season 01/S01E0${index + 1}.mp4`,
      videoFolderId: api.folderId,
    }))
  ).id;
}

const remove = (api: Api) =>
  fetch(
    `${api.baseUrl}/api/library-folders/${encodeURIComponent(api.folderId)}`,
    { method: 'DELETE' }
  );

const listedIds = async (api: Api): Promise<string[]> => {
  const response = await fetch(`${api.baseUrl}/api/library-folders`);
  return ((await response.json()) as LibraryFolder[]).map((f) => f.id);
};

const refusal = async (response: Response): Promise<string> =>
  ((await response.json()) as { error: string }).error;

describe('DELETE /api/library-folders/:id — a folder linked videos play from', () => {
  it('answers 409 with the plural sentence, and keeps the folder listed', async () => {
    const api = freshApi();
    linkedFilm(api, 'Heat', 1995);
    linkedFilm(api, 'Ronin', 1998);
    linkedFilm(api, 'Collateral', 2004);

    const response = await remove(api);

    expect(response.status).toBe(409);
    expect(await refusal(response)).toBe(
      '3 titles play from this folder. Delete them before removing it.'
    );
    expect(await listedIds(api)).toEqual([api.folderId]);
  });

  it('answers 409 with the singular sentence at one title', async () => {
    const api = freshApi();
    linkedFilm(api, 'Heat', 1995);

    const response = await remove(api);

    expect(response.status).toBe(409);
    expect(await refusal(response)).toBe(
      '1 title plays from this folder. Delete it before removing it.'
    );
  });

  it('counts a series with several linked episodes there as one title', async () => {
    const api = freshApi();
    linkedSeries(api, 'Harbor', 3);

    const response = await remove(api);

    expect(response.status).toBe(409);
    expect(await refusal(response)).toBe(
      '1 title plays from this folder. Delete it before removing it.'
    );
  });

  it('counts films plus series', async () => {
    const api = freshApi();
    linkedFilm(api, 'Heat', 1995);
    linkedSeries(api, 'Harbor', 4);

    const response = await remove(api);

    expect(response.status).toBe(409);
    expect(await refusal(response)).toBe(
      '2 titles play from this folder. Delete them before removing it.'
    );
  });
});

describe('DELETE /api/library-folders/:id — a folder whose titles were all copied', () => {
  it('answers 204, takes the folder off the list and keeps its titles', async () => {
    const api = freshApi();
    const film = api.storage.addMovie({
      title: 'Heat',
      year: 1995,
      videoPath: 'heat-1995/Heat.1995.mp4',
      mediaFolder: 'heat-1995',
    });
    api.storage.setSourceFolder(film.id, api.folderId, 'Heat (1995)');

    const response = await remove(api);

    expect(response.status).toBe(204);
    expect(await listedIds(api)).toEqual([]);
    const kept = await fetch(`${api.baseUrl}/api/movies/${film.id}`);
    expect(kept.status).toBe(200);
  });
});
