// @vitest-environment node
//
// 51, Library audit, slice 4: "a plain Delete keeps the files" (issue #451);
// 52, Keep originals, slice 2: "a Delete keeps originals" (issue #476).
//
// The delete contract: `DELETE /api/movies/:id` and `DELETE /api/series/:id`
// read no query. Each records the title's **Left-out videos**, removes its
// rows, then its **Media folder**, and never asks the shell, so no Delete
// answers `409`. A `?files=trash` from an old client is ignored: it keeps
// every file exactly as a plain Delete does. An unknown id answers `404`.
//
// Over a real listener, a real `:memory:` library, a sandboxed media root and
// a sandboxed Library folder (`routes.linkedDelete`'s harness). The Media
// domain is made from its media path alone (issue #478): there is no shell
// for a Delete to ask.

import express from 'express';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

/** A file at a path under a root, its directories made. */
function place(root: string, relative: string): void {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, 'bytes');
}

/**
 * A fresh library behind a listening API, a managed media root, one listed
 * Library folder, `Movies/`.
 */
function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-delete-keeps-');
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
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    storage,
    media,
    library,
    folderId,
  };
}

type Api = ReturnType<typeof freshApi>;

/** A title's managed art and subtitles in its Media folder. */
function managed(api: Api, mediaFolder: string): void {
  place(api.media, `${mediaFolder}/poster.jpg`);
  place(api.media, `${mediaFolder}/backdrop.jpg`);
  place(api.media, `${mediaFolder}/subtitles/en.srt`);
}

/** A film linked where it lies, its managed art in a Media folder. */
function linkedFilm(
  api: Api,
  title: string,
  folder: string,
  file: string,
  sourceFile?: string
) {
  place(api.library, `${folder}/${file}`);
  const mediaFolder = `${title.toLowerCase()}-managed`;
  managed(api, mediaFolder);
  const film = api.storage.addMovie({
    title,
    videoPath: `${folder}/${file}`,
    videoFolderId: api.folderId,
    mediaFolder,
  });
  api.storage.setSourceFolder(film.id, api.folderId, folder, sourceFile);
  return film;
}

/** A show linked where it lies, its episodes S01E01 onward by relative path. */
function linkedShow(
  api: Api,
  title: string,
  sourceFolder: string,
  episodes: readonly string[]
) {
  for (const episode of episodes) {
    place(api.library, episode);
  }
  const mediaFolder = `${title.toLowerCase()}-managed`;
  managed(api, mediaFolder);
  const show = api.storage.addSeries(
    { title, mediaFolder },
    episodes.map((videoPath, index) => ({
      season: 1,
      number: index + 1,
      videoPath,
      videoFolderId: api.folderId,
    }))
  );
  api.storage.setSourceFolder(show.id, api.folderId, sourceFolder);
  return show;
}

function remove(api: Api, kind: 'movies' | 'series', id: string, query = '') {
  return fetch(`${api.baseUrl}/api/${kind}/${id}${query}`, {
    method: 'DELETE',
  });
}

const leftOut = (api: Api): string[] =>
  [...api.storage.leftOut(api.folderId)].sort();

describe('a plain Delete keeps a linked title’s files', () => {
  it('deletes a linked film and leaves its file where it lies, never asking the shell', async () => {
    const api = freshApi();
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');

    const response = await remove(api, 'movies', film.id);

    expect(response.status).toBe(204);
    expect(api.storage.getMovie(film.id)).toBeNull();
    expect(existsSync(join(api.library, 'Coco (2017)', 'Coco.mkv'))).toBe(true);
    expect(leftOut(api)).toEqual(['Coco (2017)/Coco.mkv']);
  });

  it('deletes a linked show and leaves its Show folder whole, never asking the shell', async () => {
    const api = freshApi();
    const show = linkedShow(api, 'Harbor and Vine', 'Harbor and Vine', [
      'Harbor and Vine/Season 01/S01E01.mkv',
      'Harbor and Vine/Season 01/S01E02.mkv',
    ]);

    const response = await remove(api, 'series', show.id);

    expect(response.status).toBe(204);
    expect(api.storage.getSeries(show.id)).toBeNull();
    expect(
      existsSync(
        join(api.library, 'Harbor and Vine', 'Season 01', 'S01E01.mkv')
      )
    ).toBe(true);
    expect(
      existsSync(
        join(api.library, 'Harbor and Vine', 'Season 01', 'S01E02.mkv')
      )
    ).toBe(true);
    expect(leftOut(api)).toEqual([
      'Harbor and Vine/Season 01/S01E01.mkv',
      'Harbor and Vine/Season 01/S01E02.mkv',
    ]);
  });
});

describe('?files=trash changes nothing', () => {
  it('deletes a linked film with 204, its file kept and left out, never asking the shell', async () => {
    const api = freshApi();
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');

    const response = await remove(api, 'movies', film.id, '?files=trash');

    expect(response.status).toBe(204);
    expect(api.storage.getMovie(film.id)).toBeNull();
    expect(existsSync(join(api.library, 'Coco (2017)', 'Coco.mkv'))).toBe(true);
    expect(leftOut(api)).toEqual(['Coco (2017)/Coco.mkv']);
  });

  it('deletes a linked show with 204, its episodes kept and left out, never asking the shell', async () => {
    const api = freshApi();
    const show = linkedShow(api, 'Harbor', '', [
      'Harbor.S01E01.mkv',
      'Harbor.S01E02.mkv',
    ]);

    const response = await remove(api, 'series', show.id, '?files=trash');

    expect(response.status).toBe(204);
    expect(api.storage.getSeries(show.id)).toBeNull();
    expect(existsSync(join(api.library, 'Harbor.S01E01.mkv'))).toBe(true);
    expect(existsSync(join(api.library, 'Harbor.S01E02.mkv'))).toBe(true);
    expect(leftOut(api)).toEqual(['Harbor.S01E01.mkv', 'Harbor.S01E02.mkv']);
  });

  it('removes the film’s Media folder as a plain Delete does, never asking the shell', async () => {
    const api = freshApi();
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');

    const response = await remove(api, 'movies', film.id, '?files=trash');

    expect(response.status).toBe(204);
    expect(existsSync(join(api.media, 'coco-managed'))).toBe(false);
  });
});

describe('no Delete answers 409, even with no shell', () => {
  it('deletes a linked film under ?files=trash with 204, not the no-shell 409', async () => {
    const api = freshApi();
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');

    const response = await remove(api, 'movies', film.id, '?files=trash');

    expect(response.status).toBe(204);
    expect(api.storage.getMovie(film.id)).toBeNull();
  });

  it('deletes a linked show under ?files=trash with 204, not the no-shell 409', async () => {
    const api = freshApi();
    const show = linkedShow(api, 'Harbor and Vine', 'Harbor and Vine', [
      'Harbor and Vine/Season 01/S01E01.mkv',
    ]);

    const response = await remove(api, 'series', show.id, '?files=trash');

    expect(response.status).toBe(204);
    expect(api.storage.getSeries(show.id)).toBeNull();
  });

  it('answers 404 for an unknown film or show, plain or under ?files=trash', async () => {
    const api = freshApi();

    for (const kind of ['movies', 'series'] as const) {
      for (const query of ['', '?files=trash']) {
        const response = await remove(api, kind, 'no-such-id', query);
        expect(response.status, `${kind}${query}`).toBe(404);
      }
    }
  });
});

describe('a copied title’s Delete is unchanged', () => {
  it('deletes a copied film under ?files=trash, its original kept and left out', async () => {
    const api = freshApi();
    place(api.library, 'Heat (1995)/Heat.1995.mkv');
    managed(api, 'heat-1995');
    place(api.media, 'heat-1995/Heat.1995.mkv');
    const film = api.storage.addMovie({
      title: 'Heat',
      videoPath: 'heat-1995/Heat.1995.mkv',
      mediaFolder: 'heat-1995',
    });
    api.storage.setSourceFolder(film.id, api.folderId, 'Heat (1995)');

    const response = await remove(api, 'movies', film.id, '?files=trash');

    expect(response.status).toBe(204);
    expect(api.storage.getMovie(film.id)).toBeNull();
    expect(existsSync(join(api.media, 'heat-1995'))).toBe(false);
    expect(existsSync(join(api.library, 'Heat (1995)', 'Heat.1995.mkv'))).toBe(
      true
    );
    expect(leftOut(api)).toEqual(['Heat (1995)/Heat.1995.mkv']);
  });
});

describe('art, subtitles and the Media folder go on every Delete', () => {
  it('removes a plainly deleted film’s Media folder and keeps its video', async () => {
    const api = freshApi();
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');

    const response = await remove(api, 'movies', film.id);

    expect(response.status).toBe(204);
    expect(existsSync(join(api.media, 'coco-managed', 'poster.jpg'))).toBe(
      false
    );
    expect(
      existsSync(join(api.media, 'coco-managed', 'subtitles', 'en.srt'))
    ).toBe(false);
    expect(existsSync(join(api.media, 'coco-managed'))).toBe(false);
    expect(existsSync(join(api.library, 'Coco (2017)', 'Coco.mkv'))).toBe(true);
  });

  it('removes a plainly deleted show’s Media folder and keeps its episodes', async () => {
    const api = freshApi();
    const show = linkedShow(api, 'Harbor', '', ['Harbor.S01E01.mkv']);

    const response = await remove(api, 'series', show.id);

    expect(response.status).toBe(204);
    expect(existsSync(join(api.media, 'harbor-managed'))).toBe(false);
    expect(existsSync(join(api.library, 'Harbor.S01E01.mkv'))).toBe(true);
  });
});
