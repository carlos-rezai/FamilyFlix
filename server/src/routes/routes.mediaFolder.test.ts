// @vitest-environment node
//
// 41 — Link or copy, Slice 2: "the recorded folder" (issue #341).
//
// The routes over the recorded **Media folder**: every title the Movie form and
// a series add insert records its `media_folder` — read back through
// `storage.mediaFolderOf(kind, id)`, never on the wire — and a **Delete**
// removes that recorded folder through `Media.removeTitleFolder`, rather than
// a folder it reads off the title's video.
//
// The Delete tests store the video in a different managed folder from the
// recorded one on purpose: the two agree for every title this slice adds, so
// only a title whose video lies elsewhere — as a **Linked video** will — tells
// the two readings apart. Over a real listener, a real `:memory:` library and a
// sandboxed media root.

import express from 'express';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, posix } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia, type Media } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { FIXTURE_VIDEO } from '../test-support/fixtureVideo/fixtureVideo';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
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

/** A fresh library behind a listening API, composed the way `main.ts` does. */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  mediaDomain: Media;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const media = join(sandboxRoot('familyflix-media-folder-'), 'media');
  mkdirSync(media);
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
  return { storage, baseUrl: `http://127.0.0.1:${port}`, media, mediaDomain };
}

type Part = [name: string, value: string | File];

const video = (filename: string): File =>
  new File([new Uint8Array(readFileSync(FIXTURE_VIDEO))], filename, {
    type: 'video/mp4',
  });

function post(baseUrl: string, path: string, parts: Part[]) {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(`${baseUrl}${path}`, { method: 'POST', body });
}

const bytes = (text: string) => Readable.from([Buffer.from(text)]);

describe('the Movie form and a series add record the Media folder', () => {
  it('records a film added by the form in the Movie folder its files went to', async () => {
    const { storage, baseUrl, media } = freshApi();

    const response = await post(baseUrl, '/api/movies', [
      ['title', 'The Lantern Keeper'],
      ['year', '2019'],
      ['video', video('lantern.mp4')],
    ]);

    expect(response.status).toBe(201);
    const movie = (await response.json()) as Movie;
    const folder = storage.mediaFolderOf('movie', movie.id);
    expect(folder).toBe('the-lantern-keeper-2019');
    expect(posix.dirname(movie.videoPath)).toBe(folder);
    expect(existsSync(join(media, 'the-lantern-keeper-2019'))).toBe(true);
  });

  it('never puts the Media folder on the wire', async () => {
    const { baseUrl } = freshApi();

    const response = await post(baseUrl, '/api/movies', [
      ['title', 'The Lantern Keeper'],
      ['year', '2019'],
      ['video', video('lantern.mp4')],
    ]);
    const movie = (await response.json()) as Movie;
    const read = await fetch(`${baseUrl}/api/movies/${movie.id}`);

    expect(movie).not.toHaveProperty('mediaFolder');
    expect(await read.json()).not.toHaveProperty('mediaFolder');
  });

  it('records a series add in the Series folder its episodes went to', async () => {
    const { storage, baseUrl, media } = freshApi();

    const response = await post(baseUrl, '/api/series', [
      ['title', 'Harbor and Vine'],
      ['year', '2019'],
      [
        'episode',
        JSON.stringify({
          season: 1,
          number: 1,
          title: 'Pilot',
          subtitleLanguages: [],
        }),
      ],
      ['episodeVideo', video('S01E01.mp4')],
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const [episode] = storage.listEpisodes(series.id);
    const folder = storage.mediaFolderOf('series', series.id);
    expect(folder).not.toBeNull();
    expect(folder).toBe(posix.dirname(posix.dirname(episode?.videoPath ?? '')));
    expect(existsSync(join(media, folder ?? ''))).toBe(true);
  });
});

describe('a Delete removes the recorded Media folder', () => {
  it('removes a film’s recorded folder, not the one its video lies in', async () => {
    const { storage, baseUrl, media, mediaDomain } = freshApi();
    const recorded = mediaDomain.reserveFolder('The Lantern Keeper', 2019);
    const posterPath = await mediaDomain.storeUpload(
      recorded,
      'poster.jpg',
      bytes('poster')
    );
    const elsewhere = mediaDomain.reserveFolder('Elsewhere', null);
    const videoPath = await mediaDomain.storeUpload(
      elsewhere,
      'lantern.mp4',
      bytes('video')
    );
    const movie = storage.addMovie({
      title: 'The Lantern Keeper',
      year: 2019,
      videoPath,
      posterPath,
      mediaFolder: 'the-lantern-keeper-2019',
    });

    const response = await fetch(`${baseUrl}/api/movies/${movie.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);
    expect(existsSync(join(media, 'the-lantern-keeper-2019'))).toBe(false);
  });

  it('removes a series’ recorded folder, not the one its episodes lie in', async () => {
    const { storage, baseUrl, media, mediaDomain } = freshApi();
    const recorded = mediaDomain.reserveFolder('Harbor and Vine', 2019);
    const posterPath = await mediaDomain.storeUpload(
      recorded,
      'poster.jpg',
      bytes('poster')
    );
    const elsewhere = mediaDomain.reserveFolder('Elsewhere', null);
    const videoPath = await mediaDomain.storeUpload(
      mediaDomain.seasonFolder(elsewhere, 1),
      'S01E01.mp4',
      bytes('video')
    );
    const series = storage.addSeries(
      {
        title: 'Harbor and Vine',
        year: 2019,
        posterPath,
        mediaFolder: 'harbor-and-vine-2019',
      },
      [{ season: 1, number: 1, videoPath }]
    );

    const response = await fetch(`${baseUrl}/api/series/${series.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);
    expect(existsSync(join(media, 'harbor-and-vine-2019'))).toBe(false);
  });
});
