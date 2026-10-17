// @vitest-environment node
//
// 44 — Episode stills, Phase 3 (issue #384): the Sync falls back to a frame.
//
// A Sync's show pass takes a **Frame still** where TMDB has no **Still**:
// for an episode TMDB lists without one, and for an episode TMDB does not list
// at all. `createEnrichment` takes a `Playback`, and a `frame` plan asks it
// for a picture of the episode's own video — stored as `<stem>.frame.jpg` in
// the Series folder's `season-NN/` with source `'frame'`, and logged
// `▣ <name>  →  <stored>`. A failed store is silent and leaves the gradient;
// a failed TMDB image never falls back to a frame.
//
// Issue #390: a frame that does not come still leaves the gradient, but is no
// longer silent. `frame` answers `{ kind: 'none', reason }`, and the Sync logs
// one scan line per such episode naming it and the reason in words —
// `▣ S01E01  no frame: no component` — save `aborted`, which is a Stop and
// logs nothing. A series picked in the review takes its frames as a
// confident match does, through the same show pass.
//
// Composed over a real in-memory library, a real `Media` over a sandbox, a
// fake TMDB, and a Playback whose `frame` is scripted — no real ffmpeg runs.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import { ENRICH_FIELDS, type EnrichField, type StoredVideo } from '@/types';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
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
import { createEnrichment } from './createEnrichment';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';

const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];
const SHOW_ID = 72001;
const TITLE = 'The Hollow Coast';
const FRAME_BYTES = 'a frame off the video';

/**
 * A TMDB that knows the show — no poster or backdrop of its own, so the only
 * image asked for is an episode's still. Season 1 lists E01 with no still and
 * E02 with one; E03 is not listed at all. Handed several search results, the
 * show is not **Confident** and goes to the review.
 */
function knowsTheShow(
  results = [tmdbTvResult(SHOW_ID, TITLE, 2018)]
): FakeTmdb {
  return fakeTmdb({
    tvSearches: { [TITLE]: results },
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
            still_path: '/s01e02.jpg',
          },
        ]),
      },
    },
  });
}

/** A TMDB that finds nothing: the show stays **Unmatched**. */
const findsNothing = (): FakeTmdb => fakeTmdb({ tvSearches: { [TITLE]: [] } });

type Frame = Playback['frame'];

/** A frame that answers a picture at once. */
const pictured: Frame = async () => ({
  kind: 'frame',
  picture: Readable.from([Buffer.from(FRAME_BYTES)]),
});

interface Options {
  client?: FakeTmdb;
  frame?: Frame;
  /** Swap the media domain, to fail a store. */
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
  const root = sandboxRoot('familyflix-frame-still-');
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
  async function addShow(
    onDisk: Array<[season: number, number: number]> = [
      [1, 1],
      [1, 2],
      [1, 3],
    ]
  ) {
    const reserved = realMedia.reserveFolder(TITLE, 2018);
    const series = storage.addSeries({ title: TITLE, year: 2018 });
    for (const [season, number] of onDisk) {
      const videoPath = await realMedia.storeUpload(
        realMedia.seasonFolder(reserved, season),
        `${stem(season, number)}.mkv`,
        Readable.from([Buffer.from('video bytes')])
      );
      storage.addEpisode(series.id, { season, number, videoPath });
    }
    // The Series folder as a Stored path: relative to the media root.
    return { id: series.id, folder: storedFolder(root, reserved) };
  }

  return { storage, client, enrichment, frame: frameMock, root, addShow };
}

/** An absolute folder under the media root, as a Stored path. */
const storedFolder = (root: string, absolute: string) =>
  relative(root, absolute).split(sep).join('/');

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

function sync(
  enrichment: ReturnType<typeof world>['enrichment'],
  fields: EnrichField[] = ALL_FIELDS
) {
  return enrichment.start({
    scope: 'all',
    fields,
    writeSheet: false,
    writePosters: false,
  });
}

/** The video paths `frame` was asked about, in order. */
const framedVideos = (frame: ReturnType<typeof world>['frame']) =>
  frame.mock.calls.map(([video]) => video.videoPath);

/** The run's `▣` lines. */
const frameLines = (log: ReadonlyArray<{ text: string }>) =>
  log.filter((line) => line.text.startsWith('▣'));

/** Every file under a directory, relative to it, sorted. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const full = join(at, name);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(relative(dir, full));
    }
  };
  walk(dir);
  return found.sort();
}

describe('createEnrichment: a frame where TMDB has no still', () => {
  it('takes a frame for an episode TMDB lists without a still', async () => {
    const { enrichment, storage, frame, root, addShow } = world();
    const { id, folder } = await addShow();

    await sync(enrichment);
    await reviewed(enrichment);

    const episode = episodeOf(storage, id, 1, 1);
    expect(framedVideos(frame)).toContain(episode.videoPath);
    expect(episode.stillPath).toBe(`${folder}/season-01/S01E01.frame.jpg`);
    expect(readFileSync(join(root, episode.stillPath ?? ''), 'utf8')).toBe(
      FRAME_BYTES
    );
    expect(storage.stillSourcesOf(id).get(episode.id)).toBe('frame');
  });

  it('takes a frame for an episode TMDB does not list', async () => {
    const { enrichment, storage, frame, root, addShow } = world();
    const { id, folder } = await addShow();

    await sync(enrichment);
    await reviewed(enrichment);

    const episode = episodeOf(storage, id, 1, 3);
    expect(framedVideos(frame)).toContain(episode.videoPath);
    expect(episode.stillPath).toBe(`${folder}/season-01/S01E03.frame.jpg`);
    expect(readFileSync(join(root, episode.stillPath ?? ''), 'utf8')).toBe(
      FRAME_BYTES
    );
    expect(storage.stillSourcesOf(id).get(episode.id)).toBe('frame');
  });

  it('asks the frame of the episode’s own StoredVideo, under the run’s signal', async () => {
    const { enrichment, storage, frame, addShow } = world();
    const { id } = await addShow([[1, 1]]);

    await sync(enrichment);
    await reviewed(enrichment);

    const episode = episodeOf(storage, id, 1, 1);
    expect(frame).toHaveBeenCalledTimes(1);
    const [video, signal] = frame.mock.calls[0] as [StoredVideo, AbortSignal];
    expect(video).toMatchObject({
      videoPath: episode.videoPath,
      videoFolderId: null,
    });
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('takes TMDB’s still where it offers one, and no frame for it', async () => {
    const { enrichment, storage, frame, addShow } = world();
    const { id, folder } = await addShow();

    await sync(enrichment);
    await reviewed(enrichment);

    const episode = episodeOf(storage, id, 1, 2);
    expect(framedVideos(frame)).not.toContain(episode.videoPath);
    expect(episode.stillPath).toBe(`${folder}/season-01/S01E02.still.jpg`);
    expect(storage.stillSourcesOf(id).get(episode.id)).toBe('tmdb');
  });

  it('logs one ▣ line per frame, as a scan line', async () => {
    const { enrichment, storage, addShow } = world();
    const { id } = await addShow();

    await sync(enrichment);
    const run = await reviewed(enrichment);

    const first = episodeOf(storage, id, 1, 1).stillPath;
    const third = episodeOf(storage, id, 1, 3).stillPath;
    expect(frameLines(run.log)).toEqual([
      { text: `▣ S01E01.frame.jpg  →  ${first}`, kind: 'scan' },
      { text: `▣ S01E03.frame.jpg  →  ${third}`, kind: 'scan' },
    ]);
  });
});

describe('createEnrichment: when no frame is taken', () => {
  it('takes none with the Poster chip off', async () => {
    const { enrichment, storage, frame, addShow } = world();
    const { id } = await addShow();

    await sync(
      enrichment,
      ALL_FIELDS.filter((field) => field !== 'poster')
    );
    const run = await reviewed(enrichment);

    expect(frame).not.toHaveBeenCalled();
    expect(storage.listEpisodes(id).map((each) => each.stillPath)).toEqual([
      null,
      null,
      null,
    ]);
    expect(frameLines(run.log)).toEqual([]);
  });

  it('takes none after a failed TMDB image — that episode keeps its gap', async () => {
    const client = knowsTheShow();
    // The show has no poster or backdrop: the first image asked is E02's still.
    client.fail('image', 1, 'unreachable');
    const { enrichment, storage, frame, addShow } = world({ client });
    const { id } = await addShow();

    await sync(enrichment);
    await reviewed(enrichment);

    const episode = episodeOf(storage, id, 1, 2);
    expect(framedVideos(frame)).not.toContain(episode.videoPath);
    expect(episode.stillPath).toBeNull();
    expect(storage.stillSourcesOf(id).has(episode.id)).toBe(false);
    expect(storage.seriesInScope('missing').map((each) => each.id)).toContain(
      id
    );
  });

  it('takes none for season 0', async () => {
    const { enrichment, storage, frame, addShow } = world();
    const { id } = await addShow([
      [0, 1],
      [1, 1],
    ]);

    await sync(enrichment);
    await reviewed(enrichment);

    const special = episodeOf(storage, id, 0, 1);
    expect(framedVideos(frame)).not.toContain(special.videoPath);
    expect(special.stillPath).toBeNull();
  });

  it('takes none for an Unmatched show', async () => {
    const { enrichment, storage, frame, addShow } = world({
      client: findsNothing(),
    });
    const { id } = await addShow();

    await sync(enrichment);
    await reviewed(enrichment);

    expect(frame).not.toHaveBeenCalled();
    expect(storage.listEpisodes(id).map((each) => each.stillPath)).toEqual([
      null,
      null,
      null,
    ]);
  });
});

describe('createEnrichment: a frame that does not land', () => {
  it.each([
    ['no-component', 'no component'],
    ['missing', 'missing'],
    ['unreachable', 'unreachable'],
    ['no-duration', 'no duration'],
    ['timed-out', 'timed out'],
    ['failed', 'failed'],
  ] as const)(
    'leaves the gradient and logs one line naming the reason: %s',
    async (reason, words) => {
      const { enrichment, storage, frame, addShow } = world({
        frame: async () => ({ kind: 'none', reason }),
      });
      const { id } = await addShow([[1, 1]]);

      await sync(enrichment);
      const run = await reviewed(enrichment);

      expect(frame).toHaveBeenCalledTimes(1);
      const episode = episodeOf(storage, id, 1, 1);
      expect(episode.stillPath).toBeNull();
      expect(storage.stillSourcesOf(id).has(episode.id)).toBe(false);
      expect(frameLines(run.log)).toEqual([
        { text: `▣ S01E01  no frame: ${words}`, kind: 'scan' },
      ]);
      expect(run.decisions).toEqual([]);
    }
  );

  it('logs one no-frame line per episode that gets none, beside the frames that came', async () => {
    const { enrichment, storage, addShow } = world({
      frame: async (video) =>
        video.videoPath.endsWith('S01E03.mkv')
          ? { kind: 'none', reason: 'no-duration' }
          : pictured(video, new AbortController().signal),
    });
    const { id } = await addShow();

    await sync(enrichment);
    const run = await reviewed(enrichment);

    const first = episodeOf(storage, id, 1, 1).stillPath;
    expect(frameLines(run.log)).toEqual([
      { text: `▣ S01E01.frame.jpg  →  ${first}`, kind: 'scan' },
      { text: '▣ S01E03  no frame: no duration', kind: 'scan' },
    ]);
  });

  it('leaves the gradient and logs nothing when the frame cannot be stored', async () => {
    const { enrichment, storage, frame, addShow } = world({
      media: (real) => ({
        ...real,
        storeNamed: (folder, name, source, season) =>
          name.endsWith('.frame.jpg')
            ? Promise.reject(new Error('disk full'))
            : real.storeNamed(folder, name, source, season),
      }),
    });
    const { id } = await addShow([[1, 1]]);

    await sync(enrichment);
    const run = await reviewed(enrichment);

    expect(frame).toHaveBeenCalledTimes(1);
    const episode = episodeOf(storage, id, 1, 1);
    expect(episode.stillPath).toBeNull();
    expect(storage.stillSourcesOf(id).has(episode.id)).toBe(false);
    expect(frameLines(run.log)).toEqual([]);
  });
});

describe('createEnrichment: Stop aborts a frame in flight', () => {
  it('aborts the frame’s signal, stores nothing and takes no further frame', async () => {
    let asked: AbortSignal | null = null;
    // A grab that runs until it is stopped, answering `aborted` as `frame` does.
    const held: Frame = (_video, signal) => {
      asked = signal;
      return new Promise((resolve) => {
        signal.addEventListener('abort', () =>
          resolve({ kind: 'none', reason: 'aborted' })
        );
      });
    };
    const { enrichment, storage, frame, addShow } = world({ frame: held });
    const { id } = await addShow([
      [1, 1],
      [1, 3],
    ]);

    await sync(enrichment);
    await vi.waitFor(() => {
      expect(frame).toHaveBeenCalledTimes(1);
    });
    enrichment.cancel();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect((asked as AbortSignal | null)?.aborted).toBe(true);
    expect(enrichment.current()).toBeNull();
    expect(frame).toHaveBeenCalledTimes(1);
    expect(storage.listEpisodes(id).map((each) => each.stillPath)).toEqual([
      null,
      null,
    ]);
  });
});

describe('createEnrichment: a frame of a Linked video', () => {
  it('stores the frame in the Series folder, and the Library folder gains no file', async () => {
    const { enrichment, storage, frame, root } = world();
    const libraryFolder = join(
      sandboxRoot('familyflix-frame-linked-'),
      'Shows'
    );
    mkdirSync(join(libraryFolder, TITLE, 'Season 01'), { recursive: true });
    writeFileSync(
      join(libraryFolder, TITLE, 'Season 01', 'S01E01.mkv'),
      'video bytes'
    );
    const listed = storage.addLibraryFolder(libraryFolder);
    const folder = storedFolder(
      root,
      createMedia(root).reserveFolder(TITLE, 2018)
    );
    const series = storage.addSeries({
      title: TITLE,
      year: 2018,
      mediaFolder: folder,
    });
    const linked = storage.addEpisode(series.id, {
      season: 1,
      number: 1,
      videoPath: `${TITLE}/Season 01/S01E01.mkv`,
      videoFolderId: listed.id,
    });

    await sync(enrichment);
    await reviewed(enrichment);

    expect(frame.mock.calls[0]?.[0]).toMatchObject({
      videoPath: `${TITLE}/Season 01/S01E01.mkv`,
      videoFolderId: listed.id,
    });
    expect(episodeOf(storage, series.id, 1, 1).stillPath).toBe(
      `${folder}/season-01/S01E01.frame.jpg`
    );
    expect(storage.stillSourcesOf(series.id).get(linked.id)).toBe('frame');
    expect(filesUnder(libraryFolder)).toEqual([
      join(TITLE, 'Season 01', 'S01E01.mkv'),
    ]);
  });
});

describe('createEnrichment: a series picked in the review', () => {
  /** Two shows answer the search, so the show waits on an ambiguous Decision. */
  const ambiguous = () =>
    knowsTheShow([
      tmdbTvResult(SHOW_ID, TITLE, 2018),
      tmdbTvResult(SHOW_ID + 1, TITLE, 2011),
    ]);

  it('takes its frames on the pick, as a confident match does', async () => {
    const { enrichment, storage, frame, addShow } = world({
      client: ambiguous(),
    });
    const { id, folder } = await addShow();

    await sync(enrichment);
    const run = await reviewed(enrichment);
    expect(run.decisions).toHaveLength(1);
    expect(frame).not.toHaveBeenCalled();

    const [decision] = run.decisions;
    expect(await enrichment.pick(decision.id, SHOW_ID)).toEqual({
      kind: 'picked',
    });

    expect(episodeOf(storage, id, 1, 1).stillPath).toBe(
      `${folder}/season-01/S01E01.frame.jpg`
    );
    expect(episodeOf(storage, id, 1, 3).stillPath).toBe(
      `${folder}/season-01/S01E03.frame.jpg`
    );
  });

  it('logs a no-frame line for an episode the pick gets no frame for', async () => {
    const { enrichment, storage, addShow } = world({
      client: ambiguous(),
      frame: async (video) =>
        video.videoPath.endsWith('S01E03.mkv')
          ? { kind: 'none', reason: 'unreachable' }
          : pictured(video, new AbortController().signal),
    });
    const { id } = await addShow();

    await sync(enrichment);
    const [decision] = (await reviewed(enrichment)).decisions;
    await enrichment.pick(decision.id, SHOW_ID);

    const first = episodeOf(storage, id, 1, 1).stillPath;
    expect(frameLines(enrichment.current()?.log ?? [])).toEqual([
      { text: `▣ S01E01.frame.jpg  →  ${first}`, kind: 'scan' },
      { text: '▣ S01E03  no frame: unreachable', kind: 'scan' },
    ]);
  });
});
