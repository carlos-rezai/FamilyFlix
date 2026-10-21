// @vitest-environment node
//
// 48 — Add a show folder, Phase 2 (issue #418): `POST /api/series` links by
// default.
//
// The body's first field is a required `mode` — `link` or `copy`, one of
// **IMPORT_MODES** — refused in one sentence when missing or unknown,
// `importBody`'s precedent. Each found video goes through `placeFoundVideo`:
// in **Link**, one under a listed **Library folder** is recorded as a
// **Linked video** where it lies, nothing copied; a `null` is copied as in
// #417. Found subtitles are always copied in, and a picked row is always its
// bytes. A Link path under no listed folder is `400` _Link needs a file
// inside one of your library folders._
//
// A show from a folder under a listed Library folder records it as its
// **Show folder**, in both modes, so a later **Folder scan** reads it as
// **Already in library**. A failed or refused add removes the reserved
// **Series folder** and never touches a linked file.
//
// Over a real listener, a real `fetch`, a real `:memory:` library, a sandboxed
// media root, one listed Library folder `Shows/` beside it, and a show folder
// built inside it.

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
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { ImportRun, Series } from '@/types';

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
 * The bytes of an MP4 that reports its own length — `ftyp`, then a `moov`
 * holding a version-0 `mvhd` — so a runtime is derived with no component
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

/** A picked show: two Season folders and one track. */
interface PickedShow {
  dir: string;
  pilot: string;
  pilotTrack: string;
  lowTide: string;
  springTide: string;
}

/** Build _Harbor and Vine_ inside `parent`. */
function buildShow(parent: string): PickedShow {
  const dir = join(parent, 'Harbor and Vine');
  const seasonOne = join(dir, 'Season 1');
  const seasonTwo = join(dir, 'Season 2');
  mkdirSync(seasonOne, { recursive: true });
  mkdirSync(seasonTwo, { recursive: true });
  const show: PickedShow = {
    dir,
    pilot: join(seasonOne, 'Harbor.and.Vine.S01E01.Pilot.mp4'),
    pilotTrack: join(seasonOne, 'Harbor.and.Vine.S01E01.Pilot.pt.srt'),
    lowTide: join(seasonOne, 'Harbor.and.Vine.S01E02.Low.Tide.mp4'),
    springTide: join(seasonTwo, 'Harbor.and.Vine.S02E01.Spring.Tide.mp4'),
  };
  writeFileSync(show.pilot, mp4Of(2520));
  writeFileSync(show.pilotTrack, '1\n00:00:01,000 --> 00:00:02,000\nOlá\n');
  writeFileSync(show.lowTide, mp4Of(2700));
  writeFileSync(show.springTide, mp4Of(3000));
  return show;
}

/**
 * A fresh library behind a listening API, composed the way `main.ts` does: a
 * managed media root, a listed Library folder `Shows/` holding the show, and a
 * second copy of the show in `Downloads/`, under no listed folder.
 */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  folderId: string;
  show: PickedShow;
  unlisted: PickedShow;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-add-series-linked-');
  const media = join(root, 'media');
  const shows = join(root, 'Shows');
  const downloads = join(root, 'Downloads');
  mkdirSync(media);
  mkdirSync(shows);
  mkdirSync(downloads);
  const folderId = storage.addLibraryFolder(shows).id;
  const show = buildShow(shows);
  const unlisted = buildShow(downloads);

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
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    media,
    folderId,
    show,
    unlisted,
  };
}

type Part = [name: string, value: string | File];

/** A folder row's `episode` field: its found video, and its found tracks. */
const foundEpisode = (
  season: number,
  number: number,
  title: string,
  videoPath: string,
  storedSubtitles: { path: string; language: string }[] = []
): Part => [
  'episode',
  JSON.stringify({
    season,
    number,
    title,
    subtitleLanguages: [],
    videoPath,
    storedSubtitles,
  }),
];

/** A picked row's `episode` field; its `episodeVideo` part follows it. */
const pickedEpisode = (season: number, number: number, title: string): Part => [
  'episode',
  JSON.stringify({ season, number, title, subtitleLanguages: [] }),
];

const videoPart = (filename: string, seconds = 2520): File =>
  new File([new Uint8Array(mp4Of(seconds))], filename, { type: 'video/mp4' });

const FIELDS: Part[] = [
  ['title', 'Harbor and Vine'],
  ['year', '2019'],
  ['creator', ''],
  ['description', ''],
  ['rating', ''],
];

/** The show's three found rows, the pilot's track with it. */
const showRows = (show: PickedShow): Part[] => [
  foundEpisode(1, 1, 'Pilot', show.pilot, [
    { path: show.pilotTrack, language: 'Portuguese' },
  ]),
  foundEpisode(1, 2, 'Low Tide', show.lowTide),
  foundEpisode(2, 1, 'Spring Tide', show.springTide),
];

function postSeries(baseUrl: string, parts: Part[]): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(`${baseUrl}/api/series`, { method: 'POST', body });
}

/** Every file under a directory, relative to it, with forward slashes. */
function filesUnder(dir: string): string[] {
  return (
    readdirSync(dir, { recursive: true, withFileTypes: true }) as {
      isFile(): boolean;
      name: string;
      parentPath: string;
    }[]
  )
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(dir.length + 1)
        .split(/[\\/]/)
        .join('/')
    )
    .sort();
}

/** Every file of the show, as its bytes, by path. */
function showBytes(show: PickedShow): Map<string, string> {
  return new Map(
    [show.pilot, show.pilotTrack, show.lowTide, show.springTide].map((path) => [
      path,
      readFileSync(path).toString('base64'),
    ])
  );
}

/** The show's files are all where they were, byte for byte. */
function expectShowUntouched(before: Map<string, string>) {
  for (const [path, bytes] of before) {
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path).toString('base64')).toBe(bytes);
  }
}

describe('POST /api/series — Link', () => {
  it('records each found video as a Linked video where it lies, copying none and leaving the show alone', async () => {
    const { storage, baseUrl, media, folderId, show } = freshApi();
    const before = showBytes(show);

    const response = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      ...showRows(show),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    expect(
      storage
        .listEpisodes(series.id)
        .map((episode) => [
          episode.season,
          episode.number,
          episode.videoPath,
          episode.videoFolderId,
        ])
    ).toEqual([
      [
        1,
        1,
        'Harbor and Vine/Season 1/Harbor.and.Vine.S01E01.Pilot.mp4',
        folderId,
      ],
      [
        1,
        2,
        'Harbor and Vine/Season 1/Harbor.and.Vine.S01E02.Low.Tide.mp4',
        folderId,
      ],
      [
        2,
        1,
        'Harbor and Vine/Season 2/Harbor.and.Vine.S02E01.Spring.Tide.mp4',
        folderId,
      ],
    ]);
    expect(filesUnder(media).filter((file) => file.endsWith('.mp4'))).toEqual(
      []
    );
    expectShowUntouched(before);
  });

  it('plays each linked episode from where it lies', async () => {
    const { storage, baseUrl, show } = freshApi();

    const response = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      ...showRows(show),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const [pilot] = storage.listEpisodes(series.id);
    // The file where it lies is the one played: a copy would play the old
    // bytes.
    const replaced = mp4Of(1234);
    writeFileSync(show.pilot, replaced);
    const stream = await fetch(`${baseUrl}/api/episodes/${pilot.id}/stream`);
    expect(stream.status).toBe(200);
    expect(Buffer.from(await stream.arrayBuffer()).equals(replaced)).toBe(true);
  });

  it('still copies each found track into the Series folder beside a linked video', async () => {
    const { storage, baseUrl, media, folderId, show } = freshApi();

    const response = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      ...showRows(show),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const [pilot] = storage.listEpisodes(series.id);
    expect(pilot.videoFolderId).toBe(folderId);
    const [track] = pilot.subtitles;
    expect(track.language).toBe('Portuguese');
    expect(track.path).toMatch(/^harbor-and-vine-2019\/season-01\/[^/]+$/);
    expect(readFileSync(join(media, track.path), 'utf8')).toBe(
      readFileSync(show.pilotTrack, 'utf8')
    );
  });

  it('copies a picked row’s bytes in the same linked save', async () => {
    const { storage, baseUrl, media, folderId, show } = freshApi();

    const response = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      foundEpisode(1, 1, 'Pilot', show.pilot),
      pickedEpisode(1, 3, 'The Night Market'),
      ['episodeVideo', videoPart('Harbor.and.Vine.S01E03.mp4', 2880)],
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const [pilot, nightMarket] = storage.listEpisodes(series.id);
    expect(pilot.videoFolderId).toBe(folderId);
    expect(nightMarket.videoFolderId).toBeNull();
    expect(nightMarket.videoPath).toMatch(
      /^harbor-and-vine-2019\/season-01\/[^/]+$/
    );
    expect(existsSync(join(media, nightMarket.videoPath))).toBe(true);
  });
});

describe('POST /api/series — Copy', () => {
  it('copies each found video into its season-NN/ as before, and records the Show folder', async () => {
    const { storage, baseUrl, media, folderId, show } = freshApi();

    const response = await postSeries(baseUrl, [
      ['mode', 'copy'],
      ...FIELDS,
      ...showRows(show),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const episodes = storage.listEpisodes(series.id);
    expect(episodes.map((episode) => episode.videoFolderId)).toEqual([
      null,
      null,
      null,
    ]);
    for (const episode of episodes) {
      expect(episode.videoPath).toMatch(
        /^harbor-and-vine-2019\/season-0[12]\/[^/]+$/
      );
      expect(existsSync(join(media, episode.videoPath))).toBe(true);
    }
    expect(storage.titleSource(series.id)).toMatchObject({
      folderId,
      sourceFolder: 'Harbor and Vine',
    });
  });
});

describe('POST /api/series — the Show folder', () => {
  it('records the show’s folder under its Library folder in Link', async () => {
    const { storage, baseUrl, folderId, show } = freshApi();

    const response = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      ...showRows(show),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    expect(storage.titleSource(series.id)).toMatchObject({
      folderId,
      sourceFolder: 'Harbor and Vine',
    });
  });

  it('records one only for the show under a Library folder, nothing for the one under none', async () => {
    const { storage, baseUrl, folderId, show, unlisted } = freshApi();

    const outside = await postSeries(baseUrl, [
      ['mode', 'copy'],
      ...FIELDS,
      ...showRows(unlisted),
    ]);
    const inside = await postSeries(baseUrl, [
      ['mode', 'copy'],
      ['title', 'Harbor and Vine Again'],
      ['year', '2020'],
      ['creator', ''],
      ['description', ''],
      ['rating', ''],
      ...showRows(show),
    ]);

    expect(outside.status).toBe(201);
    expect(inside.status).toBe(201);
    const outsideSeries = (await outside.json()) as Series;
    const insideSeries = (await inside.json()) as Series;
    expect(storage.titleSource(outsideSeries.id)).toBeNull();
    expect(storage.titleSource(insideSeries.id)).toMatchObject({
      folderId,
      sourceFolder: 'Harbor and Vine',
    });
  });

  it('is Already in library to a Folder scan after a linked add', async () => {
    const { storage, baseUrl, show } = freshApi();
    const added = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      ...showRows(show),
    ]);
    expect(added.status).toBe(201);
    const series = (await added.json()) as Series;
    const before = storage.listEpisodes(series.id);

    const scan = await fetch(`${baseUrl}/api/library-folders/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrich: false, mode: 'link' }),
    });
    expect(scan.status).toBe(201);
    const run = await untilReview(baseUrl);

    expect(run).toMatchObject({ matched: 0, problems: [] });
    expect(run.log.map((line) => line.text)).toContainEqual(
      expect.stringMatching(/Already in library Harbor and Vine/)
    );
    expect(storage.getSeriesHome().series).toHaveLength(1);
    expect(storage.listEpisodes(series.id)).toEqual(before);
  });
});

describe('POST /api/series — a body it will not take', () => {
  it.each([
    ['a missing mode', [] as Part[]],
    ['an unknown mode', [['mode', 'move']] as Part[]],
  ])(
    'answers 400 with one sentence for %s, writing no row and leaving no folder',
    async (_name, mode) => {
      const { storage, baseUrl, media, show } = freshApi();

      const response = await postSeries(baseUrl, [
        ...mode,
        ...FIELDS,
        ...showRows(show),
      ]);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: expect.stringMatching(/^[A-Z][^\n]*\.$/),
      });
      expect(storage.getSeriesHome().series).toEqual([]);
      expect(readdirSync(media)).toEqual([]);
    }
  );

  it('answers 400 for a Link path under no listed folder, leaving every file alone', async () => {
    const { storage, baseUrl, media, show, unlisted } = freshApi();
    const before = new Map([...showBytes(show), ...showBytes(unlisted)]);

    const response = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      foundEpisode(1, 1, 'Pilot', show.pilot),
      foundEpisode(1, 2, 'Low Tide', unlisted.lowTide),
    ]);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Link needs a file inside one of your library folders.',
    });
    expect(storage.getSeriesHome().series).toEqual([]);
    expect(readdirSync(media)).toEqual([]);
    expectShowUntouched(before);
  });
});

describe('POST /api/series — a failed linked save', () => {
  it('removes the reserved Series folder and never a linked file', async () => {
    const { storage, baseUrl, media, folderId, show } = freshApi();
    const before = showBytes(show);

    const response = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      foundEpisode(1, 1, 'Pilot', show.pilot),
      foundEpisode(1, 2, 'Low Tide', show.lowTide, [
        {
          path: join(show.dir, 'Season 1', 'Harbor.and.Vine.S01E02.Gone.srt'),
          language: 'English',
        },
      ]),
    ]);

    // A track that cannot be copied is the route's failure, not a refusal.
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Could not add the series',
    });
    expect(storage.getSeriesHome().series).toEqual([]);
    expect(readdirSync(media)).toEqual([]);
    expectShowUntouched(before);

    // Nothing it left behind stands in the way of the same show, linked.
    const retried = await postSeries(baseUrl, [
      ['mode', 'link'],
      ...FIELDS,
      ...showRows(show),
    ]);
    expect(retried.status).toBe(201);
    const series = (await retried.json()) as Series;
    expect(
      storage.listEpisodes(series.id).map((episode) => episode.videoFolderId)
    ).toEqual([folderId, folderId, folderId]);
  });
});

/** The current run, once it has reached review. */
async function untilReview(baseUrl: string): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const response = await fetch(`${baseUrl}/api/import/current`);
    if (response.status === 200) {
      const run = (await response.json()) as ImportRun;
      if (run.phase === 'review') {
        return run;
      }
    }
    if (Date.now() > deadline) {
      throw new Error('the run never reached review');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
