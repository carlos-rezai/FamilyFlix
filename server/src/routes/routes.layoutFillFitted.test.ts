// @vitest-environment node
//
// 72 — Seamless art, Phase 2: "every image write" (issue #687).
//
// The movie form's poster goes through `storeUpload`, which now fits an image
// over its **Art box**, so the **Layout fill** that follows an add or an edit
// copies out the fitted picture the app shows, not the scan it was handed;
// and, as ever, only into a **Title folder** whose slot is empty. The demo:
// adding a movie through the form with a 4000-wide poster stores it at 780
// wide, and that is the poster that lands in `Images/`.
//
// Over a real listener composed the way `main.ts` does, a real `:memory:`
// library, a sandboxed media root and a sandboxed Library folder, with a
// scripted `fitArt` that answers fixed bytes.

import express from 'express';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { mediaFilePath } from '../playback/mediaFilePath/mediaFilePath';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { FIXTURE_VIDEO } from '../test-support/fixtureVideo/fixtureVideo';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleFrameFill } from '../test-support/idleFrameFill/idleFrameFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { jpegBytes } from '../test-support/pictureBytes/pictureBytes';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../test-support/unfittedArt/unfittedArt';
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
const FITTED = Buffer.from('the poster at 780 wide');
const SCAN = jpegBytes(4000, 6000);

function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-layout-fill-fitted-');
  const media = join(root, 'media');
  const library = join(root, 'Library');
  mkdirSync(media);
  mkdirSync(join(library, 'Heat (1995)'), { recursive: true });
  copyFileSync(FIXTURE_VIDEO, join(library, ...HEAT_VIDEO.split('/')));
  const folderId = storage.addLibraryFolder(library).id;

  const mediaDomain = createMedia(
    media,
    unfittedArt(async () => ({ kind: 'fitted', picture: FITTED }))
  );
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) => storage.libraryFolders().find((f) => f.id === id)?.path ?? null
  );
  const layoutFill = createLayoutFill({ storage, media: mediaDomain });

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({
        storage,
        media: mediaDomain,
        playback,
        librarySheet: idleLibrarySheet(),
        layoutFill: idleLayoutFill(),
      }),
      createEnrichment({
        storage,
        client: offlineTmdb(),
        media: mediaDomain,
        playback,
        layoutFill,
      }),
      layoutFill,
      idleFrameFill()
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return {
    storage,
    media,
    baseUrl: `http://127.0.0.1:${port}`,
    folderId,
    titleFolder: join(library, 'Heat (1995)'),
  };
}

type Part = [name: string, value: string | File];

const scanPart = (): File =>
  new File([new Uint8Array(SCAN)], 'cover.jpg', { type: 'image/jpeg' });

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
function addScannedHeat(storage: LibraryStorage, folderId: string): Movie {
  const movie = storage.addMovie({
    title: 'Heat',
    year: 1995,
    videoPath: HEAT_VIDEO,
    videoFolderId: folderId,
    mediaFolder: 'heat-1995',
  });
  storage.setSourceFolder(movie.id, folderId, 'Heat (1995)');
  return movie;
}

/** The bytes of the poster the app shows: its Stored path, resolved. */
function heldPoster(media: string, movie: Movie): Buffer {
  const file = mediaFilePath(media, movie.posterPath ?? '');
  expect(file).not.toBeNull();
  return readFileSync(file as string);
}

describe('POST /api/movies: a 4000-wide poster', () => {
  it('is held fitted, and the Layout fill writes that fitted poster', async () => {
    const { baseUrl, media, titleFolder } = freshApi();

    const response = await send(`${baseUrl}/api/movies`, 'POST', [
      ['mode', 'link'],
      ...HEAT_FIELDS,
      ['videoPath', join(titleFolder, 'Heat.1995.mp4')],
      ['poster', scanPart()],
    ]);
    const movie = (await response.json()) as Movie;

    expect(response.status).toBe(201);
    expect(heldPoster(media, movie)).toEqual(FITTED);
    expect(readFileSync(join(titleFolder, 'Images', 'poster.jpg'))).toEqual(
      FITTED
    );
  });
});

describe('PATCH /api/movies/:id: a 4000-wide poster', () => {
  it('fills an Images/ that lacks a poster with the fitted one', async () => {
    const { storage, baseUrl, media, folderId, titleFolder } = freshApi();
    const scanned = addScannedHeat(storage, folderId);
    mkdirSync(join(titleFolder, 'Images'));

    const response = await send(
      `${baseUrl}/api/movies/${scanned.id}`,
      'PATCH',
      [...HEAT_FIELDS, ['videoPath', scanned.videoPath], ['poster', scanPart()]]
    );
    const movie = (await response.json()) as Movie;

    expect(response.status).toBe(200);
    expect(heldPoster(media, movie)).toEqual(FITTED);
    expect(readFileSync(join(titleFolder, 'Images', 'poster.jpg'))).toEqual(
      FITTED
    );
  });

  it('leaves a poster the Title folder already has as it was', async () => {
    const { storage, baseUrl, media, folderId, titleFolder } = freshApi();
    const scanned = addScannedHeat(storage, folderId);
    mkdirSync(join(titleFolder, 'Images'));
    writeFileSync(join(titleFolder, 'Images', 'poster.jpg'), SCAN);

    const response = await send(
      `${baseUrl}/api/movies/${scanned.id}`,
      'PATCH',
      [...HEAT_FIELDS, ['videoPath', scanned.videoPath], ['poster', scanPart()]]
    );
    const movie = (await response.json()) as Movie;

    expect(response.status).toBe(200);
    expect(heldPoster(media, movie)).toEqual(FITTED);
    expect(readdirSync(join(titleFolder, 'Images'))).toEqual(['poster.jpg']);
    expect(readFileSync(join(titleFolder, 'Images', 'poster.jpg'))).toEqual(
      SCAN
    );
  });
});
