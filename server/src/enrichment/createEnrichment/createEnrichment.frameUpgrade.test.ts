// @vitest-environment node
//
// 44 — Episode stills, Phase 4 (issue #385): TMDB replaces a frame.
//
// A **Frame still** is the fallback, never the last word. When an episode
// holds a frame and TMDB now offers a **Still**, the Sync's show pass stores
// `<stem>.still.jpg` with source `'tmdb'`, logs `↓`, and then removes the
// frame's file through `media.removeFile`; a failed image leaves the frame as
// it was. A held frame with TMDB offering none is not taken again, and a
// `'tmdb'` or `'picked'` still is never touched.
//
// Unchanged, and guarded here: the **Sync gap** counts `still_path IS NULL`
// only, so a show whose every episode holds a still — frames included —
// leaves _Only what's missing_ while _Everything_ still reaches it; and an
// **Export** carries a frame as it carries any still, under `stills/`, named
// in the `Still` cell, the sheets at sixteen and nine columns.
//
// Composed over a real in-memory library, a real `Media` over a sandbox, a
// fake TMDB, and a Playback whose `frame` is scripted — no real ffmpeg runs.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import {
  ENRICH_FIELDS,
  EXPORT_COLUMNS,
  EXPORT_EPISODE_COLUMNS,
  type EnrichField,
  type EnrichScope,
} from '@/types';
import type { StillSource } from '../../library';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import type { Playback } from '../../playback/createPlayback/createPlayback';
import { writeExport } from '../../import-export/writeExport/writeExport';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY,
  tmdbImageBytes,
  tmdbSeason,
  tmdbTvDetail,
  tmdbTvResult,
  type FakeTmdb,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { createEnrichment } from './createEnrichment';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';

const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];
const SHOW_ID = 72001;
const TITLE = 'The Hollow Coast';
const FRAME_BYTES = 'a frame off the video';
const HELD_BYTES = 'the still already held';
const E02_STILL = '/s01e02.jpg';

/**
 * A TMDB that knows the show — no poster or backdrop of its own, so the only
 * image asked for is an episode's still. Season 1 lists E01 with no still and
 * E02 with one; E03 is not listed at all.
 */
function knowsTheShow(): FakeTmdb {
  return fakeTmdb({
    tvSearches: { [TITLE]: [tmdbTvResult(SHOW_ID, TITLE, 2018)] },
    shows: [
      tmdbTvDetail(SHOW_ID, TITLE, 2018, {
        poster_path: null,
        backdrop_path: null,
      }),
    ],
    seasons: {
      [SHOW_ID]: {
        1: tmdbSeason(1, [
          {
            episode_number: 1,
            name: 'Low Tide',
            air_date: '2018-09-02',
            runtime: 52,
            still_path: null,
          },
          {
            episode_number: 2,
            name: 'Driftwood',
            air_date: '2018-09-09',
            runtime: 49,
            still_path: E02_STILL,
          },
        ]),
      },
    },
  });
}

/**
 * A TMDB with everything a Sync can fill: the show's poster and backdrop, the
 * season's poster, and every episode listed with its title and air date — E02
 * alone with a still, so E01 and E03 can only close their gap with a frame.
 */
function stocksTheShow(): FakeTmdb {
  return fakeTmdb({
    tvSearches: { [TITLE]: [tmdbTvResult(SHOW_ID, TITLE, 2018)] },
    shows: [tmdbTvDetail(SHOW_ID, TITLE, 2018)],
    seasons: {
      [SHOW_ID]: {
        1: tmdbSeason(
          1,
          [
            {
              episode_number: 1,
              name: 'Low Tide',
              air_date: '2018-09-02',
              runtime: 52,
              still_path: null,
            },
            {
              episode_number: 2,
              name: 'Driftwood',
              air_date: '2018-09-09',
              runtime: 49,
              still_path: E02_STILL,
            },
            {
              episode_number: 3,
              name: 'Undertow',
              air_date: '2018-09-16',
              runtime: 50,
              still_path: null,
            },
          ],
          { poster_path: '/season-1.jpg' }
        ),
      },
    },
  });
}

type Frame = Playback['frame'];

/** A frame that answers a picture at once. */
const pictured: Frame = async () => Readable.from([Buffer.from(FRAME_BYTES)]);

interface Options {
  client?: FakeTmdb;
  frame?: Frame;
  /** Swap the media domain, to watch a removal. */
  media?: (real: Media) => Media;
}

/** A keyed library, a sandbox media root, a scripted Playback, the domain. */
function world({
  client = knowsTheShow(),
  frame = pictured,
  media,
}: Options = {}) {
  const storage = freshStorage();
  storage.setTmdbKey(TMDB_KEY);
  const root = sandboxRoot('familyflix-frame-upgrade-');
  const realMedia = createMedia(root);
  const frameMock = vi.fn<Frame>(frame);
  const playback = framelessPlayback(frameMock);
  const enrichment = createEnrichment({
    storage,
    client,
    media: media === undefined ? realMedia : media(realMedia),
    playback,
  });

  /** The show, each episode's video really in its season folder. */
  async function addShow() {
    const reserved = realMedia.reserveFolder(TITLE, 2018);
    const series = storage.addSeries({ title: TITLE, year: 2018 });
    for (const number of [1, 2, 3]) {
      const videoPath = await realMedia.storeUpload(
        realMedia.seasonFolder(reserved, 1),
        `${stem(number)}.mkv`,
        Readable.from([Buffer.from('video bytes')])
      );
      storage.addEpisode(series.id, { season: 1, number, videoPath });
    }
    // The Series folder as a Stored path: relative to the media root.
    const folder = relative(root, reserved).split(sep).join('/');

    /** Hold a still for season 1's `number`, as a file and a source. */
    async function hold(
      number: number,
      source: StillSource,
      name = `${stem(number)}.${source === 'frame' ? 'frame' : 'still'}.jpg`,
      bytes = source === 'frame' ? FRAME_BYTES : HELD_BYTES
    ): Promise<string> {
      const stored = await realMedia.storeNamed(
        folder,
        name,
        Readable.from([Buffer.from(bytes)]),
        1
      );
      const episode = episodeOf(storage, series.id, number);
      storage.enrichEpisode(episode.id, {
        stillPath: stored,
        stillSource: source,
      });
      return stored;
    }

    return { id: series.id, folder, hold };
  }

  return { storage, client, enrichment, frame: frameMock, root, addShow };
}

const stem = (number: number) => `S01E${String(number).padStart(2, '0')}`;

type Storage = ReturnType<typeof freshStorage>;

function episodeOf(storage: Storage, id: string, number: number) {
  const found = storage
    .listEpisodes(id)
    .find((each) => each.season === 1 && each.number === number);
  if (found === undefined) throw new Error(`no S1E${number}`);
  return found;
}

function sync(
  enrichment: ReturnType<typeof world>['enrichment'],
  scope: Exclude<EnrichScope, 'single'> = 'all'
) {
  return enrichment.start({
    scope,
    fields: ALL_FIELDS,
    writeSheet: false,
    writePosters: false,
  });
}

/** The video paths `frame` was asked about, in order. */
const framedVideos = (frame: ReturnType<typeof world>['frame']) =>
  frame.mock.calls.map(([video]) => video.videoPath);

/** The TMDB calls made about the show itself: its search, detail or season. */
const showCalls = (client: FakeTmdb) =>
  client.calls.filter(
    (call) =>
      call.method === 'searchTv' ||
      call.method === 'tv' ||
      call.method === 'season'
  ).length;

describe('createEnrichment: TMDB’s still replaces a held frame', () => {
  it('stores .still.jpg with source tmdb, logs ↓, and removes the frame’s file', async () => {
    const { enrichment, storage, root, addShow } = world();
    const { id, folder, hold } = await addShow();
    const frame = await hold(2, 'frame');

    await sync(enrichment);
    const run = await reviewed(enrichment);

    const episode = episodeOf(storage, id, 2);
    const still = `${folder}/season-01/S01E02.still.jpg`;
    expect(episode.stillPath).toBe(still);
    expect(storage.stillSourcesOf(id).get(episode.id)).toBe('tmdb');
    expect(readFileSync(join(root, still), 'utf8')).toBe(
      tmdbImageBytes(E02_STILL)
    );
    expect(run.log.map((line) => line.text)).toContain(
      `↓ S01E02.still.jpg  →  ${still}`
    );
    expect(existsSync(join(root, frame))).toBe(false);
  });

  it('removes the frame through media.removeFile, once the still is written', async () => {
    const removed: string[] = [];
    const { enrichment, storage, addShow } = world({
      media: (real) => ({
        ...real,
        removeFile: (storedPath) => {
          removed.push(storedPath);
          real.removeFile(storedPath);
        },
      }),
    });
    const { id, hold } = await addShow();
    const frame = await hold(2, 'frame');

    await sync(enrichment);
    await reviewed(enrichment);

    expect(removed).toEqual([frame]);
    expect(episodeOf(storage, id, 2).stillPath).not.toBe(frame);
  });
});

describe('createEnrichment: a held frame whose TMDB image fails', () => {
  it('keeps the frame — its path, its source and its file', async () => {
    const client = knowsTheShow();
    // The show has no poster or backdrop: the first image asked is E02's still.
    client.fail('image', 1, 'unreachable');
    const { enrichment, storage, frame, root, addShow } = world({ client });
    const { id, hold } = await addShow();
    const held = await hold(2, 'frame');

    await sync(enrichment);
    await reviewed(enrichment);

    const episode = episodeOf(storage, id, 2);
    expect(episode.stillPath).toBe(held);
    expect(storage.stillSourcesOf(id).get(episode.id)).toBe('frame');
    expect(readFileSync(join(root, held), 'utf8')).toBe(FRAME_BYTES);
    expect(framedVideos(frame)).not.toContain(episode.videoPath);
  });
});

describe('createEnrichment: a held frame TMDB offers no still for', () => {
  it('is not taken again — listed without a still, or not listed at all', async () => {
    const { enrichment, storage, frame, root, addShow } = world();
    const { id, hold } = await addShow();
    const first = await hold(1, 'frame');
    const third = await hold(3, 'frame');

    await sync(enrichment);
    const run = await reviewed(enrichment);

    const e01 = episodeOf(storage, id, 1);
    const e03 = episodeOf(storage, id, 3);
    expect(framedVideos(frame)).not.toContain(e01.videoPath);
    expect(framedVideos(frame)).not.toContain(e03.videoPath);
    expect(e01.stillPath).toBe(first);
    expect(e03.stillPath).toBe(third);
    expect(storage.stillSourcesOf(id).get(e01.id)).toBe('frame');
    expect(storage.stillSourcesOf(id).get(e03.id)).toBe('frame');
    expect(readFileSync(join(root, first), 'utf8')).toBe(FRAME_BYTES);
    expect(readFileSync(join(root, third), 'utf8')).toBe(FRAME_BYTES);
    expect(run.log.filter((line) => line.text.startsWith('▣'))).toEqual([]);
  });
});

describe('createEnrichment: a tmdb or picked still', () => {
  it.each<[StillSource, string]>([
    ['tmdb', 'S01E02.still.jpg'],
    ['picked', 'S01E02-still.jpg'],
  ])(
    'a held %s still is never replaced or removed, though TMDB offers one',
    async (source, name) => {
      const removed: string[] = [];
      const { enrichment, storage, client, frame, root, addShow } = world({
        media: (real) => ({
          ...real,
          removeFile: (storedPath) => {
            removed.push(storedPath);
            real.removeFile(storedPath);
          },
        }),
      });
      const { id, hold } = await addShow();
      const held = await hold(2, source, name);

      await sync(enrichment);
      await reviewed(enrichment);

      const episode = episodeOf(storage, id, 2);
      expect(episode.stillPath).toBe(held);
      expect(storage.stillSourcesOf(id).get(episode.id)).toBe(source);
      expect(readFileSync(join(root, held), 'utf8')).toBe(HELD_BYTES);
      expect(client.image).not.toHaveBeenCalledWith(
        E02_STILL,
        expect.anything()
      );
      expect(framedVideos(frame)).not.toContain(episode.videoPath);
      expect(removed).toEqual([]);
    }
  );

  it.each<StillSource>(['tmdb', 'picked'])(
    'a held %s still where TMDB offers none takes no frame',
    async (source) => {
      const { enrichment, storage, frame, root, addShow } = world();
      const { id, hold } = await addShow();
      const name = source === 'picked' ? 'S01E01-still.jpg' : undefined;
      const held = await hold(1, source, name);

      await sync(enrichment);
      await reviewed(enrichment);

      const episode = episodeOf(storage, id, 1);
      expect(framedVideos(frame)).not.toContain(episode.videoPath);
      expect(episode.stillPath).toBe(held);
      expect(storage.stillSourcesOf(id).get(episode.id)).toBe(source);
      expect(readFileSync(join(root, held), 'utf8')).toBe(HELD_BYTES);
    }
  );
});

describe('createEnrichment: the Sync gap once every episode holds a still', () => {
  it('leaves Only what’s missing with frames among its stills; Everything still reaches it', async () => {
    const client = stocksTheShow();
    const { enrichment, storage, addShow } = world({ client });
    const { id } = await addShow();

    await sync(enrichment);
    await reviewed(enrichment);

    const sources = storage.stillSourcesOf(id);
    expect(
      storage.listEpisodes(id).map((each) => sources.get(each.id))
    ).toEqual(['frame', 'tmdb', 'frame']);
    expect(
      storage.seriesInScope('missing').map((each) => each.id)
    ).not.toContain(id);
    expect(storage.seriesInScope('all').map((each) => each.id)).toContain(id);

    const before = showCalls(client);
    await sync(enrichment, 'missing');
    await reviewed(enrichment);
    expect(showCalls(client)).toBe(before);

    await sync(enrichment, 'all');
    await reviewed(enrichment);
    expect(showCalls(client)).toBeGreaterThan(before);
  });
});

describe('an Export of a show holding a frame', () => {
  it('carries the frame under stills/, named in the Still cell, sixteen and nine columns', async () => {
    const { enrichment, storage, root, addShow } = world();
    const { id } = await addShow();

    await sync(enrichment);
    await reviewed(enrichment);
    expect(storage.stillSourcesOf(id).get(episodeOf(storage, id, 1).id)).toBe(
      'frame'
    );

    const destination = sandboxRoot('familyflix-frame-export-');
    const name = 'familyflix-collection_16-10-2026';
    const detail = storage.getSeriesDetail(id);
    if (detail === null) throw new Error('no series detail');
    const outcome = await writeExport(
      createMedia(root),
      {
        format: 'csv',
        destination,
        name,
        images: true,
        subtitles: false,
      },
      { movies: [], series: [detail] }
    );
    expect(outcome.kind).not.toBe('refused');

    const folder = join(destination, name);
    const rows = (file: string) =>
      readFileSync(join(folder, file), 'utf8')
        .replace(/^\s+/, '') // the BOM
        .split(/\r?\n/)
        .filter((line) => line !== '')
        .map((line) =>
          line.split(',').map((cell) => cell.replace(/^"|"$/g, ''))
        );

    const titles = rows(`${name}.csv`);
    expect(titles[0]).toEqual([...EXPORT_COLUMNS]);

    const episodes = rows(`${name}-episodes.csv`);
    expect(episodes[0]).toEqual([...EXPORT_EPISODE_COLUMNS]);
    const stillAt = EXPORT_EPISODE_COLUMNS.indexOf('Still');
    const e01 = episodes.find((cells) => cells[1] === '1' && cells[2] === '1');
    const cell = e01?.[stillAt] ?? '';
    expect(cell).toMatch(/\/stills\/S01E01\.jpg$/);
    expect(readFileSync(join(folder, ...cell.split('/')), 'utf8')).toBe(
      FRAME_BYTES
    );

    const titleFolder = cell.split('/')[0] ?? '';
    expect(readdirSync(join(folder, titleFolder, 'stills'))).toContain(
      'S01E01.jpg'
    );
  });
});
