// @vitest-environment node
//
// 47, Manage library, Phase 5: "delete a linked title, the server" (issue
// #411); 52, Keep originals, slice 2: "a Delete keeps originals" (issue #476).
//
// `DELETE /api/movies/:id` and `DELETE /api/series/:id` keep their path and
// their `204`, and never reach the shell: an old client's `?files=trash` is
// ignored. A linked title's Delete records its **Left-out videos**, removes
// its rows, then its **Media folder** best-effort, and leaves every video
// where it lies, reachable or not. A copied title's Delete removes its Media
// folder and leaves its original, if any, as a Left-out video.
//
// Over a real listener, a real `:memory:` library, a sandboxed media root and
// a sandboxed Library folder (`routes.libraryTitles`' harness), with the
// shell faked at the `Trash` seam: a Trash that records each request and
// moves what it is given into a sandboxed bin, so a request that reached it
// would show on disk.

import express from 'express';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia, type Trash } from '../media/createMedia/createMedia';
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
 * Library folder, `Movies/`, and a Trash that records and moves.
 */
function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-linked-delete-');
  const media = join(root, 'media');
  const library = join(root, 'Movies');
  const bin = join(root, 'bin');
  mkdirSync(media);
  mkdirSync(library);
  mkdirSync(bin);
  const folderId = storage.addLibraryFolder(library).id;

  const asked: string[][] = [];
  const trash: Trash = {
    trash: (paths) => {
      asked.push([...paths]);
      for (const path of paths) {
        renameSync(path, join(bin, basename(path)));
      }
      return Promise.resolve({ kind: 'trashed' } as const);
    },
  };

  const mediaDomain = createMedia(media, trash);
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
    root,
    media,
    library,
    folderId,
    asked,
  };
}

type Api = ReturnType<typeof freshApi>;

const leftOut = (api: Api): string[] =>
  [...api.storage.leftOut(api.folderId)].sort();

/** A film linked where it lies, its managed art in a Media folder. */
function linkedFilm(api: Api, title: string, folder: string, file: string) {
  place(api.library, `${folder}/${file}`);
  const mediaFolder = `${title.toLowerCase()}-managed`;
  place(api.media, `${mediaFolder}/poster.jpg`);
  const film = api.storage.addMovie({
    title,
    videoPath: `${folder}/${file}`,
    videoFolderId: api.folderId,
    mediaFolder,
  });
  api.storage.setSourceFolder(film.id, api.folderId, folder);
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
  place(api.media, `${mediaFolder}/poster.jpg`);
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

/** An old client's Delete, still asking for the Recycle Bin: ignored. */
function remove(api: Api, kind: 'movies' | 'series', id: string) {
  return fetch(`${api.baseUrl}/api/${kind}/${id}?files=trash`, {
    method: 'DELETE',
  });
}

describe('DELETE a linked title, unreachable', () => {
  it('answers 204 while the Library folder can’t be read, its video left out and kept', async () => {
    const api = freshApi();
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');
    renameSync(api.library, join(api.root, 'Unplugged'));

    const response = await remove(api, 'movies', film.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([]);
    expect(api.storage.getMovie(film.id)).toBeNull();
    expect(leftOut(api)).toEqual(['Coco (2017)/Coco.mkv']);
    expect(
      existsSync(join(api.root, 'Unplugged', 'Coco (2017)', 'Coco.mkv'))
    ).toBe(true);
  });

  it('deletes an unreachable show the same way', async () => {
    const api = freshApi();
    const show = linkedShow(api, 'Harbor and Vine', 'Harbor and Vine', [
      'Harbor and Vine/Season 01/S01E01.mkv',
    ]);
    renameSync(api.library, join(api.root, 'Unplugged'));

    const response = await remove(api, 'series', show.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([]);
    expect(api.storage.getSeries(show.id)).toBeNull();
    expect(leftOut(api)).toEqual(['Harbor and Vine/Season 01/S01E01.mkv']);
  });
});

describe('DELETE a copied title, never asks the Trash', () => {
  it('deletes a copied film without a word to the Trash', async () => {
    const api = freshApi();
    place(api.media, 'heat-1995/Heat.mkv');
    const film = api.storage.addMovie({
      title: 'Heat',
      videoPath: 'heat-1995/Heat.mkv',
      mediaFolder: 'heat-1995',
    });

    const response = await remove(api, 'movies', film.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([]);
    expect(existsSync(join(api.media, 'heat-1995'))).toBe(false);
  });

  it('deletes a copied film found in a Library folder, its original kept and left out', async () => {
    const api = freshApi();
    place(api.library, 'Heat (1995)/Heat.1995.mkv');
    place(api.media, 'heat-1995/Heat.1995.mkv');
    const film = api.storage.addMovie({
      title: 'Heat',
      videoPath: 'heat-1995/Heat.1995.mkv',
      mediaFolder: 'heat-1995',
    });
    api.storage.setSourceFolder(film.id, api.folderId, 'Heat (1995)');

    const response = await remove(api, 'movies', film.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([]);
    expect(existsSync(join(api.library, 'Heat (1995)', 'Heat.1995.mkv'))).toBe(
      true
    );
    expect(leftOut(api)).toEqual(['Heat (1995)/Heat.1995.mkv']);
  });

  it('deletes a copied show without a word to the Trash', async () => {
    const api = freshApi();
    place(api.media, 'harbor/season-01/S01E01.mkv');
    const show = api.storage.addSeries(
      { title: 'Harbor and Vine', mediaFolder: 'harbor' },
      [{ season: 1, number: 1, videoPath: 'harbor/season-01/S01E01.mkv' }]
    );

    const response = await remove(api, 'series', show.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([]);
    expect(existsSync(join(api.media, 'harbor'))).toBe(false);
  });
});
