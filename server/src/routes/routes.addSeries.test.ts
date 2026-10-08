// @vitest-environment node
//
// 29 — Add a series, Phase 3 (issue #263): `POST /api/series`.
//
// The **Movie form**'s series save, over a real listener, a real `fetch`, a
// real `:memory:` library and a sandboxed media root. The body is
// `multipart/form-data` in the contract's order — the series fields, the
// poster, then each episode as an `episode` JSON field followed by its
// `episodeVideo` — built with the platform's own `FormData`, so the boundary
// and the encoding under test are the real ones.
//
// The route reserves the **Series folder** when the first file needs it,
// copies each video into its `season-NN/`, takes each episode's **Derived
// runtime** after its copy, and writes no row until every byte has landed.
// Every refusal is a `400` with one sentence, and after any of them nothing is
// left behind: no row, and no Series folder.

import express from 'express';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
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

/** A fresh library behind a listening API, composed the way `main.ts` does. */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const media = join(sandboxRoot('familyflix-add-series-'), 'media');
  mkdirSync(media);
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null));

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
  return { storage, baseUrl: `http://127.0.0.1:${port}`, media };
}

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

const videoPart = (filename: string, seconds = 2520): File =>
  new File([new Uint8Array(mp4Of(seconds))], filename, { type: 'video/mp4' });

const posterPart = (filename = 'poster.jpg'): File =>
  new File([new Uint8Array(Buffer.from('image bytes'))], filename, {
    type: 'image/jpeg',
  });

type Part = [name: string, value: string | File];

/** An `episode` field: the JSON the contract names. */
const episode = (season: number, number: number, title = ''): Part => [
  'episode',
  JSON.stringify({ season, number, title, subtitleLanguages: [] }),
];

/** The series fields, in the contract's order, with a title and a year. */
const FIELDS: Part[] = [
  ['title', 'Harbor and Vine'],
  ['year', '2019–2023'],
  ['creator', 'Mara Quinn'],
  ['cast', 'Ana Vega'],
  ['cast', 'Tomas Bell'],
  ['description', 'Two families share one vineyard.'],
  ['genre', 'Drama'],
  ['genre', 'Comedy'],
  ['rating', ''],
];

/** A multipart POST to `/api/series` whose parts are given in order. */
function postSeries(baseUrl: string, parts: Part[]): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(`${baseUrl}/api/series`, { method: 'POST', body });
}

describe('POST /api/series — the happy path', () => {
  const SEASONS: Part[] = [
    ...FIELDS,
    ['poster', posterPart()],
    episode(1, 1, 'Pilot'),
    ['episodeVideo', videoPart('Harbor.and.Vine.S01E01.Pilot.mp4', 2520)],
    episode(1, 2, 'Low Tide'),
    ['episodeVideo', videoPart('Harbor.and.Vine.S01E02.Low.Tide.mp4', 2700)],
    episode(2, 1, 'Spring Tide'),
    ['episodeVideo', videoPart('Harbor.and.Vine.S02E01.Spring.Tide.mp4', 3000)],
  ];

  it('answers 201 with the assembled Series', async () => {
    const { baseUrl } = freshApi();

    const response = await postSeries(baseUrl, SEASONS);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    expect(series).toMatchObject({
      title: 'Harbor and Vine',
      year: 2019,
      endYear: 2023,
      creator: 'Mara Quinn',
      cast: ['Ana Vega', 'Tomas Bell'],
      synopsis: 'Two families share one vineyard.',
      isFavorite: false,
    });
    expect(series.genres.map((genre) => genre.name)).toEqual([
      'Drama',
      'Comedy',
    ]);
    expect(typeof series.id).toBe('string');
  });

  it('writes the series and its episodes, in order, with their runtimes', async () => {
    const { storage, baseUrl } = freshApi();

    const series = (await (
      await postSeries(baseUrl, SEASONS)
    ).json()) as Series;

    expect(storage.getSeriesHome().series.map((s) => s.id)).toEqual([
      series.id,
    ]);
    const episodes = storage.listEpisodes(series.id);
    expect(
      episodes.map((row) => [
        row.season,
        row.number,
        row.title,
        row.runtimeMinutes,
      ])
    ).toEqual([
      [1, 1, 'Pilot', 42],
      [1, 2, 'Low Tide', 45],
      [2, 1, 'Spring Tide', 50],
    ]);
  });

  it('copies each video into its season-NN/ under one Series folder', async () => {
    const { storage, baseUrl, media } = freshApi();

    const series = (await (
      await postSeries(baseUrl, SEASONS)
    ).json()) as Series;

    const [pilot, lowTide, springTide] = storage.listEpisodes(series.id);
    expect(pilot.videoPath).toMatch(/^harbor-and-vine-2019\/season-01\/[^/]+$/);
    expect(lowTide.videoPath).toMatch(
      /^harbor-and-vine-2019\/season-01\/[^/]+$/
    );
    expect(springTide.videoPath).toMatch(
      /^harbor-and-vine-2019\/season-02\/[^/]+$/
    );
    for (const row of [pilot, lowTide, springTide]) {
      expect(existsSync(join(media, row.videoPath))).toBe(true);
    }
    expect(readdirSync(media)).toEqual(['harbor-and-vine-2019']);
  });

  it('stores the poster in the Series folder', async () => {
    const { baseUrl, media } = freshApi();

    const series = (await (
      await postSeries(baseUrl, SEASONS)
    ).json()) as Series;

    expect(series.posterPath).toMatch(/^harbor-and-vine-2019\/[^/]+$/);
    expect(existsSync(join(media, series.posterPath as string))).toBe(true);
  });

  it('stores an unreadable year as no year, rather than refusing it', async () => {
    const { baseUrl } = freshApi();

    const response = await postSeries(baseUrl, [
      ['title', 'Harbor and Vine'],
      ['year', '20x9'],
      episode(1, 1),
      ['episodeVideo', videoPart('S01E01.mp4')],
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    expect(series.year).toBeNull();
    expect(series.endYear).toBeNull();
  });

  it('reads an open span as a show still running', async () => {
    const { baseUrl } = freshApi();

    const response = await postSeries(baseUrl, [
      ['title', 'Harbor and Vine'],
      ['year', '2021–'],
      episode(1, 1),
      ['episodeVideo', videoPart('S01E01.mp4')],
    ]);

    const series = (await response.json()) as Series;
    expect(series.year).toBe(2021);
    expect(series.endYear).toBeNull();
  });
});

/**
 * Each refusal the contract names, as the parts that earn it. Where the
 * sentence is the contract's own it is pinned; elsewhere the route owns its
 * words and the test asks only that there is one.
 */
const REFUSALS: [name: string, parts: Part[], sentence: string | null][] = [
  [
    'no title',
    [
      ['title', ''],
      ['year', '2019'],
      episode(1, 1),
      ['episodeVideo', videoPart('S01E01.mp4')],
    ],
    'Body must carry a title',
  ],
  ['no episode', [...FIELDS, ['poster', posterPart()]], null],
  [
    'an episode field that is not JSON',
    [
      ...FIELDS,
      ['episode', 'S01E01'],
      ['episodeVideo', videoPart('S01E01.mp4')],
    ],
    null,
  ],
  [
    'an episode field with season 0',
    [...FIELDS, episode(0, 1), ['episodeVideo', videoPart('S00E01.mp4')]],
    null,
  ],
  [
    'an episode field with number 0',
    [...FIELDS, episode(1, 0), ['episodeVideo', videoPart('S01E00.mp4')]],
    null,
  ],
  [
    'a duplicate episode',
    [
      ...FIELDS,
      episode(1, 3),
      ['episodeVideo', videoPart('S01E03.mp4')],
      episode(1, 3),
      ['episodeVideo', videoPart('S01E03.again.mp4')],
    ],
    'Duplicate episode: S01E03',
  ],
  [
    'an episode with no video after it',
    [
      ...FIELDS,
      episode(1, 1),
      ['episodeVideo', videoPart('S01E01.mp4')],
      episode(1, 2),
    ],
    null,
  ],
  [
    'an episode followed by another episode, its video skipped',
    [
      ...FIELDS,
      episode(1, 1),
      episode(1, 2),
      ['episodeVideo', videoPart('S01E02.mp4')],
    ],
    null,
  ],
  [
    'a stray episodeVideo before any episode',
    [
      ...FIELDS,
      ['episodeVideo', videoPart('S01E01.mp4')],
      episode(1, 1),
      ['episodeVideo', videoPart('S01E01.again.mp4')],
    ],
    null,
  ],
  [
    'a stray episodeSubtitle the episode names no language for',
    [
      ...FIELDS,
      episode(1, 1),
      ['episodeVideo', videoPart('S01E01.mp4')],
      [
        'episodeSubtitle',
        new File(['1\n00:00:01,000 --> 00:00:02,000\nHi\n'], 'S01E01.srt'),
      ],
    ],
    null,
  ],
  [
    'an episode video the store will not take',
    [
      ...FIELDS,
      episode(1, 1),
      ['episodeVideo', new File(['not a film'], 'S01E01.exe')],
    ],
    null,
  ],
  [
    'a poster the store will not take',
    [
      ...FIELDS,
      ['poster', new File(['not an image'], 'poster.exe')],
      episode(1, 1),
      ['episodeVideo', videoPart('S01E01.mp4')],
    ],
    null,
  ],
  [
    'an unknown genre',
    [
      ['title', 'Harbor and Vine'],
      ['year', '2019'],
      ['genre', 'Westerns'],
      episode(1, 1),
      ['episodeVideo', videoPart('S01E01.mp4')],
    ],
    'Unknown genre: Westerns',
  ],
];

describe('POST /api/series — each refusal', () => {
  it.each(REFUSALS)(
    'answers 400 with one sentence for %s',
    async (_, parts, sentence) => {
      const { baseUrl } = freshApi();

      const response = await postSeries(baseUrl, parts);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: unknown };
      if (sentence === null) {
        expect(typeof body.error).toBe('string');
        expect((body.error as string).length).toBeGreaterThan(0);
      } else {
        expect(body).toEqual({ error: sentence });
      }
    }
  );

  it.each(REFUSALS)(
    'leaves no row and no Series folder behind for %s',
    async (_, parts) => {
      const { storage, baseUrl, media } = freshApi();

      const response = await postSeries(baseUrl, parts);
      expect(response.status).toBe(400);

      expect(storage.getSeriesHome().series).toEqual([]);
      expect(storage.getSeriesHome().episodeCount).toBe(0);
      expect(readdirSync(media)).toEqual([]);
    }
  );

  it('refuses a body that is not multipart', async () => {
    const { storage, baseUrl, media } = freshApi();

    const response = await fetch(`${baseUrl}/api/series`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Harbor and Vine' }),
    });

    expect(response.status).toBe(400);
    expect(storage.getSeriesHome().series).toEqual([]);
    expect(readdirSync(media)).toEqual([]);
  });
});

// 29 — Add a series, Phase 4 (issue #264): each episode's subtitles.
//
// An episode's `episodeSubtitle` parts follow its `episodeVideo` and pair with
// its `subtitleLanguages` by order. Each lands beside its episode's video in
// `season-NN/` with its `episode_subtitles` row, so the player's episode read
// lists the track exactly as it does an imported one. A subtitle with no
// episode before it, or a language count its parts do not match, is a `400`
// that leaves no row and no Series folder.

/** An `episode` field naming its tracks' languages. */
const subtitledEpisode = (
  season: number,
  number: number,
  subtitleLanguages: string[]
): Part => [
  'episode',
  JSON.stringify({ season, number, title: '', subtitleLanguages }),
];

const srtPart = (filename: string): File =>
  new File(['1\n00:00:01,000 --> 00:00:02,000\nHello\n'], filename, {
    type: 'text/plain',
  });

describe('POST /api/series — episode subtitles', () => {
  const SUBTITLED: Part[] = [
    ['title', 'Harbor and Vine'],
    ['year', '2019'],
    subtitledEpisode(1, 1, ['English', 'Portuguese']),
    ['episodeVideo', videoPart('S01E01.mp4')],
    ['episodeSubtitle', srtPart('S01E01.en.srt')],
    ['episodeSubtitle', srtPart('S01E01.pt.srt')],
    subtitledEpisode(2, 1, []),
    ['episodeVideo', videoPart('S02E01.mp4')],
  ];

  it('stores each track beside its episode in season-NN/, with its row', async () => {
    const { storage, baseUrl, media } = freshApi();

    const response = await postSeries(baseUrl, SUBTITLED);
    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;

    const [pilot, springTide] = storage.listEpisodes(series.id);
    expect(pilot.subtitles.map((track) => track.language)).toEqual([
      'English',
      'Portuguese',
    ]);
    for (const track of pilot.subtitles) {
      expect(track.path).toMatch(/^harbor-and-vine-2019\/season-01\/[^/]+$/);
      expect(existsSync(join(media, track.path))).toBe(true);
    }
    expect(springTide.subtitles).toEqual([]);
  });

  it('lists the track on the episode read the player opens', async () => {
    const { storage, baseUrl } = freshApi();

    const series = (await (
      await postSeries(baseUrl, SUBTITLED)
    ).json()) as Series;
    const [pilot] = storage.listEpisodes(series.id);

    const response = await fetch(`${baseUrl}/api/episodes/${pilot.id}`);
    expect(response.status).toBe(200);
    const read = (await response.json()) as {
      episode: { subtitles: { path: string; language: string }[] };
    };
    expect(read.episode.subtitles.map((track) => track.language)).toEqual([
      'English',
      'Portuguese',
    ]);
    expect(read.episode.subtitles.map((track) => track.path)).toEqual(
      pilot.subtitles.map((track) => track.path)
    );
  });

  const SUBTITLE_REFUSALS: [name: string, parts: Part[]][] = [
    [
      'a subtitle with no episode before it',
      [
        ['title', 'Harbor and Vine'],
        ['year', '2019'],
        ['episodeSubtitle', srtPart('S01E01.srt')],
        subtitledEpisode(1, 1, ['English']),
        ['episodeVideo', videoPart('S01E01.mp4')],
        ['episodeSubtitle', srtPart('S01E01.again.srt')],
      ],
    ],
    [
      'more subtitles than the episode names languages for',
      [
        ['title', 'Harbor and Vine'],
        ['year', '2019'],
        subtitledEpisode(1, 1, ['English']),
        ['episodeVideo', videoPart('S01E01.mp4')],
        ['episodeSubtitle', srtPart('S01E01.en.srt')],
        ['episodeSubtitle', srtPart('S01E01.pt.srt')],
      ],
    ],
    [
      'fewer subtitles than the episode names languages for',
      [
        ['title', 'Harbor and Vine'],
        ['year', '2019'],
        subtitledEpisode(1, 1, ['English', 'Portuguese']),
        ['episodeVideo', videoPart('S01E01.mp4')],
        ['episodeSubtitle', srtPart('S01E01.en.srt')],
      ],
    ],
    [
      'an earlier episode short of its subtitles',
      [
        ['title', 'Harbor and Vine'],
        ['year', '2019'],
        subtitledEpisode(1, 1, ['English']),
        ['episodeVideo', videoPart('S01E01.mp4')],
        subtitledEpisode(1, 2, []),
        ['episodeVideo', videoPart('S01E02.mp4')],
      ],
    ],
    [
      'an episode subtitle the store will not take',
      [
        ['title', 'Harbor and Vine'],
        ['year', '2019'],
        subtitledEpisode(1, 1, ['English']),
        ['episodeVideo', videoPart('S01E01.mp4')],
        ['episodeSubtitle', new File(['not cues'], 'S01E01.exe')],
      ],
    ],
  ];

  it.each(SUBTITLE_REFUSALS)(
    'answers 400 with one sentence, and leaves nothing, for %s',
    async (_, parts) => {
      const { storage, baseUrl, media } = freshApi();

      const response = await postSeries(baseUrl, parts);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: unknown };
      expect(typeof body.error).toBe('string');
      expect((body.error as string).length).toBeGreaterThan(0);
      expect(storage.getSeriesHome().series).toEqual([]);
      expect(storage.getSeriesHome().episodeCount).toBe(0);
      expect(readdirSync(media)).toEqual([]);
    }
  );
});
