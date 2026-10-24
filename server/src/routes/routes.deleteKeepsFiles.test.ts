// @vitest-environment node
//
// 51 — Library audit, slice 4: "a plain Delete keeps the files" (issue #451).
//
// The delete contract: `DELETE /api/movies/:id` and `DELETE /api/series/:id`
// keep a linked title's files by default and never ask the shell, so a
// browser's plain Delete answers `204`, never the no-shell `409`. With
// `?files=trash` the delete runs `trashedFirst` over the title's **Linked
// files**, which never hold a video another held title links: when every
// video is shared they are `shared` and nothing is trashed. Every Delete,
// either way, still removes the row, the art, the subtitles and the **Media
// folder**. A copied title's Delete is unchanged.
//
// Over a real listener, a real `:memory:` library, a sandboxed media root and
// a sandboxed Library folder (`routes.linkedDelete`'s harness), the shell
// faked at the `Trash` seam: it records each request and moves what it
// trashes into a sandboxed bin, or answers one outcome for every request.

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
import {
  createMedia,
  type Trash,
  type TrashOutcome,
} from '../media/createMedia/createMedia';
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
 * Library folder, `Movies/`, and a Trash that records every request. With an
 * `answer` it answers that and moves nothing (`unavailable` is a browser, no
 * shell); without, it moves each path into the bin.
 */
function freshApi(answer?: TrashOutcome) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-delete-keeps-');
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
      if (answer !== undefined) {
        return Promise.resolve(answer);
      }
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
    media,
    library,
    folderId,
    asked,
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

describe('a plain Delete keeps a linked title’s files', () => {
  it('deletes a linked film and leaves its file where it lies, never asking the shell', async () => {
    const api = freshApi();
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');

    const response = await remove(api, 'movies', film.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([]);
    expect(api.storage.getMovie(film.id)).toBeNull();
    expect(existsSync(join(api.library, 'Coco (2017)', 'Coco.mkv'))).toBe(true);
  });

  it('deletes a linked show and leaves its Show folder whole, never asking the shell', async () => {
    const api = freshApi();
    const show = linkedShow(api, 'Harbor and Vine', 'Harbor and Vine', [
      'Harbor and Vine/Season 01/S01E01.mkv',
      'Harbor and Vine/Season 01/S01E02.mkv',
    ]);

    const response = await remove(api, 'series', show.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([]);
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
  });
});

describe('a plain Delete in a browser, with no shell', () => {
  it('deletes a linked film with 204, not the no-shell 409', async () => {
    const api = freshApi({ kind: 'unavailable' });
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');

    const response = await remove(api, 'movies', film.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([]);
    expect(api.storage.getMovie(film.id)).toBeNull();
  });

  it('deletes a linked show with 204, not the no-shell 409', async () => {
    const api = freshApi({ kind: 'unavailable' });
    const show = linkedShow(api, 'Harbor and Vine', 'Harbor and Vine', [
      'Harbor and Vine/Season 01/S01E01.mkv',
    ]);

    const response = await remove(api, 'series', show.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([]);
    expect(api.storage.getSeries(show.id)).toBeNull();
  });
});

describe('?files=trash trashes only the unshared paths', () => {
  it('trashes a show’s own episodes and keeps the one a film also links', async () => {
    const api = freshApi();
    const show = linkedShow(api, 'Harbor', '', [
      'Harbor.S01E01.mkv',
      'Harbor.S01E02.mkv',
    ]);
    const double = api.storage.addMovie({
      title: 'Harbor Pilot',
      videoPath: 'Harbor.S01E01.mkv',
      videoFolderId: api.folderId,
      mediaFolder: 'harbor-pilot-managed',
    });

    const response = await remove(api, 'series', show.id, '?files=trash');

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([[join(api.library, 'Harbor.S01E02.mkv')]]);
    expect(existsSync(join(api.library, 'Harbor.S01E01.mkv'))).toBe(true);
    expect(api.storage.getSeries(show.id)).toBeNull();
    expect(api.storage.getMovie(double.id)).not.toBeNull();
  });

  it('trashes nothing for a Collection folder film whose video another title plays, and deletes it', async () => {
    const api = freshApi();
    const heat = linkedFilm(api, 'Heat', 'Collection', 'Heat.mkv', 'Heat.mkv');
    const double = linkedFilm(
      api,
      'Heat Again',
      'Collection',
      'Heat.mkv',
      'Heat.mkv'
    );

    const response = await remove(api, 'movies', heat.id, '?files=trash');

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([]);
    expect(api.storage.getMovie(heat.id)).toBeNull();
    expect(api.storage.getMovie(double.id)).not.toBeNull();
    expect(existsSync(join(api.library, 'Collection', 'Heat.mkv'))).toBe(true);
  });

  it('never trashes a film’s own folder whole when another title plays its video', async () => {
    const api = freshApi();
    const coco = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');
    const double = linkedFilm(api, 'Coco Again', 'Coco (2017)', 'Coco.mkv');

    const response = await remove(api, 'movies', coco.id, '?files=trash');

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([]);
    expect(existsSync(join(api.library, 'Coco (2017)', 'Coco.mkv'))).toBe(true);
    expect(api.storage.getMovie(double.id)).not.toBeNull();
  });
});

describe('a copied title’s Delete is unchanged', () => {
  it('deletes a copied film under ?files=trash without a word to the Trash', async () => {
    const api = freshApi({ kind: 'unavailable' });
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
    expect(api.asked).toEqual([]);
    expect(api.storage.getMovie(film.id)).toBeNull();
    expect(existsSync(join(api.media, 'heat-1995'))).toBe(false);
    expect(existsSync(join(api.library, 'Heat (1995)', 'Heat.1995.mkv'))).toBe(
      true
    );
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

  it('removes a trash-deleted film’s Media folder too', async () => {
    const api = freshApi();
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');

    const response = await remove(api, 'movies', film.id, '?files=trash');

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([[join(api.library, 'Coco (2017)')]]);
    expect(existsSync(join(api.media, 'coco-managed'))).toBe(false);
  });

  it('removes the Media folder of a film whose shared video stays, under ?files=trash', async () => {
    const api = freshApi();
    const heat = linkedFilm(api, 'Heat', 'Collection', 'Heat.mkv', 'Heat.mkv');
    linkedFilm(api, 'Heat Again', 'Collection', 'Heat.mkv', 'Heat.mkv');

    const response = await remove(api, 'movies', heat.id, '?files=trash');

    expect(response.status).toBe(204);
    expect(existsSync(join(api.media, 'heat-managed'))).toBe(false);
    expect(existsSync(join(api.media, 'heat again-managed'))).toBe(true);
  });
});
