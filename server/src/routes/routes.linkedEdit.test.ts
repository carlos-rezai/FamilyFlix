// @vitest-environment node
//
// 41 — Link or copy, Slice 4: "the review and the form follow the run"
// (issue #345), the **Movie form**'s half.
//
// The form still copies. On an edit:
//
// - a held **Linked video** travels back as its path and stays linked — a
//   title-only edit of a linked film keeps `videoFolderId` and copies nothing;
// - a freshly picked video replaces it as a copy, and the linked file is not
//   removed;
// - the **Series edit job** works the same per episode, renumbered or not, and
//   the episodes it adds are copied.
//
// Over a real listener, a real `:memory:` library, a sandboxed media root and a
// sandboxed Library folder, with the Playback's folder reader composed over
// `storage` the way `main.ts` composes it — `routes.linkedVideo.test.ts`' rig.

import express from 'express';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
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
import type { Episode, Movie, Series } from '@/types';

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

function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  library: string;
  folderId: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-linked-edit-');
  const media = join(root, 'media');
  const library = join(root, 'Library');
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
      createEnrichment({ storage, client: offlineTmdb(), media: mediaDomain })
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    media,
    library,
    folderId,
  };
}

/** Put the ten-second fixture film at a path under a root. */
function placeFixture(root: string, relative: string): string {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  copyFileSync(FIXTURE_VIDEO, file);
  return file;
}

/** Every file under a directory, relative to it. */
function filesUnder(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

const isVideo = (path: string) => /\.(mp4|mkv|avi|webm|mov)$/i.test(path);

const videoPart = (filename: string): File =>
  new File([new Uint8Array(readFileSync(FIXTURE_VIDEO))], filename, {
    type: 'video/mp4',
  });

type Part = [name: string, value: string | File];

function send(url: string, parts: Part[]): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(url, { method: 'PATCH', body });
}

async function streamStatus(url: string): Promise<number> {
  const response = await fetch(url);
  await response.arrayBuffer();
  return response.status;
}

// --- A linked film -----------------------------------------------------------

const LINKED_FILM = 'Heat (1995)/Heat.1995.mp4';

function addLinkedFilm(storage: LibraryStorage, folderId: string): Movie {
  return storage.addMovie({
    title: 'Heat',
    year: 1995,
    videoPath: LINKED_FILM,
    videoFolderId: folderId,
    mediaFolder: 'heat-1995',
  });
}

/** The film's fields as the form sends them back, its video as its path. */
function filmFields(movie: Movie, title = movie.title): Part[] {
  return [
    ['title', title],
    ['year', String(movie.year ?? '')],
    ['director', movie.director ?? ''],
    ['description', movie.synopsis ?? ''],
    ['rating', String(movie.rating ?? '')],
  ];
}

describe('PATCH /api/movies/:id — a title-only edit of a linked film', () => {
  it('keeps the film linked where it lies', async () => {
    const { storage, baseUrl, library, folderId } = freshApi();
    placeFixture(library, LINKED_FILM);
    const movie = addLinkedFilm(storage, folderId);

    const response = await send(`${baseUrl}/api/movies/${movie.id}`, [
      ...filmFields(movie, 'Heat (director’s cut)'),
      ['videoPath', movie.videoPath],
    ]);

    expect(response.status).toBe(200);
    const amended = (await response.json()) as Movie;
    expect(amended).toMatchObject({
      title: 'Heat (director’s cut)',
      videoFolderId: folderId,
      videoPath: LINKED_FILM,
    });
    expect(storage.getMovie(movie.id)).toMatchObject({
      videoFolderId: folderId,
      videoPath: LINKED_FILM,
    });
  });

  it('copies nothing into the managed media directory', async () => {
    const { storage, baseUrl, media, library, folderId } = freshApi();
    placeFixture(library, LINKED_FILM);
    const movie = addLinkedFilm(storage, folderId);

    await send(`${baseUrl}/api/movies/${movie.id}`, [
      ...filmFields(movie, 'Heat (director’s cut)'),
      ['videoPath', movie.videoPath],
    ]);

    expect(filesUnder(media).filter(isVideo)).toEqual([]);
  });

  it('still plays from the Library folder', async () => {
    const { storage, baseUrl, library, folderId } = freshApi();
    placeFixture(library, LINKED_FILM);
    const movie = addLinkedFilm(storage, folderId);

    await send(`${baseUrl}/api/movies/${movie.id}`, [
      ...filmFields(movie, 'Heat (director’s cut)'),
      ['videoPath', movie.videoPath],
    ]);

    expect(await streamStatus(`${baseUrl}/api/movies/${movie.id}/stream`)).toBe(
      200
    );
  });
});

describe('PATCH /api/movies/:id — a new video picked for a linked film', () => {
  it('copies the picked video in, the film no longer linked, and the linked file still on disk', async () => {
    const { storage, baseUrl, media, library, folderId } = freshApi();
    const linkedFile = placeFixture(library, LINKED_FILM);
    const movie = addLinkedFilm(storage, folderId);

    const response = await send(`${baseUrl}/api/movies/${movie.id}`, [
      ...filmFields(movie),
      ['video', videoPart('heat.remaster.mp4')],
    ]);

    expect(response.status).toBe(200);
    const amended = storage.getMovie(movie.id);
    expect(amended?.videoFolderId).toBeNull();
    expect(existsSync(join(media, amended?.videoPath ?? ''))).toBe(true);
    expect(existsSync(linkedFile)).toBe(true);
    expect(await streamStatus(`${baseUrl}/api/movies/${movie.id}/stream`)).toBe(
      200
    );
  });
});

// --- A linked series ---------------------------------------------------------

const LINKED_EPISODES = [
  'Harbor and Vine/Season 01/S01E01.mp4',
  'Harbor and Vine/Season 01/S01E02.mp4',
];

function addLinkedSeries(
  storage: LibraryStorage,
  library: string,
  folderId: string
): Series {
  for (const path of LINKED_EPISODES) {
    placeFixture(library, path);
  }
  return storage.addSeries(
    {
      title: 'Harbor and Vine',
      year: 2019,
      mediaFolder: 'harbor-and-vine-2019',
    },
    LINKED_EPISODES.map((videoPath, index) => ({
      season: 1,
      number: index + 1,
      title: `Episode ${index + 1}`,
      videoPath,
      videoFolderId: folderId,
    }))
  );
}

function seriesFields(title = 'Harbor and Vine'): Part[] {
  return [
    ['title', title],
    ['year', '2019'],
    ['creator', ''],
    ['description', ''],
    ['rating', ''],
  ];
}

/** A held episode's `episode` field, its video as the path it has. */
function heldEpisode(
  episode: Episode,
  overrides: Record<string, unknown> = {}
): Part {
  return [
    'episode',
    JSON.stringify({
      id: episode.id,
      season: episode.season,
      number: episode.number,
      title: episode.title ?? '',
      videoPath: episode.videoPath,
      storedSubtitles: [],
      subtitleLanguages: [],
      ...overrides,
    }),
  ];
}

const linkOf = (episode: Episode) => ({
  id: episode.id,
  videoFolderId: episode.videoFolderId,
  videoPath: episode.videoPath,
});

describe('PATCH /api/series/:id — a series with linked episodes', () => {
  it('keeps every held linked episode linked on a title-only edit', async () => {
    const { storage, baseUrl, media, library, folderId } = freshApi();
    const series = addLinkedSeries(storage, library, folderId);
    const held = storage.listEpisodes(series.id);

    const response = await send(`${baseUrl}/api/series/${series.id}`, [
      ...seriesFields('Harbor & Vine'),
      ...held.map((episode) => heldEpisode(episode)),
    ]);

    expect(response.status).toBe(200);
    const after = storage.listEpisodes(series.id);
    expect(after.map(linkOf)).toEqual(held.map(linkOf));
    for (const episode of after) {
      expect(episode.videoFolderId).toBe(folderId);
    }
    expect(filesUnder(media).filter(isVideo)).toEqual([]);
  });

  it('keeps a renumbered linked episode linked', async () => {
    const { storage, baseUrl, library, folderId } = freshApi();
    const series = addLinkedSeries(storage, library, folderId);
    const [first, second] = storage.listEpisodes(series.id);

    const response = await send(`${baseUrl}/api/series/${series.id}`, [
      ...seriesFields(),
      heldEpisode(first, { number: 2 }),
      heldEpisode(second, { number: 1 }),
    ]);

    expect(response.status).toBe(200);
    expect(
      storage
        .listEpisodes(series.id)
        .map((e) => [e.id, e.number, e.videoFolderId, e.videoPath])
    ).toEqual([
      [second.id, 1, folderId, LINKED_EPISODES[1]],
      [first.id, 2, folderId, LINKED_EPISODES[0]],
    ]);
    for (const episode of storage.listEpisodes(series.id)) {
      expect(
        await streamStatus(`${baseUrl}/api/episodes/${episode.id}/stream`)
      ).toBe(200);
    }
  });

  it('copies an added episode in, and keeps the held ones linked', async () => {
    const { storage, baseUrl, media, library, folderId } = freshApi();
    const series = addLinkedSeries(storage, library, folderId);
    const held = storage.listEpisodes(series.id);

    const response = await send(`${baseUrl}/api/series/${series.id}`, [
      ...seriesFields(),
      ...held.map((episode) => heldEpisode(episode)),
      ['episode', JSON.stringify({ season: 1, number: 3, title: 'Third' })],
      ['episodeVideo', videoPart('S01E03.mp4')],
    ]);

    expect(response.status).toBe(200);
    const after = storage.listEpisodes(series.id);
    expect(after.slice(0, 2).map(linkOf)).toEqual(held.map(linkOf));
    const added = after.find((episode) => episode.number === 3);
    expect(added?.videoFolderId).toBeNull();
    expect(existsSync(join(media, added?.videoPath ?? ''))).toBe(true);
    expect(
      await streamStatus(`${baseUrl}/api/episodes/${added?.id}/stream`)
    ).toBe(200);
  });

  it('copies a video picked for a held linked episode, and leaves the linked file on disk', async () => {
    const { storage, baseUrl, media, library, folderId } = freshApi();
    const series = addLinkedSeries(storage, library, folderId);
    const [first, second] = storage.listEpisodes(series.id);

    const response = await send(`${baseUrl}/api/series/${series.id}`, [
      ...seriesFields(),
      heldEpisode(first),
      heldEpisode(second, { videoPath: undefined }),
      ['episodeVideo', videoPart('S01E02.recut.mp4')],
    ]);

    expect(response.status).toBe(200);
    const after = storage.listEpisodes(series.id);
    expect(linkOf(after[0])).toEqual(linkOf(first));
    expect(after[1].id).toBe(second.id);
    expect(after[1].videoFolderId).toBeNull();
    expect(existsSync(join(media, after[1].videoPath))).toBe(true);
    expect(existsSync(join(library, LINKED_EPISODES[1]))).toBe(true);
  });
});
