// @vitest-environment node
//
// 48 — Add a show folder, Phase 4 (issue #420): `GET /api/show-folder` on a
// held folder.
//
// A folder that is already a held series's **Show folder** — its Library
// folder's path joined to the series's recorded Source folder — is no
// refusal on the wire: the route answers `200` with the **Show folder read**
// and `heldSeriesId` set to that series's id, and the form draws the
// refusal. Any other folder answers `heldSeriesId: null`.
//
// Over a real listener, a real `fetch`, a real `:memory:` library and a show
// tree built under `sandboxRoot`.

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

  const root = sandboxRoot('familyflix-show-folder-held-');
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

interface ReadBody {
  path: string;
  heldSeriesId: string | null;
  episodes: unknown[];
}

describe('GET /api/show-folder — a held Show folder', () => {
  it('answers 200 with the held series’s id', async () => {
    const { baseUrl, shows, storage } = freshApi();
    const show = join(shows, 'Harbor and Vine');
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);
    const listed = storage.addLibraryFolder(shows);
    const series = storage.addSeries({ title: 'Harbor and Vine' });
    storage.setSourceFolder(series.id, listed.id, 'Harbor and Vine');

    const response = await readFolder(baseUrl, show);

    expect(response.status).toBe(200);
    const read = (await response.json()) as ReadBody;
    expect(read.heldSeriesId).toBe(series.id);
    expect(read.path).toBe(show);
    expect(read.episodes).toHaveLength(1);
  });

  it('answers null for a folder no held series came from', async () => {
    const { baseUrl, shows, storage } = freshApi();
    const show = join(shows, 'Harbor and Vine');
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);
    folderWith(shows, 'Lighthouse Keepers', [
      'Lighthouse.Keepers.S01E01.Arrival.mkv',
    ]);
    const listed = storage.addLibraryFolder(shows);
    const series = storage.addSeries({ title: 'Lighthouse Keepers' });
    storage.setSourceFolder(series.id, listed.id, 'Lighthouse Keepers');

    const response = await readFolder(baseUrl, show);

    expect(response.status).toBe(200);
    const read = (await response.json()) as ReadBody;
    expect(read.heldSeriesId).toBeNull();
  });
});

// 51 — Library audit, Phase 7 (issue #450): a Show folder is held as well
// when any one of its videos is a held episode's, by the **Held video** rule,
// whatever folder is on record: a renamed show's folder reads as its series.
describe('GET /api/show-folder — a Show folder with a held episode', () => {
  it('answers the series one of its videos plays for, with no folder on record', async () => {
    const { baseUrl, shows, storage } = freshApi();
    const show = join(shows, 'Harbour and Vine');
    folderWith(show, 'Season 1', [
      'Harbor.and.Vine.S01E01.Pilot.mkv',
      'Harbor.and.Vine.S01E02.Low.Tide.mkv',
    ]);
    const listed = storage.addLibraryFolder(shows);
    const series = storage.addSeries({ title: 'Harbor and Vine' }, [
      {
        season: 1,
        number: 1,
        videoPath: 'Harbour and Vine/Season 1/Harbor.and.Vine.S01E01.Pilot.mkv',
        videoFolderId: listed.id,
      },
    ]);

    const response = await readFolder(baseUrl, show);

    expect(response.status).toBe(200);
    const read = (await response.json()) as ReadBody;
    expect(read.heldSeriesId).toBe(series.id);
    expect(read.episodes).toHaveLength(2);
  });
});
