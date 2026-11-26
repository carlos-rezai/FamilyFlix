// @vitest-environment node
//
// 76, Whole add (issue #727): a series add reads its found art as the movie
// add does.
//
// A picked `poster` / `backdrop` part beats a found `posterPath` /
// `backdropPath` for its slot, and the found file is never copied: no file is
// left in the **Media folder** that no row points at. An empty field is no
// found file, an empty slot, not a `400`.
//
// Over a real listener, a real `fetch`, a real `:memory:` library, a sandboxed
// media root, one listed Library folder `Shows/` beside it, and a show folder
// with its `Images/` built inside it.

import express from 'express';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, posix } from 'node:path';
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
      idleFrameFill()
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, media, show };
}

type Part = [name: string, value: string | File];
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

/** A picked image part, its bytes named for its slot. */
const pickedPart = (slot: string): File =>
  new File(
    [new Uint8Array(Buffer.from(`picked ${slot} bytes`))],
    `picked-${slot}.jpg`,
    {
      type: 'image/jpeg',
    }
  );

describe('POST /api/series: a picked part beats a found path', () => {
  it.each([
    ['poster', 'posterPath'],
    ['backdrop', 'backdropPath'],
  ] as const)(
    'stores the picked %s and copies nothing for its path',
    async (slot, field) => {
      const { storage, baseUrl, media, show } = freshApi();

      const response = await postSeries(baseUrl, [
        ['mode', 'link'],
        ...FIELDS,
        [slot, pickedPart(slot)],
        [field, show[slot]],
        pilotRow(show),
      ]);

      expect(response.status).toBe(201);
      const series = (await response.json()) as Series;
      const stored = series[field];
      expect(stored).not.toBeNull();
      expect(readFileSync(join(media, stored as string)).toString()).toBe(
        `picked ${slot} bytes`
      );
      const folder = storage.mediaFolderOf('series', series.id) as string;
      const files = readdirSync(join(media, folder), { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);
      expect(files).toEqual([posix.basename(stored as string)]);
    }
  );
});

describe('POST /api/series: an empty found path', () => {
  it.each(['posterPath', 'backdropPath'] as const)(
    'reads an empty %s as an empty slot',
    async (field) => {
      const { baseUrl, show } = freshApi();

      const response = await postSeries(baseUrl, [
        ['mode', 'link'],
        ...FIELDS,
        [field, ''],
        pilotRow(show),
      ]);

      expect(response.status).toBe(201);
      const series = (await response.json()) as Series;
      expect(series[field]).toBeNull();
    }
  );
});
