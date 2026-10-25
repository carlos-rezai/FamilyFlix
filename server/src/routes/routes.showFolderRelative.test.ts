// @vitest-environment node
//
// 51, Library audit, Phase 13 (issue #456): `GET /api/show-folder` answers
// each found video with its path inside the picked **Show folder**, forward
// slashes, so the form can draw two seasons' same-named files apart.
//
// Over a real listener, a real `fetch`, a real `:memory:` library and a show
// tree built under `sandboxRoot`, `routes.showFolder.test.ts`'s prior art.

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

/** A fresh library behind a listening API, and a sandbox to build shows in. */
function freshApi(): {
  baseUrl: string;
  shows: string;
  storage: LibraryStorage;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-show-folder-route-');
  const media = join(root, 'media');
  mkdirSync(media);
  const shows = join(root, 'shows');
  mkdirSync(shows);
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
  return { baseUrl: `http://127.0.0.1:${port}`, shows, storage };
}

/** A folder under `root`, holding the files named. */
function folderWith(root: string, path: string, files: string[]): string {
  const dir = join(root, path);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(dir, file), `${file} bytes`);
  }
  return dir;
}

const readFolder = (baseUrl: string, path: string): Promise<Response> =>
  fetch(`${baseUrl}/api/show-folder?path=${encodeURIComponent(path)}`);

describe('GET /api/show-folder: paths inside the show', () => {
  it('answers each episode with its path relative to the Show folder', async () => {
    const { baseUrl, shows } = freshApi();
    const show = join(shows, 'De Luizenmoeder');
    folderWith(show, 'Seizoen 1', ['Aflevering 1.mp4']);
    folderWith(show, 'Seizoen 2', ['Aflevering 1.mp4']);

    const response = await readFolder(baseUrl, show);

    expect(response.status).toBe(200);
    const read = (await response.json()) as {
      episodes: { relativePath: string }[];
      unplaced: { relativePath: string }[];
    };
    expect(read.episodes.map((episode) => episode.relativePath)).toEqual([
      'Seizoen 1/Aflevering 1.mp4',
      'Seizoen 2/Aflevering 1.mp4',
    ]);
    expect(read.unplaced).toEqual([]);
  });
});
