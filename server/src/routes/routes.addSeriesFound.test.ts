// @vitest-environment node
//
// 48 — Add a show folder, Phase 1 (issue #417): `POST /api/series` takes a
// **Show folder pick**'s rows.
//
// A folder row is a **Found file**: its `episode` field carries the video's
// absolute path as `videoPath`, with no `episodeVideo` part after it, and its
// found tracks as `storedSubtitles` — `{ path, language }`, each path
// absolute — the wire the **Series Resolve** already speaks. The route copies
// each found video into its `season-NN/` with `Media.copyIn`, and each found
// track beside it. A picked row still sends its bytes, and one save can mix
// the two.
//
// A found path must be absolute and of the video (or subtitle) kinds, else
// `400`. A save that fails or is refused removes the reserved **Series
// folder** and never touches the picked folder's files.
//
// Over a real listener, a real `fetch`, a real `:memory:` library, a sandboxed
// media root and a show folder built beside it.

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

/** The picked show: two Season folders, one track, and a poster. */
interface PickedShow {
  dir: string;
  pilot: string;
  pilotTrack: string;
  lowTide: string;
  springTide: string;
  poster: string;
}

/**
 * A fresh library behind a listening API, composed the way `main.ts` does,
 * and a show folder outside the media root to pick.
 */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  show: PickedShow;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-add-series-found-');
  const media = join(root, 'media');
  mkdirSync(media);
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null), () => null);

  const dir = join(root, 'Shows', 'Harbor and Vine');
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
    poster: join(dir, 'poster.jpg'),
  };
  writeFileSync(show.pilot, mp4Of(2520));
  writeFileSync(show.pilotTrack, '1\n00:00:01,000 --> 00:00:02,000\nOlá\n');
  writeFileSync(show.lowTide, mp4Of(2700));
  writeFileSync(show.springTide, mp4Of(3000));
  writeFileSync(show.poster, 'image bytes');

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
  return { storage, baseUrl: `http://127.0.0.1:${port}`, media, show };
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

function postSeries(baseUrl: string, parts: Part[]): Promise<Response> {
  const body = new FormData();
  // An add's **Import mode** travels first (issue #418).
  body.append('mode', 'copy');
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(`${baseUrl}/api/series`, { method: 'POST', body });
}

/** Every file of the picked show, as its bytes, by path. */
function showBytes(show: PickedShow): Map<string, string> {
  return new Map(
    [
      show.pilot,
      show.pilotTrack,
      show.lowTide,
      show.springTide,
      show.poster,
    ].map((path) => [path, readFileSync(path).toString('base64')])
  );
}

/** The picked show's files are all where they were, byte for byte. */
function expectShowUntouched(show: PickedShow, before: Map<string, string>) {
  for (const [path, bytes] of before) {
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path).toString('base64')).toBe(bytes);
  }
}

describe('POST /api/series — found rows copied in', () => {
  it('copies each found video into its season-NN/ under the Series folder, and answers 201', async () => {
    const { storage, baseUrl, media, show } = freshApi();

    const response = await postSeries(baseUrl, [
      ...FIELDS,
      foundEpisode(1, 1, 'Pilot', show.pilot),
      foundEpisode(1, 2, 'Low Tide', show.lowTide),
      foundEpisode(2, 1, 'Spring Tide', show.springTide),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const episodes = storage.listEpisodes(series.id);
    expect(
      episodes.map((episode) => [
        episode.season,
        episode.number,
        episode.title,
        episode.runtimeMinutes,
      ])
    ).toEqual([
      [1, 1, 'Pilot', 42],
      [1, 2, 'Low Tide', 45],
      [2, 1, 'Spring Tide', 50],
    ]);
    const [pilot, lowTide, springTide] = episodes;
    expect(pilot.videoPath).toMatch(/^harbor-and-vine-2019\/season-01\/[^/]+$/);
    expect(lowTide.videoPath).toMatch(
      /^harbor-and-vine-2019\/season-01\/[^/]+$/
    );
    expect(springTide.videoPath).toMatch(
      /^harbor-and-vine-2019\/season-02\/[^/]+$/
    );
    for (const episode of episodes) {
      expect(existsSync(join(media, episode.videoPath))).toBe(true);
    }
  });

  it('copies each found track beside its episode, in its language', async () => {
    const { storage, baseUrl, media, show } = freshApi();

    const response = await postSeries(baseUrl, [
      ...FIELDS,
      foundEpisode(1, 1, 'Pilot', show.pilot, [
        { path: show.pilotTrack, language: 'Portuguese' },
      ]),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const [pilot] = storage.listEpisodes(series.id);
    expect(pilot.subtitles.map((track) => track.language)).toEqual([
      'Portuguese',
    ]);
    const [track] = pilot.subtitles;
    expect(track.path).toMatch(/^harbor-and-vine-2019\/season-01\/[^/]+$/);
    expect(readFileSync(join(media, track.path), 'utf8')).toBe(
      readFileSync(show.pilotTrack, 'utf8')
    );
  });

  it('leaves the picked folder’s files where they were', async () => {
    const { baseUrl, show } = freshApi();
    const before = showBytes(show);

    const response = await postSeries(baseUrl, [
      ...FIELDS,
      foundEpisode(1, 1, 'Pilot', show.pilot, [
        { path: show.pilotTrack, language: 'Portuguese' },
      ]),
      foundEpisode(1, 2, 'Low Tide', show.lowTide),
    ]);

    expect(response.status).toBe(201);
    expectShowUntouched(show, before);
  });

  it('takes a picked row’s bytes in the same save as found rows', async () => {
    const { storage, baseUrl, media, show } = freshApi();

    const response = await postSeries(baseUrl, [
      ...FIELDS,
      foundEpisode(1, 1, 'Pilot', show.pilot),
      pickedEpisode(1, 3, 'The Night Market'),
      ['episodeVideo', videoPart('Harbor.and.Vine.S01E03.mp4', 2880)],
      foundEpisode(2, 1, 'Spring Tide', show.springTide),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const episodes = storage.listEpisodes(series.id);
    expect(
      episodes.map((episode) => [
        episode.season,
        episode.number,
        episode.title,
        episode.runtimeMinutes,
      ])
    ).toEqual([
      [1, 1, 'Pilot', 42],
      [1, 3, 'The Night Market', 48],
      [2, 1, 'Spring Tide', 50],
    ]);
    for (const episode of episodes) {
      expect(existsSync(join(media, episode.videoPath))).toBe(true);
    }
    expect(readdirSync(media)).toEqual(['harbor-and-vine-2019']);
  });
});

describe('POST /api/series — a found path it will not take', () => {
  // A picked part's sentences, held for a found path; a relative one has its
  // own.
  const REFUSED: [
    name: string,
    parts: (show: PickedShow) => Part[],
    sentence: string,
  ][] = [
    [
      'a relative video path',
      () => [
        ...FIELDS,
        foundEpisode(
          1,
          1,
          'Pilot',
          'Season 1/Harbor.and.Vine.S01E01.Pilot.mp4'
        ),
      ],
      'Not an absolute path: "Season 1/Harbor.and.Vine.S01E01.Pilot.mp4"',
    ],
    [
      'a video path that is not a video',
      (show) => [...FIELDS, foundEpisode(1, 1, 'Pilot', show.poster)],
      'Not a video file: "poster.jpg"',
    ],
    [
      'a relative subtitle path',
      (show) => [
        ...FIELDS,
        foundEpisode(1, 1, 'Pilot', show.pilot, [
          {
            path: 'Season 1/Harbor.and.Vine.S01E01.Pilot.pt.srt',
            language: 'Portuguese',
          },
        ]),
      ],
      'Not an absolute path: "Season 1/Harbor.and.Vine.S01E01.Pilot.pt.srt"',
    ],
    [
      'a subtitle path that is not a subtitle',
      (show) => [
        ...FIELDS,
        foundEpisode(1, 1, 'Pilot', show.pilot, [
          { path: show.lowTide, language: 'English' },
        ]),
      ],
      'Not a subtitle file: "Harbor.and.Vine.S01E02.Low.Tide.mp4"',
    ],
  ];

  for (const [name, parts, sentence] of REFUSED) {
    it(`answers 400 for ${name}, writing no row and leaving no folder`, async () => {
      const { storage, baseUrl, media, show } = freshApi();
      const before = showBytes(show);

      const response = await postSeries(baseUrl, parts(show));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: sentence });
      expect(storage.getSeriesHome().series).toEqual([]);
      expect(readdirSync(media)).toEqual([]);
      expectShowUntouched(show, before);
    });
  }
});

describe('POST /api/series — a failed save', () => {
  it('removes the reserved Series folder when a found video cannot be copied, and leaves the picked folder alone', async () => {
    const { storage, baseUrl, media, show } = freshApi();
    const before = showBytes(show);

    const response = await postSeries(baseUrl, [
      ...FIELDS,
      foundEpisode(1, 1, 'Pilot', show.pilot, [
        { path: show.pilotTrack, language: 'Portuguese' },
      ]),
      foundEpisode(
        1,
        2,
        'Low Tide',
        join(show.dir, 'Season 1', 'Harbor.and.Vine.S01E02.Gone.mp4')
      ),
    ]);

    // A copy that breaks is the route's failure, not a refusal of the body.
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Could not add the series',
    });
    expect(storage.getSeriesHome().series).toEqual([]);
    expect(readdirSync(media)).toEqual([]);
    expectShowUntouched(show, before);
  });
});
