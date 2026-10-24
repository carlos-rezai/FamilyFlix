// @vitest-environment node
//
// 48 — Add a show folder, Phase 1 (issue #417): `GET /api/show-folder`.
//
// The series add's **Show folder pick** asks the server to read the folder
// the dialog answered. The route is thin over the importer's `readShowFolder`
// member — no route learns there is a walk — and answers `200` with the
// **Show folder read**, or `400` with one sentence per refusal: _That folder
// can’t be read._ for `unreadable`, _There are no videos in that folder._ for
// `empty`.
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

interface ReadBody {
  path: string;
  titleGuess: string;
  episodes: {
    season: number;
    number: number;
    title: string | null;
    video: string;
    subtitles: { path: string; language: string }[];
  }[];
}

describe('GET /api/show-folder', () => {
  it('answers 200 with the Show folder read', async () => {
    const { baseUrl, shows } = freshApi();
    const show = join(shows, 'Harbor.and.Vine.2019');
    const seasonOne = folderWith(show, 'Season 1', [
      'Harbor.and.Vine.S01E01.Pilot.mkv',
      'Harbor.and.Vine.S01E01.Pilot.pt.srt',
    ]);
    const seasonTwo = folderWith(show, 'Season 2', [
      'Harbor.and.Vine.S01E07.Spring.Tide.mkv',
    ]);

    const response = await readFolder(baseUrl, show);

    expect(response.status).toBe(200);
    const read = (await response.json()) as ReadBody;
    expect(read.path).toBe(show);
    expect(read.titleGuess).toBe('Harbor and Vine');
    expect(read.episodes).toEqual([
      {
        season: 1,
        number: 1,
        title: 'Pilot',
        video: join(seasonOne, 'Harbor.and.Vine.S01E01.Pilot.mkv'),
        relativePath: 'Season 1/Harbor.and.Vine.S01E01.Pilot.mkv',
        subtitles: [
          {
            path: join(seasonOne, 'Harbor.and.Vine.S01E01.Pilot.pt.srt'),
            language: 'Portuguese',
          },
        ],
      },
      {
        season: 2,
        number: 7,
        title: 'Spring Tide',
        video: join(seasonTwo, 'Harbor.and.Vine.S01E07.Spring.Tide.mkv'),
        relativePath: 'Season 2/Harbor.and.Vine.S01E07.Spring.Tide.mkv',
        subtitles: [],
      },
    ]);
  });

  it('answers the listed Library folder a show lies inside', async () => {
    const { baseUrl, shows, storage } = freshApi();
    const listed = storage.addLibraryFolder(shows);
    const show = join(shows, 'Harbor and Vine');
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);

    const response = await readFolder(baseUrl, show);

    expect(response.status).toBe(200);
    expect(
      ((await response.json()) as { libraryFolderId: string | null })
        .libraryFolderId
    ).toBe(listed.id);
  });

  it('answers 400 “That folder can’t be read.” for a folder that is not there', async () => {
    const { baseUrl, shows } = freshApi();

    const response = await readFolder(baseUrl, join(shows, 'Gone'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'That folder can’t be read.',
    });
  });

  it('answers 400 “There are no videos in that folder.” for a folder holding none', async () => {
    const { baseUrl, shows } = freshApi();
    const show = folderWith(shows, 'Harbor and Vine', ['poster.jpg']);

    const response = await readFolder(baseUrl, show);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'There are no videos in that folder.',
    });
  });
});
