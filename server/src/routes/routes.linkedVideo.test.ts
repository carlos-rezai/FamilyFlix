// @vitest-environment node
//
// 41 — Link or copy, Phase 2: "a linked video plays" (issue #342).
//
// The playback side of a **Linked video**, proven over rows the test writes —
// nothing imports one yet. A linked film or episode has `videoFolderId` set
// and a `videoPath` relative to that **Library folder**; the routes hand the
// row's **StoredVideo** to `Playback.videoFile` and never learn there are two
// roots. Its art and subtitles stay **Stored paths** under its managed **Media
// folder**, so they read as they always did.
//
// And the app never removes a linked video: not a **Delete**, not a **Factory
// reset**, and not an edit that supersedes it — `removeFile` is never handed a
// linked path, so a managed file that happens to share that relative path is
// never removed in its place.
//
// Over a real listener, a real `:memory:` library, a sandboxed media root and a
// sandboxed Library folder, with the Playback's folder reader composed over
// `storage` the way `main.ts` composes it.

import express from 'express';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../playback/ffmpegComponent/ffmpegComponent';
import type { MediaProbe } from '../playback/probe/probe';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import {
  FIXTURE_DURATION_SECONDS,
  FIXTURE_VIDEO,
} from '../test-support/fixtureVideo/fixtureVideo';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { Movie, Series } from '@/types';

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

/** An MKV whose container alone is wrong: a **Remux**. */
const REMUXABLE: MediaProbe = {
  container: 'matroska',
  videoCodec: 'h264',
  audioCodec: 'aac',
  durationSeconds: 5391.2,
};

const CONVERTED_BYTES = Buffer.from('FAMILYFLIX converted bytes');

/** A component that probes every file as {@link REMUXABLE}, recording each spawn. */
function remuxingComponent(): PlaybackComponent & { spawned: string[][] } {
  const component = {
    spawned: [] as string[][],
    hardwareEncoder: null,
    decoders: () => null,
    probe: () => REMUXABLE,
    spawn: (args: string[]): PlaybackProcess => {
      component.spawned.push(args);
      return {
        stdout: Readable.from([CONVERTED_BYTES]),
        kill: () => undefined,
      };
    },
  };
  return component;
}

/**
 * A fresh library behind a listening API, a managed media root and one listed
 * Library folder, `Movies/`, beside it.
 */
function freshApi(component: PlaybackComponent | null = null): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  library: string;
  folderId: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-linked-api-');
  const media = join(root, 'media');
  const library = join(root, 'Movies');
  mkdirSync(media);
  mkdirSync(library);
  const folderId = storage.addLibraryFolder(library).id;

  const mediaDomain = createMedia(media);
  const playback = createPlayback(
    media,
    fixedSlot(component),
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

/** Write a file of the given bytes at a path under a root. */
function placeFile(root: string, relative: string, contents: string): string {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, contents);
  return file;
}

const LINKED_FILM = 'Heat (1995)/Heat.1995.mp4';
const LINKED_EPISODE = 'Harbor and Vine/Season 01/S01E01.mp4';

/** _Heat_, its video linked in the Library folder, its folder in managed storage. */
function addLinkedFilm(
  storage: LibraryStorage,
  folderId: string,
  extra: Partial<Parameters<LibraryStorage['addMovie']>[0]> = {}
): Movie {
  return storage.addMovie({
    title: 'Heat',
    year: 1995,
    videoPath: LINKED_FILM,
    videoFolderId: folderId,
    mediaFolder: 'heat-1995',
    ...extra,
  });
}

/** _Harbor and Vine_, one linked episode, its Series folder in managed storage. */
function addLinkedSeries(storage: LibraryStorage, folderId: string): Series {
  return storage.addSeries(
    {
      title: 'Harbor and Vine',
      year: 2019,
      mediaFolder: 'harbor-and-vine-2019',
    },
    [
      {
        season: 1,
        number: 1,
        title: 'Pilot',
        videoPath: LINKED_EPISODE,
        videoFolderId: folderId,
      },
    ]
  );
}

async function streamed(
  url: string
): Promise<{ status: number; body: Buffer }> {
  const response = await fetch(url);
  return {
    status: response.status,
    body: Buffer.from(await response.arrayBuffer()),
  };
}

describe('a linked film and a linked episode stream end to end', () => {
  it('reads a linked film’s playback and streams its bytes from the Library folder', async () => {
    const { storage, baseUrl, library, folderId } = freshApi();
    placeFixture(library, LINKED_FILM);
    const movie = addLinkedFilm(storage, folderId);

    const read = await fetch(`${baseUrl}/api/movies/${movie.id}/playback`);
    expect(read.status).toBe(200);
    const body = (await read.json()) as {
      path: string;
      durationSeconds: number;
    };
    expect(body.path).toBe('direct');
    expect(body.durationSeconds).toBeCloseTo(FIXTURE_DURATION_SECONDS, 0);

    const stream = await streamed(`${baseUrl}/api/movies/${movie.id}/stream`);
    expect(stream.status).toBe(200);
    expect(stream.body.equals(readFileSync(FIXTURE_VIDEO))).toBe(true);
  });

  it('reads a linked episode’s playback and streams its bytes from the Library folder', async () => {
    const { storage, baseUrl, library, folderId } = freshApi();
    placeFixture(library, LINKED_EPISODE);
    const series = addLinkedSeries(storage, folderId);
    const [episode] = storage.listEpisodes(series.id);

    const read = await fetch(`${baseUrl}/api/episodes/${episode?.id}/playback`);
    expect(read.status).toBe(200);
    expect(((await read.json()) as { path: string }).path).toBe('direct');

    const stream = await streamed(
      `${baseUrl}/api/episodes/${episode?.id}/stream`
    );
    expect(stream.status).toBe(200);
    expect(stream.body.equals(readFileSync(FIXTURE_VIDEO))).toBe(true);
  });

  it('takes the remux path for a linked .mkv as it does for a copied one', async () => {
    const component = remuxingComponent();
    const { storage, baseUrl, media, library, folderId } = freshApi(component);
    const linkedFile = placeFile(library, 'Heat (1995)/Heat.1995.mkv', 'mkv');
    const linked = addLinkedFilm(storage, folderId, {
      videoPath: 'Heat (1995)/Heat.1995.mkv',
    });
    placeFile(media, 'ronin-1998/ronin.mkv', 'mkv');
    const copied = storage.addMovie({
      title: 'Ronin',
      videoPath: 'ronin-1998/ronin.mkv',
    });

    for (const id of [linked.id, copied.id]) {
      const read = await fetch(`${baseUrl}/api/movies/${id}/playback`);
      expect(((await read.json()) as { path: string }).path).toBe('remux');
    }

    const stream = await streamed(`${baseUrl}/api/movies/${linked.id}/stream`);
    expect(stream.status).toBe(200);
    expect(stream.body.equals(CONVERTED_BYTES)).toBe(true);
    expect(component.spawned[0]).toContain(linkedFile);
  });
});

describe('a linked title’s subtitles', () => {
  it('reads a linked film’s subtitle from its managed folder, as before', async () => {
    const { storage, baseUrl, media, library, folderId } = freshApi();
    placeFixture(library, LINKED_FILM);
    placeFile(
      media,
      'heat-1995/heat.en.srt',
      '1\n00:00:01,000 --> 00:00:02,500\nThe lights are on.\n'
    );
    const movie = addLinkedFilm(storage, folderId, {
      subtitles: [{ path: 'heat-1995/heat.en.srt', language: 'English' }],
    });
    const [track] = storage.getMovie(movie.id)?.subtitles ?? [];

    const response = await fetch(
      `${baseUrl}/api/movies/${movie.id}/subtitles/${track?.id}`
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { start: 1, end: 2.5, text: 'The lights are on.' },
    ]);
    // And it still plays from where it is linked.
    const stream = await streamed(`${baseUrl}/api/movies/${movie.id}/stream`);
    expect(stream.status).toBe(200);
  });
});

describe('the app never removes a linked video', () => {
  it('leaves a linked film’s video on disk after a Delete', async () => {
    const { storage, baseUrl, media, library, folderId } = freshApi();
    const file = placeFixture(library, LINKED_FILM);
    placeFile(media, 'heat-1995/poster.jpg', 'poster');
    const movie = addLinkedFilm(storage, folderId, {
      posterPath: 'heat-1995/poster.jpg',
    });
    expect(
      (await streamed(`${baseUrl}/api/movies/${movie.id}/stream`)).status
    ).toBe(200);

    const response = await fetch(`${baseUrl}/api/movies/${movie.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);
    expect(existsSync(join(media, 'heat-1995'))).toBe(false);
    expect(existsSync(file)).toBe(true);
  });

  it('leaves a linked episode’s video on disk after a series Delete', async () => {
    const { storage, baseUrl, library, folderId } = freshApi();
    const file = placeFixture(library, LINKED_EPISODE);
    const series = addLinkedSeries(storage, folderId);
    const [episode] = storage.listEpisodes(series.id);
    expect(
      (await streamed(`${baseUrl}/api/episodes/${episode?.id}/stream`)).status
    ).toBe(200);

    const response = await fetch(`${baseUrl}/api/series/${series.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);
    expect(existsSync(file)).toBe(true);
  });

  it('leaves every linked video on disk after a Factory reset', async () => {
    const { storage, baseUrl, library, folderId } = freshApi();
    const film = placeFixture(library, LINKED_FILM);
    const episodeFile = placeFixture(library, LINKED_EPISODE);
    const movie = addLinkedFilm(storage, folderId);
    addLinkedSeries(storage, folderId);
    expect(
      (await streamed(`${baseUrl}/api/movies/${movie.id}/stream`)).status
    ).toBe(200);

    const response = await fetch(`${baseUrl}/api/reset`, { method: 'POST' });

    expect(response.status).toBe(204);
    expect(storage.getMovie(movie.id)).toBeNull();
    expect(existsSync(film)).toBe(true);
    expect(existsSync(episodeFile)).toBe(true);
  });
});

describe('a managed file sharing a linked video’s relative path', () => {
  it('is never removed when an edit replaces the linked film’s video', async () => {
    const { storage, baseUrl, media, library, folderId } = freshApi();
    const linkedFile = placeFixture(library, LINKED_FILM);
    // Another title's managed file that happens to sit at the same relative
    // path under the media root.
    const namesake = placeFile(media, LINKED_FILM, 'a different film');
    const movie = addLinkedFilm(storage, folderId);

    const body = new FormData();
    body.append('title', 'Heat');
    body.append('year', '1995');
    body.append('director', '');
    body.append('description', '');
    body.append('rating', '');
    body.append(
      'video',
      new File([new Uint8Array(readFileSync(FIXTURE_VIDEO))], 'heat.mp4', {
        type: 'video/mp4',
      })
    );
    const response = await fetch(`${baseUrl}/api/movies/${movie.id}`, {
      method: 'PATCH',
      body,
    });

    expect(response.status).toBe(200);
    expect(existsSync(namesake)).toBe(true);
    expect(existsSync(linkedFile)).toBe(true);
  });

  it('is never removed when a series edit drops a linked episode', async () => {
    const { storage, baseUrl, media, library, folderId } = freshApi();
    const linkedFile = placeFixture(library, LINKED_EPISODE);
    const namesake = placeFile(media, LINKED_EPISODE, 'a different episode');
    placeFixture(media, 'harbor-and-vine-2019/season-01/S01E02.mp4');
    const series = storage.addSeries(
      {
        title: 'Harbor and Vine',
        year: 2019,
        mediaFolder: 'harbor-and-vine-2019',
      },
      [
        {
          season: 1,
          number: 1,
          videoPath: LINKED_EPISODE,
          videoFolderId: folderId,
        },
        {
          season: 1,
          number: 2,
          videoPath: 'harbor-and-vine-2019/season-01/S01E02.mp4',
        },
      ]
    );
    const kept = storage
      .listEpisodes(series.id)
      .find((episode) => episode.number === 2);

    const body = new FormData();
    body.append('title', 'Harbor and Vine');
    body.append('year', '2019');
    body.append('creator', '');
    body.append('description', '');
    body.append('rating', '');
    body.append(
      'episode',
      JSON.stringify({
        id: kept?.id,
        season: 1,
        number: 2,
        title: '',
        videoPath: kept?.videoPath,
        storedSubtitles: [],
        subtitleLanguages: [],
      })
    );
    const response = await fetch(`${baseUrl}/api/series/${series.id}`, {
      method: 'PATCH',
      body,
    });

    expect(response.status).toBe(200);
    expect(storage.listEpisodes(series.id)).toHaveLength(1);
    expect(existsSync(namesake)).toBe(true);
    expect(existsSync(linkedFile)).toBe(true);
  });
});
