// @vitest-environment node
//
// Log 58, Phase 9: "the Layout fill after a save" (issue #542).
//
// After an add and an edit, the **Layout fill** writes into the title's
// **Title folder** every file FamilyFlix holds whose slot is empty, for a
// title with a **Source folder** in a reachable **Library folder**. The
// demo: adding a poster to a scanned film with an empty `Images/` writes
// `Images/poster.jpg`. A title with no Source folder gets none, and a folder
// the fill can't write never fails the save.
//
// Over a real listener composed the way `main.ts` does, a real `:memory:`
// library, a sandboxed media root and a sandboxed Library folder.

import express from 'express';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
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
import type { Movie } from '@/types';

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

const HEAT_VIDEO = 'Heat (1995)/Heat.1995.mp4';
const POSTER_BYTES = 'a poster the maintainer picked';

function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-layout-fill-route-');
  const media = join(root, 'media');
  const library = join(root, 'Library');
  mkdirSync(media);
  mkdirSync(join(library, 'Heat (1995)'), { recursive: true });
  copyFileSync(FIXTURE_VIDEO, join(library, ...HEAT_VIDEO.split('/')));
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
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    library,
    folderId,
    titleFolder: join(library, 'Heat (1995)'),
  };
}

type Part = [name: string, value: string | File];

const posterPart = (): File =>
  new File([POSTER_BYTES], 'cover.jpg', { type: 'image/jpeg' });

function send(
  url: string,
  method: 'POST' | 'PATCH',
  parts: Part[]
): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(url, { method, body });
}

const HEAT_FIELDS: Part[] = [
  ['title', 'Heat'],
  ['year', '1995'],
  ['director', ''],
  ['description', ''],
  ['rating', ''],
];

/** A scanned film: linked in its Title folder, its Source folder on record. */
function addScannedHeat(
  storage: LibraryStorage,
  folderId: string,
  sourceFolder: boolean
): Movie {
  const movie = storage.addMovie({
    title: 'Heat',
    year: 1995,
    videoPath: HEAT_VIDEO,
    videoFolderId: folderId,
    mediaFolder: 'heat-1995',
  });
  if (sourceFolder) {
    storage.setSourceFolder(movie.id, folderId, 'Heat (1995)');
  }
  return movie;
}

const namesIn = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).sort() : [];

describe('PATCH /api/movies/:id: the Layout fill after an edit', () => {
  it('writes Images/poster.jpg when a poster is added to a scanned film', async () => {
    const { storage, baseUrl, folderId, titleFolder } = freshApi();
    const movie = addScannedHeat(storage, folderId, true);
    mkdirSync(join(titleFolder, 'Images'));

    const response = await send(`${baseUrl}/api/movies/${movie.id}`, 'PATCH', [
      ...HEAT_FIELDS,
      ['videoPath', movie.videoPath],
      ['poster', posterPart()],
    ]);

    expect(response.status).toBe(200);
    expect(namesIn(join(titleFolder, 'Images'))).toEqual(['poster.jpg']);
    expect(
      readFileSync(join(titleFolder, 'Images', 'poster.jpg'), 'utf8')
    ).toBe(POSTER_BYTES);
  });
});

describe('POST /api/movies: the Layout fill after an add', () => {
  it('writes the picked poster into the Title folder of a film linked in the layout', async () => {
    const { baseUrl, titleFolder } = freshApi();

    const response = await send(`${baseUrl}/api/movies`, 'POST', [
      ['mode', 'link'],
      ...HEAT_FIELDS,
      ['videoPath', join(titleFolder, 'Heat.1995.mp4')],
      ['poster', posterPart()],
    ]);

    expect(response.status).toBe(201);
    expect(namesIn(join(titleFolder, 'Images'))).toEqual(['poster.jpg']);
    expect(
      readFileSync(join(titleFolder, 'Images', 'poster.jpg'), 'utf8')
    ).toBe(POSTER_BYTES);
  });
});
