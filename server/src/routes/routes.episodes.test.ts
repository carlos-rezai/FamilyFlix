// @vitest-environment node
//
// 22 — Series (TV), Phase 4: "episode playback — the player takes a Playable"
// (issue #194).
//
// The episode's slice of the router's tests: the one read the player opens an
// episode with, and the episode's half of the two parallel wires.
//
// - `GET /api/episodes/:id` → `200 EpisodeRead` — the episode, its series' id
//   and title, and the next episode as `{ id, season, number, title }` or
//   `null`; `404` when the library holds no such episode.
// - `/api/episodes/:id/{playback,stream,subtitles/:sid,resume}` answer as the
//   movie routes do — the same handlers over a lookup of the **Stored path** —
//   so everything asserted here is asserted of the movie routes in
//   `routes.test.ts` too. `/watched` shipped with the season page (#193) and is
//   asserted in `routes.series.test.ts`.
//
// A real listener, a real `fetch`, a real library on a file in a sandbox, and
// the fixture video really on disk under the managed media directory. An
// episode's **Subtitle** row is written straight into `episode_subtitles`: no
// library write takes one until the importer learns subtitles (Phase 7).

import express from 'express';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { openDatabase } from '../db';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import {
  FIXTURE_DURATION_SECONDS,
  FIXTURE_VIDEO,
} from '../test-support/fixtureVideo/fixtureVideo';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { EpisodeRead } from '@/types';

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

interface Api {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  dbPath: string;
}

/** A fresh library behind a listening API, composed the way `main.ts` does. */
function freshApi(): Api {
  const sandbox = sandboxRoot('familyflix-episode-api-');
  const dbPath = join(sandbox, 'familyflix.db');
  const storage = createSqliteStorage(dbPath);
  storages.push(storage);

  const media = join(sandbox, 'media');
  mkdirSync(media);
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null));

  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback })
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, media, dbPath };
}

/**
 * Harbor & Vine: S01E01–S01E02, then S02E01 _The Return_ and S02E04 _The
 * Auction_ — a gap in the numbers, so "next" is the next held, not number + 1.
 * Only S02E04's file is on disk; the others are rows whose files are not.
 */
function seedHarbor(api: Api): {
  seriesId: string;
  ids: Record<string, string>;
} {
  const series = api.storage.addSeries({ title: 'Harbor & Vine', year: 2019 });
  const shape: [string, number, number, string | undefined][] = [
    ['S01E01', 1, 1, undefined],
    ['S01E02', 1, 2, 'Low Tide'],
    ['S02E01', 2, 1, 'The Return'],
    ['S02E04', 2, 4, 'The Auction'],
  ];
  const ids: Record<string, string> = {};
  for (const [code, season, number, title] of shape) {
    const episode = api.storage.addEpisode(series.id, {
      season,
      number,
      title,
      videoPath: `harbor-vine-2019/season-0${season}/${code}.mp4`,
    });
    ids[code] = episode.id;
  }

  const onDisk = join(api.media, 'harbor-vine-2019/season-02/S02E04.mp4');
  mkdirSync(join(onDisk, '..'), { recursive: true });
  copyFileSync(FIXTURE_VIDEO, onDisk);

  return { seriesId: series.id, ids };
}

const VIDEO_BYTES = readFileSync(FIXTURE_VIDEO);

const SRT = [
  '1',
  '00:00:01,000 --> 00:00:04,000',
  'The bidding opens at noon.',
  '',
  '2',
  '00:00:05,500 --> 00:00:08,250',
  'Nobody bids on the east field.',
  '',
].join('\n');

const SRT_CUES = [
  { start: 1, end: 4, text: 'The bidding opens at noon.' },
  { start: 5.5, end: 8.25, text: 'Nobody bids on the east field.' },
];

/**
 * One **Subtitle** under an episode, its file really on disk (unless told not
 * to be), written straight into `episode_subtitles`.
 */
function addEpisodeSubtitle(
  api: Api,
  episodeId: string,
  {
    id = 'sub-en',
    path = 'harbor-vine-2019/season-02/S02E04.en.srt',
    write = true,
  }: { id?: string; path?: string; write?: boolean } = {}
): string {
  if (write) {
    const absolute = join(api.media, path);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(absolute, SRT, 'utf8');
  }
  const db = openDatabase(api.dbPath);
  try {
    db.prepare(
      `INSERT INTO episode_subtitles (id, episode_id, path, language, position)
       VALUES (?, ?, ?, 'en', 0)`
    ).run(id, episodeId, path);
  } finally {
    db.close();
  }
  return id;
}

const episodeUrl = (baseUrl: string, id: string, rest = '') =>
  `${baseUrl}/api/episodes/${encodeURIComponent(id)}${rest}`;

async function getEpisode(
  baseUrl: string,
  id: string
): Promise<{ status: number; body: EpisodeRead & { error?: unknown } }> {
  const response = await fetch(episodeUrl(baseUrl, id));
  const text = await response.text();
  let body = {} as EpisodeRead & { error?: unknown };
  try {
    body = JSON.parse(text) as EpisodeRead & { error?: unknown };
  } catch {
    body = {} as EpisodeRead & { error?: unknown };
  }
  return { status: response.status, body };
}

function postResume(baseUrl: string, id: string, body: unknown) {
  return fetch(episodeUrl(baseUrl, id, '/resume'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * The movie routes' 404: a JSON `{ error }`, never Express's own HTML page —
 * which is also what tells a shared handler's refusal from a route that is not
 * there at all.
 */
async function expectJsonNotFound(response: Response): Promise<void> {
  expect(response.status).toBe(404);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(typeof ((await response.json()) as { error: unknown }).error).toBe(
    'string'
  );
}

describe('GET /api/episodes/:id', () => {
  it('answers 200 with the episode itself', async () => {
    const api = freshApi();
    const { seriesId, ids } = seedHarbor(api);

    const { status, body } = await getEpisode(api.baseUrl, ids.S02E04);

    expect(status).toBe(200);
    expect(body.episode).toMatchObject({
      id: ids.S02E04,
      seriesId,
      season: 2,
      number: 4,
      title: 'The Auction',
      watched: false,
      resumePositionSeconds: 0,
      status: 'unwatched',
    });
  });

  it('answers the series’ id and title beside it', async () => {
    const api = freshApi();
    const { seriesId, ids } = seedHarbor(api);

    const { body } = await getEpisode(api.baseUrl, ids.S02E04);

    expect(body.series).toEqual({ id: seriesId, title: 'Harbor & Vine' });
  });

  it('answers the next episode in the season as its id, numbers and title', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);

    const { body } = await getEpisode(api.baseUrl, ids.S01E01);

    expect(body.next).toEqual({
      id: ids.S01E02,
      season: 1,
      number: 2,
      title: 'Low Tide',
    });
  });

  it('answers a null next for the show’s last episode', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);

    const { body } = await getEpisode(api.baseUrl, ids.S02E04);

    expect(body.next).toBeNull();
  });

  it('answers 404 with a JSON error for an episode the library does not hold', async () => {
    const api = freshApi();

    const { status, body } = await getEpisode(api.baseUrl, 'no-such-episode');

    expect(status).toBe(404);
    expect(typeof body.error).toBe('string');
  });

  it('answers 404 for a movie’s id — a movie is not an episode', async () => {
    const api = freshApi();
    const movie = api.storage.addMovie({
      title: 'Die Hard',
      videoPath: 'die-hard/dh.mp4',
    });

    const { status, body } = await getEpisode(api.baseUrl, movie.id);

    expect(status).toBe(404);
    expect(typeof body.error).toBe('string');
  });
});

describe('GET /api/episodes/:id/playback', () => {
  it('answers the path the episode takes and how long its file runs', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);

    const response = await fetch(
      episodeUrl(api.baseUrl, ids.S02E04, '/playback')
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      path: string;
      durationSeconds: number;
    };
    expect(body.path).toBe('direct');
    expect(body.durationSeconds).toBeCloseTo(FIXTURE_DURATION_SECONDS, 1);
  });

  it('answers a JSON 404 for an episode whose file is not on disk', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);

    const response = await fetch(
      episodeUrl(api.baseUrl, ids.S02E01, '/playback')
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(typeof ((await response.json()) as { error: unknown }).error).toBe(
      'string'
    );
  });

  it('answers a JSON 404 for an episode the library does not hold', async () => {
    const api = freshApi();

    const response = await fetch(
      episodeUrl(api.baseUrl, 'no-such-episode', '/playback')
    );

    expect(response.status).toBe(404);
    expect(typeof ((await response.json()) as { error: unknown }).error).toBe(
      'string'
    );
  });

  it('answers 404 for a movie’s id, however playable the movie', async () => {
    const api = freshApi();
    const onDisk = join(api.media, 'northwind/northwind.mp4');
    mkdirSync(join(onDisk, '..'), { recursive: true });
    copyFileSync(FIXTURE_VIDEO, onDisk);
    const movie = api.storage.addMovie({
      title: 'Northwind',
      videoPath: 'northwind/northwind.mp4',
    });

    const response = await fetch(
      episodeUrl(api.baseUrl, movie.id, '/playback')
    );

    await expectJsonNotFound(response);
  });

  it('refuses a stored path that leaves the media directory, as a movie’s is', async () => {
    const api = freshApi();
    const series = api.storage.addSeries({ title: 'Escapee' });
    const episode = api.storage.addEpisode(series.id, {
      season: 1,
      number: 1,
      videoPath: '../outside.mp4',
    });
    copyFileSync(FIXTURE_VIDEO, join(api.media, '..', 'outside.mp4'));

    const response = await fetch(
      episodeUrl(api.baseUrl, episode.id, '/playback')
    );

    await expectJsonNotFound(response);
  });
});

describe('GET /api/episodes/:id/stream', () => {
  it('answers the episode file’s bytes as video/mp4', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);

    const response = await fetch(
      episodeUrl(api.baseUrl, ids.S02E04, '/stream')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('video/mp4');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(VIDEO_BYTES);
  });

  it('answers a Range request with 206 and the slice, which is what lets it seek', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);

    const response = await fetch(
      episodeUrl(api.baseUrl, ids.S02E04, '/stream'),
      { headers: { Range: 'bytes=10-19' } }
    );

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe(
      `bytes 10-19/${VIDEO_BYTES.length}`
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      VIDEO_BYTES.subarray(10, 20)
    );
  });

  it('answers a JSON 404 for an episode whose file is not on disk', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);

    const response = await fetch(
      episodeUrl(api.baseUrl, ids.S02E01, '/stream')
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('answers a JSON 404 for an episode the library does not hold', async () => {
    const api = freshApi();

    const response = await fetch(
      episodeUrl(api.baseUrl, 'no-such-episode', '/stream')
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('answers 400 for a t that is not a position, as the movie stream does', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);

    const response = await fetch(
      episodeUrl(api.baseUrl, ids.S02E04, '/stream?t=soon')
    );

    expect(response.status).toBe(400);
  });
});

describe('GET /api/episodes/:id/subtitles/:subtitleId', () => {
  it('answers the cue list of the episode’s subtitle', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);
    const subtitle = addEpisodeSubtitle(api, ids.S02E04);

    const response = await fetch(
      episodeUrl(api.baseUrl, ids.S02E04, `/subtitles/${subtitle}`)
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SRT_CUES);
  });

  it('answers 404 for a subtitle id the episode does not have', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);
    addEpisodeSubtitle(api, ids.S02E04);

    const response = await fetch(
      episodeUrl(api.baseUrl, ids.S02E04, '/subtitles/no-such-subtitle')
    );

    await expectJsonNotFound(response);
  });

  it('opens nothing for another episode’s subtitle — the pair is the address', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);
    const subtitle = addEpisodeSubtitle(api, ids.S02E04);

    const response = await fetch(
      episodeUrl(api.baseUrl, ids.S02E01, `/subtitles/${subtitle}`)
    );

    await expectJsonNotFound(response);
  });

  it('answers 404 for a subtitle row whose file has gone', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);
    const subtitle = addEpisodeSubtitle(api, ids.S02E04, { write: false });

    const response = await fetch(
      episodeUrl(api.baseUrl, ids.S02E04, `/subtitles/${subtitle}`)
    );

    await expectJsonNotFound(response);
  });

  it('answers 404 for an episode the library does not hold', async () => {
    const api = freshApi();

    const response = await fetch(
      episodeUrl(api.baseUrl, 'no-such-episode', '/subtitles/sub-en')
    );

    await expectJsonNotFound(response);
  });
});

describe('POST /api/episodes/:id/resume', () => {
  it('stores the position in whole seconds and echoes the second it stored', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);

    const response = await postResume(api.baseUrl, ids.S02E04, {
      value: 660.6,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: 661 });
    const { body } = await getEpisode(api.baseUrl, ids.S02E04);
    expect(body.episode.resumePositionSeconds).toBe(661);
    expect(body.episode.status).toBe('in-progress');
  });

  it('stamps the episode as last watched now', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);

    await postResume(api.baseUrl, ids.S02E04, { value: 600 });

    const { body } = await getEpisode(api.baseUrl, ids.S02E04);
    expect(typeof body.episode.lastWatchedAt).toBe('string');
  });

  it('touches only the episode asked for', async () => {
    const api = freshApi();
    const { ids } = seedHarbor(api);

    await postResume(api.baseUrl, ids.S02E04, { value: 600 });

    const { body } = await getEpisode(api.baseUrl, ids.S02E01);
    expect(body.episode.resumePositionSeconds).toBe(0);
  });

  it.each([
    ['a string', { value: '600' }],
    ['a negative number', { value: -1 }],
    ['a missing value', {}],
  ])('answers 400 for %s, and stores nothing', async (_label, body) => {
    const api = freshApi();
    const { ids } = seedHarbor(api);

    const response = await postResume(api.baseUrl, ids.S02E04, body);

    expect(response.status).toBe(400);
    const read = await getEpisode(api.baseUrl, ids.S02E04);
    expect(read.body.episode.resumePositionSeconds).toBe(0);
  });

  it('answers 404 for an episode the library does not hold', async () => {
    const api = freshApi();

    const response = await postResume(api.baseUrl, 'no-such-episode', {
      value: 600,
    });

    await expectJsonNotFound(response);
  });

  it('answers 404 for a movie’s id, and leaves the movie alone', async () => {
    const api = freshApi();
    const movie = api.storage.addMovie({
      title: 'Die Hard',
      videoPath: 'die-hard/dh.mp4',
    });

    const response = await postResume(api.baseUrl, movie.id, { value: 600 });

    await expectJsonNotFound(response);
    expect(api.storage.getMovie(movie.id)?.resumePositionSeconds).toBe(0);
  });
});
