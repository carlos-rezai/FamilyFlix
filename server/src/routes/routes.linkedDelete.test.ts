// @vitest-environment node
//
// 47 — Manage library, Phase 5: "delete a linked title, the server and the
// refusal" (issue #411).
//
// `DELETE /api/movies/:id` and `DELETE /api/series/:id` keep their path and
// their `204`, and learn the title's **Linked files**. In order: read them,
// trash them through `media.trashLinked` — the injected `Trash` — then delete
// the rows, then remove the Media folder best-effort. **Trash first, rows
// after**: a refusal is a `409` in one sentence and every row kept —
// `unavailable` the no-shell sentence, `failed` the locked path's. `folder`
// trashes the title's Source folder, `videos` only its videos, and never a
// Library folder whole; `unreachable` trashes nothing and deletes the rows. A
// copied title's delete never asks the Trash.
//
// Over a real listener, a real `:memory:` library, a sandboxed media root and
// a sandboxed Library folder — `routes.libraryTitles`' harness — with the
// shell faked at the `Trash` seam: a Trash that records each request, notes
// whether the title's rows were still held when it was asked, and moves what
// it trashes into a sandboxed bin, failing on cue.

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

const NO_SHELL =
  'Only the desktop app can move a linked title’s files to the Recycle Bin.';
const locked = (path: string) =>
  `Couldn’t move ${path} to the Recycle Bin. Close anything playing it and try again.`;

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

interface TrashScript {
  /** Answer this for every request, moving nothing. */
  answer?: TrashOutcome;
  /** Move each path into the bin in order, failing at the first so named. */
  failAt?: string;
}

/**
 * A fresh library behind a listening API, a managed media root, one listed
 * Library folder, `Movies/`, and a scripted Trash.
 */
function freshApi(script: TrashScript = {}) {
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

  /** Every request, and whether the rows were held when it came. */
  const asked: { paths: string[]; rowsHeld: boolean }[] = [];
  let heldNow: () => boolean = () => true;
  let failAt = script.failAt;

  const trash: Trash = {
    trash: (paths) => {
      asked.push({ paths: [...paths], rowsHeld: heldNow() });
      if (script.answer !== undefined) {
        return Promise.resolve(script.answer);
      }
      for (const path of paths) {
        if (basename(path) === failAt) {
          return Promise.resolve({ kind: 'failed', path } as const);
        }
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
    /** Read whether the title's rows are held whenever the Trash is asked. */
    watch(held: () => boolean) {
      heldNow = held;
    },
    /** Let the next request through whole. */
    unlock() {
      failAt = undefined;
    },
  };
}

type Api = ReturnType<typeof freshApi>;

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
  place(api.media, `${mediaFolder}/poster.jpg`);
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

function remove(api: Api, kind: 'movies' | 'series', id: string) {
  return fetch(`${api.baseUrl}/api/${kind}/${id}`, { method: 'DELETE' });
}

describe('DELETE a linked title — what the Trash is asked, before the rows', () => {
  it('trashes a film’s own Source folder, then deletes the row and the Media folder', async () => {
    const api = freshApi();
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');
    api.watch(() => api.storage.getMovie(film.id) !== null);

    const response = await remove(api, 'movies', film.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([
      { paths: [join(api.library, 'Coco (2017)')], rowsHeld: true },
    ]);
    expect(api.storage.getMovie(film.id)).toBeNull();
    expect(existsSync(join(api.media, 'coco-managed'))).toBe(false);
  });

  it('trashes only a Collection folder film’s video, never the shared folder', async () => {
    const api = freshApi();
    const heat = linkedFilm(api, 'Heat', 'Collection', 'Heat.mkv', 'Heat.mkv');
    linkedFilm(api, 'Ronin', 'Collection', 'Ronin.mkv', 'Ronin.mkv');
    api.watch(() => api.storage.getMovie(heat.id) !== null);

    const response = await remove(api, 'movies', heat.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([
      { paths: [join(api.library, 'Collection', 'Heat.mkv')], rowsHeld: true },
    ]);
    expect(existsSync(join(api.library, 'Collection', 'Ronin.mkv'))).toBe(true);
  });

  it('trashes a show’s own Show folder', async () => {
    const api = freshApi();
    const show = linkedShow(api, 'Harbor and Vine', 'Harbor and Vine', [
      'Harbor and Vine/Season 01/S01E01.mkv',
      'Harbor and Vine/Season 01/S01E02.mkv',
    ]);
    api.watch(() => api.storage.getSeries(show.id) !== null);

    const response = await remove(api, 'series', show.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([
      { paths: [join(api.library, 'Harbor and Vine')], rowsHeld: true },
    ]);
    expect(api.storage.getSeries(show.id)).toBeNull();
    expect(existsSync(join(api.media, 'harbor and vine-managed'))).toBe(false);
  });

  it('trashes only the videos of a show loose at the Library folder’s root, never the Library folder', async () => {
    const api = freshApi();
    const show = linkedShow(api, 'Harbor', '', [
      'Harbor.S01E01.mkv',
      'Harbor.S01E02.mkv',
    ]);
    place(api.library, 'Unrelated.mkv');
    api.watch(() => api.storage.getSeries(show.id) !== null);

    const response = await remove(api, 'series', show.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([
      {
        paths: [
          join(api.library, 'Harbor.S01E01.mkv'),
          join(api.library, 'Harbor.S01E02.mkv'),
        ],
        rowsHeld: true,
      },
    ]);
    expect(api.asked.flatMap(({ paths }) => paths)).not.toContain(api.library);
    expect(existsSync(api.library)).toBe(true);
    expect(existsSync(join(api.library, 'Unrelated.mkv'))).toBe(true);
  });
});

describe('DELETE a linked title — the two refusals', () => {
  it('answers 409 with the no-shell sentence when the Trash is unavailable, the film’s rows kept', async () => {
    const api = freshApi({ answer: { kind: 'unavailable' } });
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');

    const response = await remove(api, 'movies', film.id);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: NO_SHELL });
    expect(api.storage.getMovie(film.id)).not.toBeNull();
    expect(existsSync(join(api.media, 'coco-managed', 'poster.jpg'))).toBe(
      true
    );
  });

  it('answers 409 with the no-shell sentence for a show, its rows kept', async () => {
    const api = freshApi({ answer: { kind: 'unavailable' } });
    const show = linkedShow(api, 'Harbor and Vine', 'Harbor and Vine', [
      'Harbor and Vine/Season 01/S01E01.mkv',
    ]);

    const response = await remove(api, 'series', show.id);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: NO_SHELL });
    expect(api.storage.getSeries(show.id)).not.toBeNull();
    const detail = await fetch(`${api.baseUrl}/api/series/${show.id}`);
    expect(detail.status).toBe(200);
  });

  it('answers 409 naming the path the Trash could not move, every row kept', async () => {
    const api = freshApi({ failAt: 'Coco (2017)' });
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');
    const folder = join(api.library, 'Coco (2017)');

    const response = await remove(api, 'movies', film.id);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: locked(folder) });
    expect(api.storage.getMovie(film.id)).not.toBeNull();
    expect(existsSync(join(folder, 'Coco.mkv'))).toBe(true);
    expect(existsSync(join(api.media, 'coco-managed', 'poster.jpg'))).toBe(
      true
    );
  });

  it('answers 409 naming a show’s locked episode, the show and its episodes kept', async () => {
    const api = freshApi({ failAt: 'Harbor.S01E02.mkv' });
    const show = linkedShow(api, 'Harbor', '', [
      'Harbor.S01E01.mkv',
      'Harbor.S01E02.mkv',
    ]);

    const response = await remove(api, 'series', show.id);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: locked(join(api.library, 'Harbor.S01E02.mkv')),
    });
    const detail = await fetch(`${api.baseUrl}/api/series/${show.id}`);
    expect(detail.status).toBe(200);
    const body = (await detail.json()) as {
      seasons: { episodes: unknown[] }[];
    };
    expect(body.seasons.flatMap((season) => season.episodes)).toHaveLength(2);
  });
});

describe('DELETE a linked title — unreachable', () => {
  it('answers 204 with nothing trashed while the Library folder can’t be read', async () => {
    const api = freshApi();
    const film = linkedFilm(api, 'Coco', 'Coco (2017)', 'Coco.mkv');
    renameSync(api.library, join(api.root, 'Unplugged'));

    const response = await remove(api, 'movies', film.id);

    expect(response.status).toBe(204);
    expect(api.asked).toEqual([]);
    expect(api.storage.getMovie(film.id)).toBeNull();
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
  });
});

describe('DELETE a linked title — a retry after a partial failure', () => {
  it('counts the episodes already trashed as gone and finishes', async () => {
    const api = freshApi({ failAt: 'Harbor.S01E02.mkv' });
    const show = linkedShow(api, 'Harbor', '', [
      'Harbor.S01E01.mkv',
      'Harbor.S01E02.mkv',
    ]);
    const first = join(api.library, 'Harbor.S01E01.mkv');
    const second = join(api.library, 'Harbor.S01E02.mkv');

    const refused = await remove(api, 'series', show.id);
    expect(refused.status).toBe(409);
    expect(existsSync(first)).toBe(false);

    api.unlock();
    const retried = await remove(api, 'series', show.id);

    expect(retried.status).toBe(204);
    expect(api.asked.map(({ paths }) => paths)).toEqual([
      [first, second],
      [second],
    ]);
    expect(api.storage.getSeries(show.id)).toBeNull();
  });
});

describe('DELETE a copied title — never asks the Trash', () => {
  it('deletes a copied film without a word to the Trash', async () => {
    const api = freshApi({ answer: { kind: 'unavailable' } });
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

  it('deletes a copied film found in a Library folder, its original left alone', async () => {
    const api = freshApi({ answer: { kind: 'unavailable' } });
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
  });

  it('deletes a copied show without a word to the Trash', async () => {
    const api = freshApi({ answer: { kind: 'unavailable' } });
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
