// @vitest-environment node
//
// 60, Rebuild edges, Phase 13 (issue #576): the series add refuses a held
// video.
//
// `POST /api/series` linking an episode video a held title already plays is
// refused by the **Held video** rule as the movie add is, `409` _<Title>
// already plays this file._, before anything is written: no second series, no
// episode row, nothing in managed storage, and so no numbered
// `Tidewater (2018) (1)` **Folder key** in the **Library sheet**. The ticket's
// repro (QA 562): `Tidewater (2018)/Season 01/` added once, then the same two
// videos posted again.
//
// Over a real listener, a real `fetch`, a real `:memory:` library, a sandboxed
// media root, one listed Library folder `Shows/` holding the show, and a real
// Library sheet writer flushed by hand.

import express from 'express';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import {
  createLibrarySheet,
  LIBRARY_SHEET,
} from '../import-export/createLibrarySheet/createLibrarySheet';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
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

/**
 * The bytes of an MP4 that reports its own length (`ftyp`, then a `moov`
 * holding a version-0 `mvhd`), so a runtime is derived with no component
 * installed.
 */
function mp4Of(seconds: number): Buffer {
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt8(0, 0);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16);

  const box = (type: string, payload: Buffer): Buffer => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(8 + payload.length, 0);
    header.write(type, 4, 'latin1');
    return Buffer.concat([header, payload]);
  };

  return Buffer.concat([
    box('ftyp', Buffer.from('isom', 'latin1')),
    box('moov', box('mvhd', mvhd)),
  ]);
}

/**
 * A fresh library behind a listening API, composed the way `main.ts` does,
 * over a listed Library folder `Shows/` holding `Tidewater (2018)/Season 01/`
 * with two episodes.
 */
function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-add-series-held-');
  const media = join(root, 'media');
  const shows = join(root, 'Shows');
  const season = join(shows, 'Tidewater (2018)', 'Season 01');
  mkdirSync(media);
  mkdirSync(season, { recursive: true });
  const folderId = storage.addLibraryFolder(shows).id;
  const pilot = join(season, 'Tidewater.S01E01.Pilot.mp4');
  const undertow = join(season, 'Tidewater.S01E02.Undertow.mp4');
  writeFileSync(pilot, mp4Of(2520));
  writeFileSync(undertow, mp4Of(2700));

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
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    media,
    shows,
    folderId,
    pilot,
    undertow,
  };
}

type Part = [name: string, value: string];

const foundEpisode = (
  number: number,
  title: string,
  videoPath: string
): Part => [
  'episode',
  JSON.stringify({
    season: 1,
    number,
    title,
    subtitleLanguages: [],
    videoPath,
    storedSubtitles: [],
  }),
];

function postTidewater(
  baseUrl: string,
  episodes: readonly Part[]
): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of [
    ['mode', 'link'],
    ['title', 'Tidewater'],
    ['year', '2018'],
    ['creator', ''],
    ['description', ''],
    ['rating', ''],
    ...episodes,
  ] as Part[]) {
    body.append(name, value);
  }
  return fetch(`${baseUrl}/api/series`, { method: 'POST', body });
}

/** Every entry under a directory, relative to it, with forward slashes. */
function entriesUnder(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .map((entry) => entry.split(/[\\/]/).join('/'))
    .sort();
}

describe('POST /api/series: a held episode video', () => {
  it('is a 409 naming the series that plays it', async () => {
    const { baseUrl, pilot, undertow } = freshApi();
    const first = await postTidewater(baseUrl, [
      foundEpisode(1, 'Pilot', pilot),
      foundEpisode(2, 'Undertow', undertow),
    ]);
    expect(first.status).toBe(201);

    const again = await postTidewater(baseUrl, [
      foundEpisode(1, 'Pilot', pilot),
      foundEpisode(2, 'Undertow', undertow),
    ]);

    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({
      error: 'Tidewater already plays this file.',
    });
  });

  it('is refused when only a later episode video is held', async () => {
    const { baseUrl, pilot, undertow } = freshApi();
    const first = await postTidewater(baseUrl, [
      foundEpisode(2, 'Undertow', undertow),
    ]);
    expect(first.status).toBe(201);

    const again = await postTidewater(baseUrl, [
      foundEpisode(1, 'Pilot', pilot),
      foundEpisode(2, 'Undertow', undertow),
    ]);

    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({
      error: 'Tidewater already plays this file.',
    });
  });

  it('leaves no second series, no episode row and nothing in managed storage', async () => {
    const { storage, baseUrl, media, pilot, undertow } = freshApi();
    const first = await postTidewater(baseUrl, [
      foundEpisode(1, 'Pilot', pilot),
      foundEpisode(2, 'Undertow', undertow),
    ]);
    const held = (await first.json()) as Series;
    const episodesBefore = storage.listEpisodes(held.id);
    const mediaBefore = entriesUnder(media);

    const again = await postTidewater(baseUrl, [
      foundEpisode(1, 'Pilot', pilot),
      foundEpisode(2, 'Undertow', undertow),
    ]);

    expect(again.status).toBe(409);
    expect(storage.getSeriesHome().series.map((s) => s.id)).toEqual([held.id]);
    expect(storage.listEpisodes(held.id)).toEqual(episodesBefore);
    expect(entriesUnder(media)).toEqual(mediaBefore);
  });

  it('leaves no numbered Tidewater (2018) (1) Folder key in the Library sheet', async () => {
    const { storage, baseUrl, shows, folderId, pilot, undertow } = freshApi();
    await postTidewater(baseUrl, [
      foundEpisode(1, 'Pilot', pilot),
      foundEpisode(2, 'Undertow', undertow),
    ]);
    await postTidewater(baseUrl, [
      foundEpisode(1, 'Pilot', pilot),
      foundEpisode(2, 'Undertow', undertow),
    ]);

    // A Library sheet is written only for a folder once scanned.
    storage.markScanned([folderId], '2026-11-10T00:00:00.000Z');
    const writer = createLibrarySheet({ storage });
    writer.touch([folderId]);
    await writer.flush();

    const sheet = readFileSync(join(shows, LIBRARY_SHEET), 'utf8');
    expect(sheet).toContain('Tidewater (2018)');
    expect(sheet).not.toContain('Tidewater (2018) (1)');
  });
});
