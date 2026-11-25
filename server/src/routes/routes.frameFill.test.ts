// @vitest-environment node
//
// 76, Whole add, Phase 5 (issue #720): the Frame fill after a series save.
//
// The **Frame fill** is made by the composition root and injected into
// `createApiRouter` as `frameFill`, as `layoutFill` is. `POST /series` and
// `PATCH /series/:id` start it after the Layout fill and answer without
// waiting, so the save answers at once (nothing is drawn for the fill) and
// the Stills land after. A movie add starts none. The fill carries its own
// Playback: the router's has no component, so a Still that lands came
// through the injected fill. A linked show's Frame stills live only in its
// **Series folder**; nothing is written into its Library folder.
//
// Over a real listener composed the way `main.ts` does, a real `:memory:`
// library, a sandboxed media root, a listed Library folder `Shows/` and a
// scripted `frame` behind a door.

import express from 'express';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, relative } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createFrameFill } from '../enrichment/createFrameFill/createFrameFill';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import {
  createPlayback,
  type Playback,
} from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { FIXTURE_VIDEO } from '../test-support/fixtureVideo/fixtureVideo';
import { framelessPlayback } from '../test-support/framelessPlayback/framelessPlayback';
import { idleFrameFill } from '../test-support/idleFrameFill/idleFrameFill';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../test-support/unfittedArt/unfittedArt';
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

type Frame = Playback['frame'];

const SHOW = 'Harbor and Vine (2021)';
const EPISODE_FILES = [
  `${SHOW}/Season 01/Harbor.and.Vine.S01E01.mp4`,
  `${SHOW}/Season 01/Harbor.and.Vine.S01E02.mp4`,
];

/** A door the scripted frame waits behind until it is opened. */
function door() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

/**
 * A fresh library behind a listening API, composed the way `main.ts` does,
 * with a Frame fill whose `frame` waits behind `held` — and a spy on its
 * `fill`, to see which saves start one.
 */
function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-frame-fill-route-');
  const media = join(root, 'media');
  const shows = join(root, 'Shows');
  mkdirSync(media);
  for (const file of EPISODE_FILES) {
    const at = join(shows, ...file.split('/'));
    mkdirSync(join(at, '..'), { recursive: true });
    copyFileSync(FIXTURE_VIDEO, at);
  }
  copyFileSync(FIXTURE_VIDEO, join(root, 'heat.mp4'));
  const folderId = storage.addLibraryFolder(shows).id;

  const mediaDomain = createMedia(media, unfittedArt());
  // The router's own Playback has no component: it takes no frame.
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) => storage.libraryFolders().find((f) => f.id === id)?.path ?? null
  );

  const held = door();
  const frame = vi.fn<Frame>(async () => {
    await held.opened;
    return {
      kind: 'frame',
      picture: Readable.from([Buffer.from('a frame off the video')]),
    };
  });
  const realFill = createFrameFill({
    storage,
    media: mediaDomain,
    playback: framelessPlayback(frame),
  });
  const frameFill = { fill: vi.fn((id: string) => realFill.fill(id)) };

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
      frameFill
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    root,
    media,
    shows,
    folderId,
    held,
    frame,
    frameFill,
  };
}

type Part = [name: string, value: string | File];

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

const SERIES_FIELDS: Part[] = [
  ['title', 'Harbor and Vine'],
  ['year', '2021'],
  ['creator', ''],
  ['description', ''],
  ['rating', ''],
];

/** A found row: its video where it lies under `Shows/`. */
const foundEpisode = (shows: string, index: number): Part => [
  'episode',
  JSON.stringify({
    season: 1,
    number: index + 1,
    title: `Episode ${index + 1}`,
    subtitleLanguages: [],
    videoPath: join(shows, ...EPISODE_FILES[index].split('/')),
    storedSubtitles: [],
  }),
];

/** A held episode's `episode` field, its video as the path it has. */
const heldEpisode = (episode: Episode): Part => [
  'episode',
  JSON.stringify({
    id: episode.id,
    season: episode.season,
    number: episode.number,
    title: episode.title ?? '',
    videoPath: episode.videoPath,
    storedSubtitles: [],
    subtitleLanguages: [],
  }),
];

/** Every file under a directory, relative to it, sorted. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const full = join(at, name);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(relative(dir, full));
    }
  };
  walk(dir);
  return found.sort();
}

const stillsOf = (storage: LibraryStorage, id: string) =>
  storage.listEpisodes(id).map((each) => each.stillPath);

/** The Stills a finished fill writes: each episode's frame, in its folder. */
function expectFramesLanded(storage: LibraryStorage, id: string) {
  const folder = storage.mediaFolderOf('series', id);
  expect(folder).not.toBeNull();
  expect(stillsOf(storage, id)).toEqual([
    `${folder}/season-01/Harbor.and.Vine.S01E01.frame.jpg`,
    `${folder}/season-01/Harbor.and.Vine.S01E02.frame.jpg`,
  ]);
  for (const episode of storage.listEpisodes(id)) {
    expect(storage.stillSourcesOf(id).get(episode.id)).toBe('frame');
  }
}

describe('POST /api/series: the Frame fill after the add', () => {
  it('answers before the fill ends, and the Stills land after', async () => {
    const { storage, baseUrl, shows, held, frame } = freshApi();

    const response = await send(`${baseUrl}/api/series`, 'POST', [
      ['mode', 'link'],
      ...SERIES_FIELDS,
      foundEpisode(shows, 0),
      foundEpisode(shows, 1),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    // Answered while the first take is still held behind the door.
    expect(stillsOf(storage, series.id)).toEqual([null, null]);

    await vi.waitFor(() => expect(frame).toHaveBeenCalledTimes(1));
    held.open();
    await vi.waitFor(() => expectFramesLanded(storage, series.id));
  });

  it('writes a linked show’s Frame stills only into its Series folder, none into its Library folder', async () => {
    const { storage, baseUrl, shows, held } = freshApi();
    const before = filesUnder(shows);

    const response = await send(`${baseUrl}/api/series`, 'POST', [
      ['mode', 'link'],
      ...SERIES_FIELDS,
      foundEpisode(shows, 0),
      foundEpisode(shows, 1),
    ]);
    const series = (await response.json()) as Series;
    held.open();
    await vi.waitFor(() => expectFramesLanded(storage, series.id));

    expect(filesUnder(shows)).toEqual(before);
  });
});

describe('PATCH /api/series/:id: the Frame fill after the edit', () => {
  it('answers before the fill ends, and the Stills land after', async () => {
    const { storage, baseUrl, folderId, held, frame, frameFill } = freshApi();
    const series = storage.addSeries(
      { title: 'Harbor and Vine', year: 2021 },
      EPISODE_FILES.map((videoPath, index) => ({
        season: 1,
        number: index + 1,
        title: `Episode ${index + 1}`,
        videoPath,
        videoFolderId: folderId,
      }))
    );

    const response = await send(`${baseUrl}/api/series/${series.id}`, 'PATCH', [
      ...SERIES_FIELDS,
      ...storage.listEpisodes(series.id).map((episode) => heldEpisode(episode)),
    ]);

    expect(response.status).toBe(200);
    expect(frameFill.fill).toHaveBeenCalledWith(series.id);
    expect(stillsOf(storage, series.id)).toEqual([null, null]);

    await vi.waitFor(() => expect(frame).toHaveBeenCalledTimes(1));
    held.open();
    await vi.waitFor(() => expectFramesLanded(storage, series.id));
  });
});

describe('POST /api/movies: no Frame fill', () => {
  it('starts no fill for a movie add', async () => {
    const { storage, baseUrl, root, frame, frameFill } = freshApi();

    const response = await send(`${baseUrl}/api/movies`, 'POST', [
      ['mode', 'copy'],
      ['title', 'Heat'],
      ['year', '1995'],
      ['director', ''],
      ['description', ''],
      ['rating', ''],
      ['videoPath', join(root, 'heat.mp4')],
    ]);

    expect(response.status).toBe(201);
    const movie = (await response.json()) as Movie;
    expect(storage.getMovie(movie.id)).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(frameFill.fill).not.toHaveBeenCalled();
    expect(frame).not.toHaveBeenCalled();
  });
});
