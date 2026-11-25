// @vitest-environment node
//
// 76, Whole add, Phase 3 (issue #718): a show's found Season posters and
// Stills on the series add.
//
// `POST /api/series` takes a found **Season poster** as a `seasonPoster`
// field's `path` and a found **Still** as an `episode` field's `stillPath`,
// absolute paths checked by `foundPathRefusal` as `'image'`. Both are copied
// into `season-NN/` of the **Media folder**, Season posters by `copyFoundArt`,
// Stills by `copyFoundEpisodes`; a found Still is stored with the **Still
// source** `picked`, so a Sync never replaces it. A path that is relative or
// not an image is a `400` with nothing on disk.
//
// Over a real listener, a real `fetch`, a real `:memory:` library, a sandboxed
// media root, one listed Library folder `Shows/` beside it, and a show folder
// with its Season `Images/` built inside it.

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
import { idleFrameFill } from '../test-support/idleFrameFill/idleFrameFill';
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

/** A picked show: one episode, its Season poster and its Still. */
interface PickedShow {
  dir: string;
  pilot: string;
  seasonPoster: string;
  still: string;
}

/** Build _The Show_ inside `parent`, with its Season 01 `Images/`. */
function buildShow(parent: string): PickedShow {
  const dir = join(parent, 'The Show (2019)');
  mkdirSync(join(dir, 'Season 01', 'Images', 'Stills'), { recursive: true });
  const show: PickedShow = {
    dir,
    pilot: join(dir, 'Season 01', 'The.Show.S01E01.Pilot.mp4'),
    seasonPoster: join(dir, 'Season 01', 'Images', 'poster.jpg'),
    still: join(dir, 'Season 01', 'Images', 'Stills', 'S01E01.jpg'),
  };
  writeFileSync(show.pilot, 'pilot bytes');
  writeFileSync(show.seasonPoster, 'season poster bytes');
  writeFileSync(show.still, 'still bytes');
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

  const root = sandboxRoot('familyflix-add-series-season-art-');
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
      createLayoutFill({ storage, media: mediaDomain }),
      idleFrameFill()
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

/** The pilot's found row, with its found Still when `stillPath` is given. */
const pilotRow = (show: PickedShow, stillPath?: string): Part => [
  'episode',
  JSON.stringify({
    season: 1,
    number: 1,
    title: 'Pilot',
    subtitleLanguages: [],
    videoPath: show.pilot,
    storedSubtitles: [],
    ...(stillPath === undefined ? {} : { stillPath }),
  }),
];

/** A found Season poster's field. */
const seasonPosterField = (season: number, path: string): Part => [
  'seasonPoster',
  JSON.stringify({ season, path }),
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
  expect(readFileSync(show.seasonPoster).toString()).toBe(
    'season poster bytes'
  );
  expect(readFileSync(show.still).toString()).toBe('still bytes');
}

describe('POST /api/series: found Season posters and Stills', () => {
  it.each(['link', 'copy'])(
    'copies a found Season poster into season-01 of the Media folder (%s)',
    async (mode) => {
      const { storage, baseUrl, media, show } = freshApi();

      const response = await postSeries(baseUrl, [
        ['mode', mode],
        ...FIELDS,
        seasonPosterField(1, show.seasonPoster),
        pilotRow(show),
      ]);

      expect(response.status).toBe(201);
      const series = (await response.json()) as Series;
      const folder = storage.mediaFolderOf('series', series.id);
      expect(folder).not.toBeNull();
      const [season] = storage.getSeriesDetail(series.id)?.seasons ?? [];
      expect(season.posterPath).toBe(`${folder}/season-01/poster.jpg`);
      expect(
        readFileSync(join(media, season.posterPath as string)).toString()
      ).toBe('season poster bytes');
      expectShowUntouched(show);
    }
  );

  it.each(['link', 'copy'])(
    'copies a found Still into season-01 of the Media folder (%s)',
    async (mode) => {
      const { storage, baseUrl, media, show } = freshApi();

      const response = await postSeries(baseUrl, [
        ['mode', mode],
        ...FIELDS,
        pilotRow(show, show.still),
      ]);

      expect(response.status).toBe(201);
      const series = (await response.json()) as Series;
      const folder = storage.mediaFolderOf('series', series.id);
      expect(folder).not.toBeNull();
      const [pilot] = storage.listEpisodes(series.id);
      expect(pilot.stillPath).toBe(`${folder}/season-01/S01E01.jpg`);
      expect(
        readFileSync(join(media, pilot.stillPath as string)).toString()
      ).toBe('still bytes');
      expectShowUntouched(show);
    }
  );

  it('stores a found Still with the Still source picked', async () => {
    const { storage, baseUrl, show } = freshApi();

    const response = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      pilotRow(show, show.still),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const [pilot] = storage.listEpisodes(series.id);
    expect(storage.stillSourcesOf(series.id).get(pilot.id)).toBe('picked');
  });

  it('keeps a linked show’s video where it lies while copying its Still', async () => {
    const { storage, baseUrl, media, show } = freshApi();

    const response = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      pilotRow(show, show.still),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const [pilot] = storage.listEpisodes(series.id);
    expect(pilot.videoFolderId).not.toBeNull();
    expect(pilot.stillPath).not.toBeNull();
    expect(existsSync(join(media, pilot.stillPath as string))).toBe(true);
  });
});

describe('POST /api/series: a found Season poster or Still it will not take', () => {
  it.each([
    ['a relative Season poster', 'seasonPoster', 'Season 01/Images/poster.jpg'],
    ['a Season poster that is no image', 'seasonPoster', 'VIDEO'],
    ['a relative Still', 'still', 'Season 01/Images/Stills/S01E01.jpg'],
    ['a Still that is no image', 'still', 'VIDEO'],
  ])(
    'answers 400 for %s, writing no row and leaving no folder',
    async (_name, field, value) => {
      const { storage, baseUrl, media, show } = freshApi();
      const path = value === 'VIDEO' ? show.pilot : value;

      const response = await postSeries(baseUrl, [
        ['mode', 'link'],
        ...FIELDS,
        ...(field === 'seasonPoster'
          ? [seasonPosterField(1, path), pilotRow(show)]
          : [pilotRow(show, path)]),
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
