// @vitest-environment node
//
// 57 — Tidy into folders, Phase 6: "the Folder row reads the plan" (issue #529).
//
// - `GET /api/library-folders` carries `loose` on each folder: the count of
//   its **Tidy plan**'s tidied videos, 0 for an **Unreachable** folder;
// - `GET /api/library-folders/:id/loose` answers the folder's `TidyPlan`.
//
// End to end over the real router: a real library, a real `Media` over a
// sandbox managed directory, and Library folders laid out on disk.

import express from 'express';
import { mkdirSync, writeFileSync } from 'node:fs';
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
import type { TidyPlan } from '@/types';

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

/** A file at a path under a root, its directories made; `a/` an empty folder. */
function place(root: string, relative: string): void {
  const path = join(root, relative);
  if (relative.endsWith('/')) {
    mkdirSync(path, { recursive: true });
    return;
  }
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, 'bytes');
}

/** One folder as the list answers it, `loose` included. */
interface ListedFolder {
  id: string;
  path: string;
  reachable: boolean;
  loose: number;
}

/**
 * A fresh library behind the router: `Movies` holding two loose films (one
 * with its subtitle) and a clash, `Kids` holding nothing loose, and `Gone`,
 * listed but nowhere on disk.
 */
async function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-loose-folder-');
  const media = join(root, 'media');
  const movies = join(root, 'Movies');
  const kids = join(root, 'Kids');
  mkdirSync(media);
  mkdirSync(movies);
  mkdirSync(kids);
  place(movies, 'Apex.2026.1080p.mp4');
  place(movies, 'Apex.2026.1080p.en.srt');
  place(movies, 'Harbor.Lights.2019.mp4');
  place(movies, 'Northwind (2019).mp4');
  place(movies, 'Northwind (2019)/');
  place(kids, 'Coco (2017)/Coco.mp4');

  const ids = {
    movies: storage.addLibraryFolder(movies).id,
    kids: storage.addLibraryFolder(kids).id,
    gone: storage.addLibraryFolder(join(root, 'Gone')).id,
  };

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
  const baseUrl = `http://127.0.0.1:${port}`;

  return { baseUrl, movies, ids };
}

type Api = Awaited<ReturnType<typeof freshApi>>;

async function folders(api: Api): Promise<ListedFolder[]> {
  const response = await fetch(`${api.baseUrl}/api/library-folders`);
  expect(response.status).toBe(200);
  return (await response.json()) as ListedFolder[];
}

describe('the Library folders list carries each folder’s loose count', () => {
  it('counts the tidied videos of a folder’s Tidy plan, not its clashes', async () => {
    const api = await freshApi();

    const listed = await folders(api);

    expect(listed.find((f) => f.id === api.ids.movies)?.loose).toBe(2);
  });

  it('answers 0 for a folder with nothing loose', async () => {
    const api = await freshApi();

    const listed = await folders(api);

    expect(listed.find((f) => f.id === api.ids.kids)?.loose).toBe(0);
  });

  it('answers 0 for an Unreachable folder', async () => {
    const api = await freshApi();

    const gone = (await folders(api)).find((f) => f.id === api.ids.gone);

    expect(gone?.reachable).toBe(false);
    expect(gone?.loose).toBe(0);
  });
});

describe('GET /api/library-folders/:id/loose', () => {
  it('answers the folder’s Tidy plan', async () => {
    const api = await freshApi();

    const response = await fetch(
      `${api.baseUrl}/api/library-folders/${encodeURIComponent(api.ids.movies)}/loose`
    );

    expect(response.status).toBe(200);
    const plan = (await response.json()) as TidyPlan;
    expect(plan.path).toBe(api.movies);
    expect([...plan.tidies].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      {
        id: 'apex.2026.1080p.mp4',
        kind: 'film',
        folder: 'Apex (2026)',
        videos: ['Apex.2026.1080p.mp4'],
        companions: ['Apex.2026.1080p.en.srt'],
      },
      {
        id: 'harbor.lights.2019.mp4',
        kind: 'film',
        folder: 'Harbor Lights (2019)',
        videos: ['Harbor.Lights.2019.mp4'],
        companions: [],
      },
    ]);
    expect(plan.kept).toEqual([
      {
        files: ['Northwind (2019).mp4'],
        reason: 'A folder called “Northwind (2019)” is already here.',
        folder: 'Northwind (2019)',
      },
    ]);
  });
});
