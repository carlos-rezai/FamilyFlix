// @vitest-environment node
//
// 70 — Video quality, Phase 3: "episodes measured" (issue #666), the routes'
// half.
//
// A **Movie form** series save measures each episode's video from the one
// probe that reads its runtime, and stores its rung of the **Quality ladder**:
//
// - `POST /api/series` stores `video_quality` on each episode with a video,
//   and the episode read the wire hands the player carries it;
// - `PATCH /api/series/:id` measures a replaced episode video again, and
//   leaves a held one's quality as it was;
// - an episode nothing could probe saves with a `NULL` quality.
//
// Over a real listener, a real `fetch`, an on-disk library with a raw handle
// for the stored column, a sandboxed media root and a `Playback` over a fake
// **Playback component** whose probe answers a frame per file name.

import express from 'express';
import { mkdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { openDatabase, type SqliteDatabase } from '../db';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../playback/ffmpegComponent/ffmpegComponent';
import type { MediaProbe } from '../playback/probe/probe';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { closeTracked, track } from '../test-support/freshStorage/freshStorage';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { Episode, EpisodeRead, Series } from '@/types';

const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
// Registered after the servers' teardown, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

/** Each episode video's coded frame, by file name. */
const FRAMES: Record<string, { width: number; height: number }> = {
  'S01E01.mp4': { width: 1920, height: 1080 },
  'S01E02.mp4': { width: 1280, height: 720 },
  'S01E02.recut.mp4': { width: 3840, height: 2160 },
};

/** How the fake component answers a probe. */
type Prober = 'frames' | 'frameless' | 'throws';

function fakeComponent(prober: Prober): PlaybackComponent {
  return {
    hardwareEncoder: null,
    decoders: () => null,
    probe: (file: string): MediaProbe | null => {
      if (prober === 'throws') {
        throw new Error('the component died mid-answer');
      }
      return {
        container: 'mov,mp4,m4a,3gp,3g2,mj2',
        videoCodec: 'h264',
        frameSize:
          prober === 'frames' ? (FRAMES[basename(file)] ?? null) : null,
        audioStreams: [
          { codec: 'aac', language: null, title: null, isDefault: false },
        ],
        durationSeconds: 2520,
      };
    },
    spawn: (): PlaybackProcess => ({
      stdout: Readable.from([]),
      kill: () => undefined,
    }),
  };
}

/** A fresh library behind a listening API, over a component (or none). */
function freshApi(prober: Prober | 'none'): {
  storage: LibraryStorage;
  db: SqliteDatabase;
  baseUrl: string;
} {
  const dir = sandboxRoot('familyflix-episode-quality-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const dbPath = join(dir, 'familyflix.db');
  const storage = track(createSqliteStorage(dbPath));
  const db = track(openDatabase(dbPath));

  const mediaDomain = createMedia(media);
  const playback = createPlayback(
    media,
    fixedSlot(prober === 'none' ? null : fakeComponent(prober)),
    () => null
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
  return { storage, db, baseUrl: `http://127.0.0.1:${port}` };
}

/** An MP4 that reports its own length, so a runtime derives with no component. */
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

const videoPart = (filename: string): File =>
  new File([new Uint8Array(mp4Of(2520))], filename, { type: 'video/mp4' });

type Part = [name: string, value: string | File];

function send(
  method: 'POST' | 'PATCH',
  url: string,
  parts: Part[]
): Promise<Response> {
  const body = new FormData();
  if (method === 'POST') {
    body.append('mode', 'copy');
  }
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(url, { method, body });
}

const SERIES_FIELDS: Part[] = [
  ['title', 'Harbor and Vine'],
  ['year', '2019'],
  ['creator', ''],
  ['description', ''],
  ['rating', ''],
];

/** _Harbor and Vine_, added through the form's route: `S01E01` and `S01E02`. */
async function addHarbor(baseUrl: string): Promise<Series> {
  const response = await send('POST', `${baseUrl}/api/series`, [
    ...SERIES_FIELDS,
    ['episode', JSON.stringify({ season: 1, number: 1, title: 'Pilot' })],
    ['episodeVideo', videoPart('S01E01.mp4')],
    ['episode', JSON.stringify({ season: 1, number: 2, title: 'Low Tide' })],
    ['episodeVideo', videoPart('S01E02.mp4')],
  ]);
  expect(response.status).toBe(201);
  return (await response.json()) as Series;
}

/** A held episode's `episode` field, its files as the paths they have. */
function heldEpisode(
  episode: Episode,
  overrides: Record<string, unknown> = {}
): Part {
  return [
    'episode',
    JSON.stringify({
      id: episode.id,
      season: episode.season,
      number: episode.number,
      title: episode.title ?? '',
      videoPath: episode.videoPath,
      storedSubtitles: episode.subtitles.map(({ path, language }) => ({
        path,
        language,
      })),
      subtitleLanguages: [],
      ...overrides,
    }),
  ];
}

const storedQuality = (db: SqliteDatabase, id: string): string | null =>
  (
    db.prepare('SELECT video_quality FROM episodes WHERE id = ?').get(id) as {
      video_quality: string | null;
    }
  ).video_quality;

async function episodeOnTheWire(baseUrl: string, id: string): Promise<Episode> {
  const response = await fetch(
    `${baseUrl}/api/episodes/${encodeURIComponent(id)}`
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as EpisodeRead).episode;
}

describe('POST /api/series — each episode’s quality is measured', () => {
  it('stores each episode’s rung', async () => {
    const { storage, db, baseUrl } = freshApi('frames');

    const series = await addHarbor(baseUrl);

    const [pilot, lowTide] = storage.listEpisodes(series.id);
    expect(pilot.videoQuality).toBe('1080p');
    expect(lowTide.videoQuality).toBe('720p');
    expect(storedQuality(db, pilot.id)).toBe('1080p');
    expect(storedQuality(db, lowTide.id)).toBe('720p');
  });

  it('hands each episode’s quality over the wire', async () => {
    const { storage, baseUrl } = freshApi('frames');
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);

    expect((await episodeOnTheWire(baseUrl, pilot.id)).videoQuality).toBe(
      '1080p'
    );
    expect((await episodeOnTheWire(baseUrl, lowTide.id)).videoQuality).toBe(
      '720p'
    );
  });
});

describe('PATCH /api/series/:id — a replaced episode video is measured again', () => {
  it('stores the replacement’s rung, and keeps the held episode’s', async () => {
    const { storage, db, baseUrl } = freshApi('frames');
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);

    const response = await send(
      'PATCH',
      `${baseUrl}/api/series/${encodeURIComponent(series.id)}`,
      [
        ...SERIES_FIELDS,
        heldEpisode(pilot),
        // A picked replacement: no `videoPath`, the bytes follow.
        heldEpisode(lowTide, { videoPath: undefined }),
        ['episodeVideo', videoPart('S01E02.recut.mp4')],
      ]
    );

    expect(response.status).toBe(200);
    expect(storedQuality(db, lowTide.id)).toBe('4K');
    expect(storedQuality(db, pilot.id)).toBe('1080p');
    const after = storage.listEpisodes(series.id);
    expect(after.find((e) => e.id === lowTide.id)?.videoQuality).toBe('4K');
    expect(after.find((e) => e.id === pilot.id)?.videoQuality).toBe('1080p');
  });

  it('measures an episode the edit adds', async () => {
    const { storage, db, baseUrl } = freshApi('frames');
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);

    const response = await send(
      'PATCH',
      `${baseUrl}/api/series/${encodeURIComponent(series.id)}`,
      [
        ...SERIES_FIELDS,
        heldEpisode(pilot),
        heldEpisode(lowTide),
        ['episode', JSON.stringify({ season: 1, number: 3, title: 'Recut' })],
        ['episodeVideo', videoPart('S01E02.recut.mp4')],
      ]
    );

    expect(response.status).toBe(200);
    const added = storage.listEpisodes(series.id).find((e) => e.number === 3);
    expect(added?.videoQuality).toBe('4K');
    expect(storedQuality(db, added?.id ?? '')).toBe('4K');
  });
});

describe('a series save nothing could probe', () => {
  it.each([
    ['no Playback component', 'none'],
    ['a probe that names no frame', 'frameless'],
    ['a probe that throws', 'throws'],
  ] as const)(
    'saves each episode with a NULL quality under %s',
    async (_name, prober) => {
      const { storage, db, baseUrl } = freshApi(prober);

      const series = await addHarbor(baseUrl);

      const episodes = storage.listEpisodes(series.id);
      expect(episodes).toHaveLength(2);
      for (const episode of episodes) {
        expect(episode.videoQuality).toBeNull();
        expect(storedQuality(db, episode.id)).toBeNull();
      }
    }
  );
});
