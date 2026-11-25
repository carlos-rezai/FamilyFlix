// @vitest-environment node
//
// 70 — Video quality, Phase 2: "every other way a movie gets in" (issue #665).
//
// A **Bulk import**'s movie adds, a **Found again** video and a **Resolve**
// store the rung of the **Quality ladder** from the same probe that reads
// their runtime:
//
// - each stores `video_quality`;
// - one probe per file still, so a large linked import is not slowed by a
//   second spawn;
// - a file nothing could probe imports with a `NULL` quality, never blocked.
//
// The runs are real: the fixture copied into a sandboxed Library folder, an
// on-disk library with a raw handle for the stored column, a real `Media`,
// and a `Playback` over a fake **Playback component** whose probe answers a
// frame per file name and counts how often each file was probed.

import { copyFileSync, mkdirSync } from 'node:fs';
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
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { idleFrameFill } from '../../test-support/idleFrameFill/idleFrameFill';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import type { ImportMode, ImportProblem, ImportRun, Movie } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const DIE_HARD = 'Die Hard (1988)/Die.Hard.1988.1080p.mp4';
const FOUND_FOLDER = 'Last Jedi (2017)';
const FOUND_NAME = 'The Last Jedi (2017).mp4';

/** Each fixture video's coded frame, by file name. */
const FRAMES: Record<string, { width: number; height: number } | null> = {
  'Amelie.mp4': { width: 1280, height: 720 },
  'Die.Hard.1988.1080p.mp4': { width: 1920, height: 1080 },
  [FOUND_NAME]: { width: 3840, height: 1600 },
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
        durationSeconds: 6000,
      };
    },
    spawn: (): PlaybackProcess => ({
      stdout: Readable.from([]),
      exited: Promise.resolve(0),
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

/** The dev fixture as the one listed Library folder, over a component. */
function sandbox(prober: Prober | 'none'): Sandbox {
  const dir = sandboxRoot('familyflix-import-video-quality-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  const { root, sheet } = libraryFixture(join(dir, 'films'), 'library.csv');

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
    frameFill: idleFrameFill(),
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

function movieTitled(storage: LibraryStorage, title: string): Movie {
  const movie = storage
    .listMovies({ sort: 'a-z' })
    .find((each) => each.title === title);
  if (movie === undefined) {
    throw new Error(`the library holds no ${title}`);
  }
  return movie;
}

const storedQuality = (db: SqliteDatabase, id: string): string | null =>
  (
    db.prepare('SELECT video_quality FROM movies WHERE id = ?').get(id) as {
      video_quality: string | null;
    }
  ).video_quality;

describe('createImporter.scan — a Bulk import stores each film’s quality', () => {
  it.each(['link', 'copy'] as const)(
    'a %s scan stores Amelie’s and Die Hard’s rungs',
    async (mode) => {
      const box = sandbox('frames');

      await scanOnce(box, mode);

      const amelie = movieTitled(box.storage, 'Amelie');
      const dieHard = movieTitled(box.storage, 'Die Hard');
      expect(amelie.videoQuality).toBe('720p');
      expect(dieHard.videoQuality).toBe('1080p');
      expect(storedQuality(box.db, amelie.id)).toBe('720p');
      expect(storedQuality(box.db, dieHard.id)).toBe('1080p');
    }
  );

  it('a sheet run stores each film’s quality', async () => {
    const box = sandbox('frames');

    await box.importer.start(box.sheet, false, 'link');
    await untilReview(box.importer);
    await box.importer.cancel();

    expect(movieTitled(box.storage, 'Amélie').videoQuality).toBe('720p');
    expect(movieTitled(box.storage, 'Die Hard').videoQuality).toBe('1080p');
  });

  it('probes each linked video once: the quality costs no second spawn', async () => {
    const box = sandbox('frames');

    await scanOnce(box, 'link');

    expect(Object.fromEntries(box.component?.probes ?? [])).toEqual({
      'Amelie.mp4': 1,
      'Die.Hard.1988.1080p.mp4': 1,
    });
  });
});

describe('createImporter.scan — a file nothing could probe', () => {
  it.each([
    ['no Playback component', 'none'],
    ['a probe that names no frame', 'frameless'],
    ['a probe that throws', 'throws'],
  ] as const)('imports with a NULL quality under %s', async (_name, prober) => {
    const box = sandbox(prober);

    await scanOnce(box, 'link');

    const amelie = movieTitled(box.storage, 'Amelie');
    const dieHard = movieTitled(box.storage, 'Die Hard');
    expect(amelie.videoQuality).toBeNull();
    expect(dieHard.videoQuality).toBeNull();
    expect(storedQuality(box.db, amelie.id)).toBeNull();
    expect(storedQuality(box.db, dieHard.id)).toBeNull();
  });
});

describe('createImporter.scan — a Found again video stores its quality', () => {
  /** A dead copy of the found file's name, its Media folder gone. */
  function foundAgain(): Sandbox & { id: string } {
    const box = sandbox('frames');
    mkdirSync(join(box.folder.path, FOUND_FOLDER));
    copyFileSync(
      join(box.folder.path, 'Amelie (2001)', 'Amelie.mp4'),
      join(box.folder.path, FOUND_FOLDER, FOUND_NAME)
    );
    const dead = box.storage.addMovie(
      newMovie({
        title: 'Star Wars',
        year: 1977,
        videoPath: `star-wars/${FOUND_NAME}`,
        mediaFolder: 'star-wars',
      })
    );
    return { ...box, id: dead.id };
  }

  it.each(['link', 'copy'] as const)(
    'a %s run stores the found video’s rung',
    async (mode) => {
      const box = foundAgain();

      await scanOnce(box, mode);

      expect(storedQuality(box.db, box.id)).toBe('4K');
      expect(movieTitled(box.storage, 'Star Wars').videoQuality).toBe('4K');
    }
  );

  it('probes the found video once', async () => {
    const box = foundAgain();

    await scanOnce(box, 'link');

    expect(box.component?.probes.get(FOUND_NAME)).toBe(1);
  });
});

describe('createImporter.resolve — a Resolve stores its film’s quality', () => {
  /** Die Hard's folder holding a second video: `no-video`, for the form. */
  async function twoVideoDieHard(
    mode: ImportMode,
    prober: Prober | 'none' = 'frames'
  ) {
    const box = sandbox(prober);
    copyFileSync(
      join(box.folder.path, DIE_HARD),
      join(box.folder.path, 'Die Hard (1988)', 'Die.Hard.1988.1080p.mkv')
    );
    await box.importer.start(box.sheet, false, mode);
    const run = await untilReview(box.importer);
    const problem = run.problems.find(
      (each): each is ImportProblem => each.kind === 'no-video'
    );
    if (problem === undefined) {
      throw new Error(`no no-video Problem: ${JSON.stringify(run.problems)}`);
    }
    const dieHard = join(box.folder.path, 'Die Hard (1988)');
    const form = {
      title: 'Die Hard',
      year: 1988,
      director: null,
      synopsis: null,
      rating: null,
      cast: [],
      genres: [],
      video: { found: join(dieHard, 'Die.Hard.1988.1080p.mp4') },
      poster: { found: join(dieHard, 'Images', 'poster.jpg') },
      backdrop: null,
      subtitles: [],
    };
    return { ...box, problem, form };
  }

  it.each(['link', 'copy'] as const)(
    'a %s run’s Resolve stores the found video’s rung',
    async (mode) => {
      const box = await twoVideoDieHard(mode);

      const movie = await box.importer.resolve(box.problem.id, box.form);

      expect(movie.videoQuality).toBe('1080p');
      expect(storedQuality(box.db, movie.id)).toBe('1080p');
    }
  );

  it('probes the resolved video once', async () => {
    const box = await twoVideoDieHard('link');
    box.component?.probes.clear();

    await box.importer.resolve(box.problem.id, box.form);

    expect(box.component?.probes.get('Die.Hard.1988.1080p.mp4')).toBe(1);
  });

  it('a Resolve nothing could probe adds the film with a NULL quality', async () => {
    const box = await twoVideoDieHard('link', 'throws');

    const movie = await box.importer.resolve(box.problem.id, box.form);

    expect(movie.videoQuality).toBeNull();
    expect(storedQuality(box.db, movie.id)).toBeNull();
  });
});
