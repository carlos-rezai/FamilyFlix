// @vitest-environment node
//
// 70, Video quality, Phase 9 (issue #672): the sheet read back.
//
// At every import site that falls back to the sheet's runtime, the sheet's
// rung of the **Quality ladder** falls back the same way: the probe's quality
// wins, and the sheet's is kept when the probe answers none. So a
// sheet-bearing library imported with no FFmpeg installed keeps its tags.
//
// The runs are real: the fixtures copied into a sandboxed Library folder, their
// CSV sheets given Quality cells, an on-disk library, a real `Media`, and a
// `Playback` over a fake **Playback component** whose probe answers a frame
// per file name (#665's double), or no component at all.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
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
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type { Episode, ImportRun, Movie } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const LOW_WATER = 'Tidewater.S01E01.Low.Water.mp4';
const THE_CROSSING = 'Tidewater.S01E02.The.Crossing.mp4';

/**
 * The coded frame the probe names for some fixture videos, by file name;
 * Amelie's and The Crossing's it names none, as for a file it can't measure.
 */
const FRAMES: Record<string, { width: number; height: number }> = {
  'Die.Hard.1988.1080p.mp4': { width: 1920, height: 1080 },
  [LOW_WATER]: { width: 1920, height: 1080 },
};

/** How the probe answers: some frames, no frame, or no component. */
type Prober = 'frames' | 'frameless' | 'none';

function component(prober: 'frames' | 'frameless'): PlaybackComponent {
  return {
    hardwareEncoder: null,
    decoders: () => null,
    probe: (file: string): MediaProbe | null => ({
      container: 'mov,mp4,m4a,3gp,3g2,mj2',
      videoCodec: 'h264',
      frameSize: prober === 'frames' ? (FRAMES[basename(file)] ?? null) : null,
      audioStreams: [
        { codec: 'aac', language: null, title: null, isDefault: false },
      ],
      durationSeconds: 2520,
    }),
    spawn: (): PlaybackProcess => ({
      stdout: Readable.from([]),
      exited: Promise.resolve(0),
      kill: () => undefined,
    }),
  };
}

/**
 * The CSV `text` with each row's Quality cell filled by `cellFor`, from the
 * row's first eight cells (`Type` to `Runtime`, never quoted in the
 * fixtures); `Quality` is the ninth column, as `SHEET_COLUMNS` orders it.
 */
function withQuality(
  text: string,
  cellFor: (cells: string[]) => string | null
): string {
  return text
    .split('\n')
    .map((line, index) => {
      if (index === 0 || line === '') {
        return line;
      }
      const cells = line.split(',', 8);
      const cell = cellFor(cells);
      if (cell === null) {
        return line;
      }
      const at = cells.join(',').length + 1;
      return `${line.slice(0, at)}${cell}${line.slice(at)}`;
    })
    .join('\n');
}

/** The film sheet's Quality cells: off from the probe's, in a stray case. */
const FILM_QUALITY: Record<string, string> = {
  'Amelie (2001)': '4k',
  'Die Hard (1988)': 'sd',
};

/** The series sheet's Quality cells, by `Folder` and `S/E`. */
const EPISODE_QUALITY: Record<string, string> = {
  'Tidewater (2018) 1/1': '4K',
  'Tidewater (2018) 1/2': '480P',
};

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  folder: StoredLibraryFolder;
  sheet: string;
}

function importerOver(dir: string, prober: Prober) {
  const media = join(dir, 'media');
  mkdirSync(media);
  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const playback = createPlayback(
    media,
    fixedSlot(prober === 'none' ? null : component(prober)),
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
  return { storage, importer };
}

/** The film fixture, its CSV sheet given Quality cells. */
function filmSandbox(prober: Prober): Sandbox {
  const dir = sandboxRoot('familyflix-import-sheet-quality-');
  mkdirSync(join(dir, 'films'));
  const { root, sheet } = libraryFixture(join(dir, 'films'), 'library.csv');
  writeFileSync(
    sheet,
    withQuality(readFileSync(sheet, 'utf8'), (cells) =>
      cells[0] === 'Movie' ? (FILM_QUALITY[cells[1]] ?? null) : null
    )
  );
  const { storage, importer } = importerOver(dir, prober);
  return { storage, importer, folder: storage.addLibraryFolder(root), sheet };
}

/** The series fixture, its CSV sheet given Quality cells. */
function seriesSandbox(prober: Prober): Sandbox {
  const dir = sandboxRoot('familyflix-import-sheet-episode-quality-');
  mkdirSync(join(dir, 'shows'));
  const { root, sheet } = seriesFixture(join(dir, 'shows'), 'library.csv');
  writeFileSync(
    sheet,
    withQuality(readFileSync(sheet, 'utf8'), (cells) =>
      cells[0] === 'Episode'
        ? (EPISODE_QUALITY[`${cells[1]} ${cells[2]}/${cells[3]}`] ?? null)
        : null
    )
  );
  const { storage, importer } = importerOver(dir, prober);
  return { storage, importer, folder: storage.addLibraryFolder(root), sheet };
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

/** One sheet run in link mode, then the run let go. */
async function sheetRun(box: Sandbox): Promise<void> {
  await box.importer.start(box.sheet, false, 'link');
  await untilReview(box.importer);
  await box.importer.cancel();
}

function movieTitled(storage: LibraryStorage, title: string): Movie {
  const movie = storage
    .listMovies({ sort: 'a-z' })
    .find((each) => each.title === title);
  if (movie === undefined) {
    throw new Error(`the library holds no ${title}`);
  }
  return movie;
}

function episodeOf(storage: LibraryStorage, file: string): Episode {
  for (const series of storage.getSeriesHome().series) {
    for (const episode of storage.listEpisodes(series.id)) {
      if (basename(episode.videoPath) === file) {
        return episode;
      }
    }
  }
  throw new Error(`the library holds no episode from ${file}`);
}

describe('createImporter — a film’s quality from the sheet', () => {
  it('the probe’s quality wins; the sheet’s stands in where it answers none', async () => {
    const box = filmSandbox('frames');

    await sheetRun(box);

    expect(movieTitled(box.storage, 'Die Hard').videoQuality).toBe('1080p');
    expect(movieTitled(box.storage, 'Amélie').videoQuality).toBe('4K');
  });

  it.each([
    ['no FFmpeg installed', 'none'],
    ['a probe that names no frame', 'frameless'],
  ] as const)('keeps the sheet’s quality under %s', async (_name, prober) => {
    const box = filmSandbox(prober);

    await sheetRun(box);

    expect(movieTitled(box.storage, 'Amélie').videoQuality).toBe('4K');
    expect(movieTitled(box.storage, 'Die Hard').videoQuality).toBe('SD');
  });
});

describe('createImporter — an episode’s quality from the sheet', () => {
  it('the probe’s quality wins; the sheet’s stands in where it answers none', async () => {
    const box = seriesSandbox('frames');

    await sheetRun(box);

    expect(episodeOf(box.storage, LOW_WATER).videoQuality).toBe('1080p');
    expect(episodeOf(box.storage, THE_CROSSING).videoQuality).toBe('480p');
  });

  it.each([
    ['no FFmpeg installed', 'none'],
    ['a probe that names no frame', 'frameless'],
  ] as const)('keeps the sheet’s quality under %s', async (_name, prober) => {
    const box = seriesSandbox(prober);

    await sheetRun(box);

    expect(episodeOf(box.storage, LOW_WATER).videoQuality).toBe('4K');
    expect(episodeOf(box.storage, THE_CROSSING).videoQuality).toBe('480p');
  });
});
