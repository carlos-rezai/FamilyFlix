// @vitest-environment node
//
// 70 — Video quality, Phase 3: "episodes measured" (issue #666), the bulk
// import's half.
//
// A **Bulk import**'s **Episodes** store their rung of the **Quality ladder**
// from the one probe that reads their runtime:
//
// - each episode with a video stores `video_quality`, in either **Import
//   mode** and from a sheet run;
// - one probe per episode file still;
// - an episode nothing could probe imports with a `NULL` quality.
//
// The runs are real: the series fixture (_Tidewater_ and _Harbor & Vine_)
// copied into a sandboxed Library folder, an on-disk library with a raw handle
// for the stored column, a real `Media`, and a `Playback` over a fake
// **Playback component** whose probe answers a frame per file name and counts
// how often each file was probed (#665's double).

import { mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { openDatabase, type SqliteDatabase } from '../../db';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../../playback/ffmpegComponent/ffmpegComponent';
import type { MediaProbe } from '../../playback/probe/probe';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type { Episode, ImportMode, ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const LOW_WATER = 'Tidewater.S01E01.Low.Water.mp4';
const THE_CROSSING = 'Tidewater.S01E02.The.Crossing.mp4';
const PILOT = 'Harbor.and.Vine.S01E01.Pilot.mp4';
const NIGHT_MARKET = 'Harbor.and.Vine.S01E02.The.Night.Market.mp4';

/** Each fixture episode's coded frame, by file name. */
const FRAMES: Record<string, { width: number; height: number }> = {
  [LOW_WATER]: { width: 1920, height: 1080 },
  [THE_CROSSING]: { width: 1280, height: 720 },
  [PILOT]: { width: 854, height: 480 },
  [NIGHT_MARKET]: { width: 640, height: 360 },
};

/** How the fake component answers a probe. */
type Prober = 'frames' | 'frameless' | 'throws';

interface CountingComponent extends PlaybackComponent {
  /** How many times each file was probed, by file name. */
  probes: Map<string, number>;
}

function countingComponent(prober: Prober): CountingComponent {
  const probes = new Map<string, number>();
  return {
    probes,
    hardwareEncoder: null,
    decoders: () => null,
    probe: (file: string): MediaProbe | null => {
      const name = basename(file);
      probes.set(name, (probes.get(name) ?? 0) + 1);
      if (prober === 'throws') {
        throw new Error('the component died mid-answer');
      }
      return {
        container: 'mov,mp4,m4a,3gp,3g2,mj2',
        videoCodec: 'h264',
        frameSize: prober === 'frames' ? (FRAMES[name] ?? null) : null,
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

interface Sandbox {
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  component: CountingComponent | null;
  folder: StoredLibraryFolder;
  sheet: string;
}

/** The series fixture as the one listed Library folder, over a component. */
function sandbox(prober: Prober | 'none'): Sandbox {
  const dir = sandboxRoot('familyflix-import-episode-quality-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'shows'));
  const { root, sheet } = seriesFixture(join(dir, 'shows'), 'library.csv');

  const dbPath = join(dir, 'familyflix.db');
  const storage = track(createSqliteStorage(dbPath));
  const db = track(openDatabase(dbPath));
  const component = prober === 'none' ? null : countingComponent(prober);
  const playback = createPlayback(
    media,
    fixedSlot(component),
    (id) =>
      storage.libraryFolders().find((folder) => folder.id === id)?.path ?? null
  );
  const importer = createImporter({
    storage,
    media: createMedia(media, unfittedArt()),
    playback,
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
  });
  return {
    storage,
    db,
    importer,
    component,
    folder: storage.addLibraryFolder(root),
    sheet,
  };
}

async function untilReview(importer: Importer): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const run = importer.current();
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** One whole scan of the Library folder in this mode, then the run let go. */
async function scanOnce(box: Sandbox, mode: ImportMode): Promise<ImportRun> {
  await box.importer.scan([box.folder], false, mode);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

/** Every imported episode, by its video's file name. */
function episodesByFile(storage: LibraryStorage): Map<string, Episode> {
  const byFile = new Map<string, Episode>();
  for (const series of storage.getSeriesHome().series) {
    for (const episode of storage.listEpisodes(series.id)) {
      byFile.set(basename(episode.videoPath), episode);
    }
  }
  return byFile;
}

function episodeOf(storage: LibraryStorage, file: string): Episode {
  const episode = episodesByFile(storage).get(file);
  if (episode === undefined) {
    throw new Error(`the library holds no episode from ${file}`);
  }
  return episode;
}

const storedQuality = (db: SqliteDatabase, id: string): string | null =>
  (
    db.prepare('SELECT video_quality FROM episodes WHERE id = ?').get(id) as {
      video_quality: string | null;
    }
  ).video_quality;

describe('createImporter — a Bulk import stores each episode’s quality', () => {
  it.each(['link', 'copy'] as const)(
    'a %s scan stores each Tidewater and Harbor & Vine episode’s rung',
    async (mode) => {
      const box = sandbox('frames');

      await scanOnce(box, mode);

      const expected: Record<string, string> = {
        [LOW_WATER]: '1080p',
        [THE_CROSSING]: '720p',
        [PILOT]: '480p',
        [NIGHT_MARKET]: 'SD',
      };
      for (const [file, quality] of Object.entries(expected)) {
        const episode = episodeOf(box.storage, file);
        expect(episode.videoQuality).toBe(quality);
        expect(storedQuality(box.db, episode.id)).toBe(quality);
      }
    }
  );

  it('a sheet run stores each Tidewater episode’s rung', async () => {
    const box = sandbox('frames');

    await box.importer.start(box.sheet, false, 'link');
    await untilReview(box.importer);
    await box.importer.cancel();

    expect(episodeOf(box.storage, LOW_WATER).videoQuality).toBe('1080p');
    expect(episodeOf(box.storage, THE_CROSSING).videoQuality).toBe('720p');
  });

  it('measures each episode from the one probe that reads its runtime', async () => {
    const box = sandbox('frames');

    await scanOnce(box, 'link');

    expect(episodeOf(box.storage, LOW_WATER).videoQuality).toBe('1080p');
    expect(Object.fromEntries(box.component?.probes ?? [])).toEqual({
      [LOW_WATER]: 1,
      [THE_CROSSING]: 1,
      [PILOT]: 1,
      [NIGHT_MARKET]: 1,
    });
  });
});

describe('createImporter — an episode nothing could probe', () => {
  it.each([
    ['no Playback component', 'none'],
    ['a probe that names no frame', 'frameless'],
    ['a probe that throws', 'throws'],
  ] as const)('imports with a NULL quality under %s', async (_name, prober) => {
    const box = sandbox(prober);

    await scanOnce(box, 'link');

    const episodes = [...episodesByFile(box.storage).values()];
    expect(episodes).toHaveLength(4);
    for (const episode of episodes) {
      expect(episode.videoQuality).toBeNull();
      expect(storedQuality(box.db, episode.id)).toBeNull();
    }
  });
});
