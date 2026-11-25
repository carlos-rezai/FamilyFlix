// @vitest-environment node
//
// 76, Whole add, Phase 2 (issue #717): a show's found art on the series add.
//
// `POST /api/series` takes a found **Poster** and **Backdrop** as the
// `posterPath` and `backdropPath` fields, absolute paths checked by
// `foundPathRefusal` as `'image'`. Both are always copied, through
// `copyFoundArt`, into the **Media folder** root: an add whose only copies
// are images still reserves a Media folder, also for a linked show. A path
// that is relative or not an image is a `400` with nothing on disk; a copy
// that breaks fails the save and takes the folder back.
//
// Over a real listener, a real `fetch`, a real `:memory:` library, a sandboxed
// media root, one listed Library folder `Shows/` beside it, and a show folder
// with its `Images/` built inside it.

import express from 'express';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
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
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../test-support/unfittedArt/unfittedArt';
import type { Series } from '@/types';

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

/** A picked show: one episode, its poster and its backdrop. */
interface PickedShow {
  dir: string;
  pilot: string;
  poster: string;
  backdrop: string;
}

/** Build _The Show_ inside `parent`, with its `Images/`. */
function buildShow(parent: string): PickedShow {
  const dir = join(parent, 'The Show (2019)');
  mkdirSync(join(dir, 'Season 01'), { recursive: true });
  mkdirSync(join(dir, 'Images'), { recursive: true });
  const show: PickedShow = {
    dir,
    pilot: join(dir, 'Season 01', 'The.Show.S01E01.Pilot.mp4'),
    poster: join(dir, 'Images', 'poster.jpg'),
    backdrop: join(dir, 'Images', 'backdrop.jpg'),
  };
  writeFileSync(show.pilot, 'pilot bytes');
  writeFileSync(show.poster, 'poster bytes');
  writeFileSync(show.backdrop, 'backdrop bytes');
  return show;
}

/** A fresh library behind a listening API, composed the way `main.ts` does. */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  show: PickedShow;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-add-series-found-art-');
  const media = join(root, 'media');
  const shows = join(root, 'Shows');
  mkdirSync(media);
  mkdirSync(shows);
  storage.addLibraryFolder(shows);
  const show = buildShow(shows);

  const mediaDomain = createMedia(media, unfittedArt());
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
        layoutFill: createLayoutFill({ storage, media: mediaDomain }),
      }),
      createLayoutFill({ storage, media: mediaDomain })
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, media, show };
}

type Part = [name: string, value: string];

const FIELDS: Part[] = [
  ['title', 'The Show'],
  ['year', '2019'],
  ['creator', ''],
  ['description', ''],
  ['rating', ''],
];

/** The pilot's found row. */
const pilotRow = (show: PickedShow): Part => [
  'episode',
  JSON.stringify({
    season: 1,
    number: 1,
    title: 'Pilot',
    subtitleLanguages: [],
    videoPath: show.pilot,
    storedSubtitles: [],
  }),
];

function postSeries(baseUrl: string, parts: Part[]): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(`${baseUrl}/api/series`, { method: 'POST', body });
}

/** The show's files are all where they were, byte for byte. */
function expectShowUntouched(show: PickedShow) {
  expect(readFileSync(show.pilot).toString()).toBe('pilot bytes');
  expect(readFileSync(show.poster).toString()).toBe('poster bytes');
  expect(readFileSync(show.backdrop).toString()).toBe('backdrop bytes');
}

describe('POST /api/series: found art', () => {
  it.each(['link', 'copy'])(
    'copies the found poster and backdrop into a reserved Media folder (%s)',
    async (mode) => {
      const { storage, baseUrl, media, show } = freshApi();

      const response = await postSeries(baseUrl, [
        ['mode', mode],
        ...FIELDS,
        ['posterPath', show.poster],
        ['backdropPath', show.backdrop],
        pilotRow(show),
      ]);

      expect(response.status).toBe(201);
      const series = (await response.json()) as Series;
      const folder = storage.mediaFolderOf('series', series.id);
      expect(folder).not.toBeNull();
      expect(series.posterPath).toBe(`${folder}/poster.jpg`);
      expect(series.backdropPath).toBe(`${folder}/backdrop.jpg`);
      expect(
        readFileSync(join(media, series.posterPath as string)).toString()
      ).toBe('poster bytes');
      expect(
        readFileSync(join(media, series.backdropPath as string)).toString()
      ).toBe('backdrop bytes');
      expectShowUntouched(show);
    }
  );

  it('keeps a linked show’s videos where they lie while copying its art', async () => {
    const { storage, baseUrl, media, show } = freshApi();

    const response = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      ['posterPath', show.poster],
      pilotRow(show),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const [pilot] = storage.listEpisodes(series.id);
    expect(pilot.videoFolderId).not.toBeNull();
    expect(series.posterPath).not.toBeNull();
    expect(existsSync(join(media, series.posterPath as string))).toBe(true);
  });
});

describe('POST /api/series: a found image it will not take', () => {
  it.each([
    ['a relative poster', 'posterPath', 'Images/poster.jpg'],
    ['a relative backdrop', 'backdropPath', 'Images/backdrop.jpg'],
    ['a poster that is no image', 'posterPath', 'VIDEO'],
    ['a backdrop that is no image', 'backdropPath', 'VIDEO'],
  ])(
    'answers 400 for %s, writing no row and leaving no folder',
    async (_name, field, value) => {
      const { storage, baseUrl, media, show } = freshApi();

      const response = await postSeries(baseUrl, [
        ['mode', 'link'],
        ...FIELDS,
        [field, value === 'VIDEO' ? show.pilot : value],
        pilotRow(show),
      ]);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: expect.stringMatching(/^Not an? /),
      });
      expect(storage.getSeriesHome().series).toEqual([]);
      expect(readdirSync(media)).toEqual([]);
      expectShowUntouched(show);
    }
  );
});

describe('POST /api/series: a found image that cannot be copied', () => {
  it('fails the save and takes the Media folder back', async () => {
    const { storage, baseUrl, media, show } = freshApi();

    const response = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      ['posterPath', show.poster],
      ['backdropPath', join(show.dir, 'Images', 'gone-backdrop.jpg')],
      pilotRow(show),
    ]);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Could not add the series',
    });
    expect(storage.getSeriesHome().series).toEqual([]);
    expect(readdirSync(media)).toEqual([]);
    expectShowUntouched(show);
  });
});
