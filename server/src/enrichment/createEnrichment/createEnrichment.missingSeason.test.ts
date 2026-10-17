// @vitest-environment node
//
// Issue #389 — a library Sync stopped at the first TMDB 404 or 429.
//
// A season the folder has but TMDB does not list answers **not-found**, and
// that is not a Stop: `writeShow` skips its TMDB half with one log line,
// `⚠ <Show>: TMDB has no season N`, still runs its episodes through
// `writeEpisodes` with no TMDB episode — so each takes a **Frame still** —
// writes the seasons after it, and the run moves on to the next title. Only a
// real loss of connection, or a `401`, stops the run.
//
// Composed over a real in-memory library, a real `Media` over a sandbox, a
// fake TMDB, and a Playback whose `frame` is scripted — no real ffmpeg runs.

import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import { ENRICH_FIELDS, type EnrichField } from '@/types';
import { createMedia } from '../../media/createMedia/createMedia';
import type { Playback } from '../../playback/createPlayback/createPlayback';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY,
  tmdbSeason,
  tmdbTvDetail,
  tmdbTvResult,
  type FakeTmdb,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';
import { createEnrichment } from './createEnrichment';

const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];
const FRAME_BYTES = 'a frame off the video';

/** The first title in the queue: TMDB lists its seasons 1 and 3, never 2. */
const FIRST = { id: 73001, title: 'Alpha Shore', year: 2016 };
/** The title queued after it: one season, all listed. */
const NEXT = { id: 72001, title: 'The Hollow Coast', year: 2018 };

const episode = (number: number, name: string) => ({
  episode_number: number,
  name,
  air_date: '2016-01-01',
  runtime: 45,
  still_path: null,
});

/** A TMDB that knows both shows; the first one's season 2 is not listed. */
function knowsBothShows(): FakeTmdb {
  return fakeTmdb({
    tvSearches: {
      [FIRST.title]: [tmdbTvResult(FIRST.id, FIRST.title, FIRST.year)],
      [NEXT.title]: [tmdbTvResult(NEXT.id, NEXT.title, NEXT.year)],
    },
    shows: [
      tmdbTvDetail(FIRST.id, FIRST.title, FIRST.year, {
        overview: 'A lighthouse keeper’s daughters.',
        poster_path: null,
        backdrop_path: null,
      }),
      tmdbTvDetail(NEXT.id, NEXT.title, NEXT.year, {
        overview: 'A fishing town keeps the secret the sea gave back.',
        poster_path: null,
        backdrop_path: null,
      }),
    ],
    seasons: {
      [FIRST.id]: {
        1: tmdbSeason(1, [episode(1, 'First Light')], { poster_path: null }),
        3: tmdbSeason(3, [episode(1, 'Third Light')], { poster_path: null }),
      },
      [NEXT.id]: {
        1: tmdbSeason(1, [episode(1, 'Low Tide')], { poster_path: null }),
      },
    },
  });
}

type Frame = Playback['frame'];
const pictured: Frame = async () => ({
  kind: 'frame',
  picture: Readable.from([Buffer.from(FRAME_BYTES)]),
});

/** The `kind` the season call answers, as the fake's own `fail` takes it. */
type FailKind = Parameters<FakeTmdb['fail']>[2];

/** A keyed library holding both shows, a sandbox media root, the domain. */
async function world() {
  const storage = freshStorage();
  storage.setTmdbKey(TMDB_KEY);
  const root = sandboxRoot('familyflix-missing-season-');
  const media = createMedia(root);
  const frame = vi.fn<Frame>(pictured);
  const client = knowsBothShows();
  const enrichment = createEnrichment({
    storage,
    client,
    media,
    playback: framelessPlayback(frame),
  });

  async function addShow(
    show: { title: string; year: number },
    onDisk: Array<[season: number, number: number]>
  ) {
    const reserved = media.reserveFolder(show.title, show.year);
    const series = storage.addSeries({ title: show.title, year: show.year });
    for (const [season, number] of onDisk) {
      const videoPath = await media.storeUpload(
        media.seasonFolder(reserved, season),
        `${stem(season, number)}.mkv`,
        Readable.from([Buffer.from('video bytes')])
      );
      storage.addEpisode(series.id, { season, number, videoPath });
    }
    return {
      id: series.id,
      folder: relative(root, reserved).split(sep).join('/'),
    };
  }

  const first = await addShow(FIRST, [
    [1, 1],
    [2, 1],
    [3, 1],
  ]);
  const next = await addShow(NEXT, [[1, 1]]);
  return { storage, client, enrichment, frame, root, first, next };
}

const stem = (season: number, number: number) =>
  `S${String(season).padStart(2, '0')}E${String(number).padStart(2, '0')}`;

type Storage = ReturnType<typeof freshStorage>;

function episodeOf(
  storage: Storage,
  id: string,
  season: number,
  number: number
) {
  const found = storage
    .listEpisodes(id)
    .find((each) => each.season === season && each.number === number);
  if (found === undefined) throw new Error(`no S${season}E${number}`);
  return found;
}

function sync(enrichment: Awaited<ReturnType<typeof world>>['enrichment']) {
  return enrichment.start({
    scope: 'all',
    fields: ALL_FIELDS,
    writeSheet: false,
    writePosters: false,
  });
}

/** The first show's season 2 — its second `season` call — answered `kind`. */
function seasonTwoAnswers(client: FakeTmdb, kind: FailKind) {
  client.fail('season', 2, kind);
}

const LOST_CONNECTION = 'Lost the connection';

describe('createEnrichment: a season TMDB does not list', () => {
  it('logs one warning naming the show and the season', async () => {
    const { enrichment, client } = await world();
    seasonTwoAnswers(client, 'not-found');

    await sync(enrichment);
    const run = await reviewed(enrichment);

    const warning = `⚠ ${FIRST.title}: TMDB has no season 2`;
    const lines = run.log.filter((line) => line.text === warning);
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe('warning');
  });

  it('does not stop the run, nor log a lost connection', async () => {
    const { enrichment, client } = await world();
    seasonTwoAnswers(client, 'not-found');

    await sync(enrichment);
    const run = await reviewed(enrichment);

    expect(run.log.map((line) => line.text)).not.toContainEqual(
      expect.stringContaining(LOST_CONNECTION)
    );
    expect(run.done).toBe(2);
  });

  it('counts the show as matched, its show-level fields written', async () => {
    const { enrichment, client, storage, first } = await world();
    seasonTwoAnswers(client, 'not-found');

    await sync(enrichment);
    const run = await reviewed(enrichment);

    expect(run.enriched).toBe(2);
    expect(storage.getSeries(first.id)?.synopsis).toBe(
      'A lighthouse keeper’s daughters.'
    );
  });

  it('still takes a Frame still for each of that season’s episodes', async () => {
    const { enrichment, client, storage, frame, root, first } = await world();
    seasonTwoAnswers(client, 'not-found');

    await sync(enrichment);
    await reviewed(enrichment);

    const unlisted = episodeOf(storage, first.id, 2, 1);
    expect(frame.mock.calls.map(([video]) => video.videoPath)).toContain(
      unlisted.videoPath
    );
    expect(unlisted.stillPath).toBe(
      `${first.folder}/season-02/S02E01.frame.jpg`
    );
    expect(readFileSync(join(root, unlisted.stillPath ?? ''), 'utf8')).toBe(
      FRAME_BYTES
    );
    expect(storage.stillSourcesOf(first.id).get(unlisted.id)).toBe('frame');
  });

  it('writes the seasons after it', async () => {
    const { enrichment, client, storage, first } = await world();
    seasonTwoAnswers(client, 'not-found');

    await sync(enrichment);
    await reviewed(enrichment);

    expect(episodeOf(storage, first.id, 3, 1).title).toBe('Third Light');
  });

  it('moves on to the next title in the queue', async () => {
    const { enrichment, client, storage, next } = await world();
    seasonTwoAnswers(client, 'not-found');

    await sync(enrichment);
    await reviewed(enrichment);

    expect(client.tv).toHaveBeenCalledWith(
      TMDB_KEY,
      NEXT.id,
      expect.anything()
    );
    expect(storage.getSeries(next.id)?.synopsis).toBe(
      'A fishing town keeps the secret the sea gave back.'
    );
    expect(episodeOf(storage, next.id, 1, 1).title).toBe('Low Tide');
  });
});

describe('createEnrichment: only a lost connection or a 401 stops the run', () => {
  it('stops at an unreachable season, logging the lost connection', async () => {
    const { enrichment, client } = await world();
    seasonTwoAnswers(client, 'unreachable');

    await sync(enrichment);
    const run = await reviewed(enrichment);

    expect(run.log.some((line) => line.text.includes(LOST_CONNECTION))).toBe(
      true
    );
    expect(client.tv).not.toHaveBeenCalledWith(
      TMDB_KEY,
      NEXT.id,
      expect.anything()
    );
  });

  it('stops at a refused season, logging the refused key', async () => {
    const { enrichment, client } = await world();
    seasonTwoAnswers(client, 'refused');

    await sync(enrichment);
    const run = await reviewed(enrichment);

    expect(run.log.some((line) => line.text === 'TMDB refused the key.')).toBe(
      true
    );
    expect(client.tv).not.toHaveBeenCalledWith(
      TMDB_KEY,
      NEXT.id,
      expect.anything()
    );
  });
});
