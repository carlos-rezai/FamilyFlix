// @vitest-environment node
//
// 76, Whole add, Phase 4 (issue #719): `GET /api/film-folder`.
//
// The movie add's **Film folder read**: the route is thin over the importer's
// `readFilmFolder` member and answers `FilmFolderRead`
// (`{ poster, backdrop, subtitles: { path, language }[] }`) for the picked
// video's folder. A `video` that is not absolute or not a video is a `400` by
// `foundPathRefusal`.
//
// Over a real listener, a real `fetch`, a real `:memory:` library and a film
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
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleFrameFill } from '../test-support/idleFrameFill/idleFrameFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../test-support/unfittedArt/unfittedArt';

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

/** A folder under `root`, holding the files named. */
function folderWith(root: string, path: string, files: string[]): string {
  const dir = join(root, path);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(dir, file), `${file} bytes`);
  }
  return dir;
}

/** A fresh library behind a listening API, and `Heat (1995)/` beside it. */
function freshApi(): { baseUrl: string; film: string } {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-film-folder-route-');
  const media = join(root, 'media');
  mkdirSync(media);
  const film = folderWith(root, join('Films', 'Heat (1995)'), ['Heat.mkv']);
  folderWith(film, 'Images', ['poster.jpg', 'backdrop.jpg']);
  folderWith(film, 'Subtitles', ['Heat.pt.srt']);

  const mediaDomain = createMedia(media, unfittedArt());
  const playback = createPlayback(media, fixedSlot(null), () => null);

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
        frameFill: idleFrameFill(),
      }),
      createEnrichment({
        storage,
        client: offlineTmdb(),
        media: mediaDomain,
        playback,
        layoutFill: createLayoutFill({ storage, media: mediaDomain }),
      }),
      createLayoutFill({ storage, media: mediaDomain }),
      idleFrameFill()
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, film };
}

const readFilm = (baseUrl: string, video: string) =>
  fetch(`${baseUrl}/api/film-folder?video=${encodeURIComponent(video)}`);

describe('GET /api/film-folder', () => {
  it('answers the picked video’s film folder read', async () => {
    const { baseUrl, film } = freshApi();

    const response = await readFilm(baseUrl, join(film, 'Heat.mkv'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      poster: join(film, 'Images', 'poster.jpg'),
      backdrop: join(film, 'Images', 'backdrop.jpg'),
      subtitles: [
        {
          path: join(film, 'Subtitles', 'Heat.pt.srt'),
          language: 'Portuguese',
        },
      ],
    });
  });

  it('answers an empty read for a folder that cannot be read', async () => {
    const { baseUrl, film } = freshApi();

    const response = await readFilm(
      baseUrl,
      join(film, '..', 'Gone (1999)', 'Gone.mkv')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      poster: null,
      backdrop: null,
      subtitles: [],
    });
  });

  it.each([
    ['a relative path', () => 'Heat (1995)/Heat.mkv', /^Not an absolute path/],
    [
      'a path of no video kind',
      (film: string) => join(film, 'Images', 'poster.jpg'),
      /^Not a video file/,
    ],
    ['no path at all', () => '', /^Not an absolute path/],
  ])('answers 400 for %s', async (_name, videoOf, error) => {
    const { baseUrl, film } = freshApi();

    const response = await readFilm(baseUrl, videoOf(film));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: expect.stringMatching(error),
    });
  });
});
