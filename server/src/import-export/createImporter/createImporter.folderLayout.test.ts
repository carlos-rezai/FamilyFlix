// @vitest-environment node
//
// 58, Folder layout, Phase 2 (issue #535): the importer's half of one film
// in the layout.
//
// A **Folder scan** reads its **Library folder** by the **Folder layout**:
//
// - a **Title folder** `Die Hard (1988)/` holding one loose video scans to a
//   film with the poster and backdrop of its **Images folder** and the tracks
//   of its **Subtitles folder**; `Extras/` is not read;
// - the film's title and year come straight off its **Folder key**, with no
//   Title guess;
// - a second loose video is the `no-video` **Problem**, _more than one video_;
// - its **Source folder** is the Folder key and its **Source file** is unset;
// - each root entry left out is one **Layout warning** in the log, the root's
//   loose videos one line for the folder; never a Problem;
// - a title held from an old shape still plays from its stored path.
//
// The runs are real: a Library folder built under `sandboxRoot` (the one real
// video copied in, art and tracks as plain bytes), a real `Media` over a
// sandbox managed directory, and a `Playback` reading each folder's path off
// the same library, over the absent **Playback component**.

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { openDatabase, type SqliteDatabase } from '../../db';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import {
  createPlayback,
  type Playback,
} from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { FIXTURE_VIDEO } from '../../test-support/fixtureVideo/fixtureVideo';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import type { ImportMode, ImportRun, Movie } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  playback: Playback;
  /** The Library folder, listed. */
  folder: StoredLibraryFolder;
}

/**
 * A library on disk, a raw handle on it, and one Library folder holding the
 * entries given: a path ending in a video extension is the real video, any
 * other file plain bytes.
 */
function sandbox(entries: string[]): Sandbox {
  const dir = sandboxRoot('familyflix-folder-layout-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  mkdirSync(root);
  for (const entry of entries) {
    const path = join(root, entry);
    mkdirSync(dirname(path), { recursive: true });
    if (/\.(mp4|mkv)$/i.test(entry)) {
      copyFileSync(FIXTURE_VIDEO, path);
    } else {
      writeFileSync(path, `${entry} bytes`);
    }
  }

  const dbPath = join(dir, 'familyflix.db');
  const storage = track(createSqliteStorage(dbPath));
  const db = track(openDatabase(dbPath));
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) =>
      storage.libraryFolders().find((folder) => folder.id === id)?.path ?? null
  );
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback,
    librarySheet: idleLibrarySheet(),
  });
  return {
    storage,
    db,
    importer,
    playback,
    folder: storage.addLibraryFolder(root),
  };
}

/** The snapshot once the run has reached review, or a failure if it never does. */
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

/** One whole scan of the Library folder, left in review. */
async function scanned(
  box: Sandbox,
  mode: ImportMode = 'copy'
): Promise<ImportRun> {
  await box.importer.scan([box.folder], false, mode);
  return untilReview(box.importer);
}

/** The held movie titled `title`, read whole. */
function movieTitled(storage: LibraryStorage, title: string): Movie {
  const listed = storage
    .listMovies({ sort: 'a-z' })
    .find((each) => each.title === title);
  const movie = listed === undefined ? null : storage.getMovie(listed.id);
  if (movie === null) {
    throw new Error(
      `the library holds no ${title}: ${JSON.stringify(
        storage.listMovies({ sort: 'a-z' }).map((each) => each.title)
      )}`
    );
  }
  return movie;
}

interface SourceRow {
  source_folder: string | null;
  source_file: string | null;
}

/** Each movie's Source folder and Source file, by title. */
function sources(db: SqliteDatabase): Record<string, SourceRow> {
  const rows = db
    .prepare('SELECT title, source_folder, source_file FROM movies')
    .all() as Array<SourceRow & { title: string }>;
  return Object.fromEntries(
    rows.map(({ title, source_folder, source_file }) => [
      title,
      { source_folder, source_file },
    ])
  );
}

const warnings = (run: ImportRun) =>
  run.log.filter((line) => line.kind === 'warning').map((line) => line.text);

const titles = (storage: LibraryStorage) =>
  storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title);

const DIE_HARD = [
  'Die Hard (1988)/Die Hard.mp4',
  'Die Hard (1988)/Images/Die Hard poster.jpg',
  'Die Hard (1988)/Images/backdrop.png',
  'Die Hard (1988)/Subtitles/Die Hard.en.srt',
  'Die Hard (1988)/Subtitles/Die Hard.pt.srt',
  'Die Hard (1988)/Extras/Making of.mp4',
];

describe('createImporter.scan: a film in the layout', () => {
  it('scans Die Hard (1988)/ to a film with its poster, backdrop and two tracks', async () => {
    const box = sandbox(DIE_HARD);

    await scanned(box);

    const movie = movieTitled(box.storage, 'Die Hard');
    expect(movie.year).toBe(1988);
    expect(movie.posterPath).not.toBeNull();
    expect(movie.backdropPath).not.toBeNull();
    expect(movie.subtitles.map((track) => track.language).sort()).toEqual([
      'English',
      'Portuguese',
    ]);
    expect(titles(box.storage)).toEqual(['Die Hard']);
  });

  it('takes the title straight off the Folder key, with no Title guess', async () => {
    const box = sandbox(['Mr. & Mrs. Smith (2005)/smith.mkv']);

    await scanned(box);

    expect(movieTitled(box.storage, 'Mr. & Mrs. Smith').year).toBe(2005);
  });

  it('files a second loose video as the no-video Problem, more than one video', async () => {
    const box = sandbox([
      'Heat (1995)/Heat.mp4',
      'Heat (1995)/Heat Directors Cut.mp4',
    ]);

    const run = await scanned(box);

    expect(run.problems).toEqual([
      expect.objectContaining({ kind: 'no-video', title: 'Heat' }),
    ]);
    expect(titles(box.storage)).toEqual([]);
  });

  it('records the Folder key as the Source folder and no Source file', async () => {
    const box = sandbox([
      ...DIE_HARD,
      'Amelie (2001)/Amelie.mp4',
      'Amelie (2001)/Amelie Bonus.mp4',
    ]);

    await scanned(box);

    expect(sources(box.db)).toEqual({
      'Die Hard': { source_folder: 'Die Hard (1988)', source_file: null },
    });
  });
});

describe('createImporter.scan: the Layout warnings', () => {
  it('logs Drama/ as one Warning line and imports nothing from it', async () => {
    const box = sandbox([...DIE_HARD, 'Drama/Amelie (2001)/Amelie.mp4']);

    const run = await scanned(box);

    expect(run.log).toContainEqual({
      text: "⚠ Drama isn't named Title (Year), left out",
      kind: 'warning',
    });
    expect(warnings(run).filter((text) => text.includes('Drama'))).toHaveLength(
      1
    );
    expect(titles(box.storage)).toEqual(['Die Hard']);
    expect(run.problems).toEqual([]);
  });

  it('logs each Layout warning text', async () => {
    const box = sandbox([
      ...DIE_HARD,
      'Heat (1995)/Images/poster.jpg',
      'Severance (2022)/Severance.mkv',
      'Severance (2022)/Season 01/Severance.S01E01.mkv',
    ]);

    const run = await scanned(box);

    expect(warnings(run)).toEqual(
      expect.arrayContaining([
        '⚠ Heat (1995) holds no video or Season folder, left out',
        '⚠ Severance (2022) holds loose videos and Season folders, left out',
      ])
    );
    expect(run.problems).toEqual([]);
  });

  it('logs the root loose videos as one line for the Library folder', async () => {
    const box = sandbox([...DIE_HARD, 'Heat.1995.mp4', 'Amelie.2001.mp4']);

    const run = await scanned(box);

    expect(warnings(run).filter((text) => text.includes('lie loose'))).toEqual([
      `⚠ 2 videos lie loose at the top of ${box.folder.path}, left out`,
    ]);
    expect(titles(box.storage)).toEqual(['Die Hard']);
  });

  it('passes Meta/, an Export folder and system folders in silence', async () => {
    const box = sandbox([
      ...DIE_HARD,
      'Meta/notes.txt',
      'FamilyFlix Export 2026-11-08/Meta/familyflix-library.csv',
      'FamilyFlix Export 2026-11-08/Heat (1995)/Images/poster.jpg',
      '$RECYCLE.BIN/desktop.ini',
      'System Volume Information/IndexerVolumeGuid',
      '.thumbnails/cache.db',
    ]);

    const run = await scanned(box);

    expect(warnings(run)).toEqual([]);
    expect(titles(box.storage)).toEqual(['Die Hard']);
  });
});

describe('createImporter.scan: a title held from an old shape', () => {
  it('still plays from its stored path while its folder is left out', async () => {
    const box = sandbox(['Drama/Amelie (2001)/Amelie.mp4']);
    const held = box.storage.addMovie({
      title: 'Amelie',
      year: 2001,
      videoPath: 'Drama/Amelie (2001)/Amelie.mp4',
      videoFolderId: box.folder.id,
    });
    box.storage.setSourceFolder(
      held.id,
      box.folder.id,
      join('Drama', 'Amelie (2001)')
    );

    const run = await scanned(box, 'link');

    expect(run.log).toContainEqual({
      text: "⚠ Drama isn't named Title (Year), left out",
      kind: 'warning',
    });
    const movie = box.storage.getMovie(held.id);
    expect(movie).toMatchObject({
      videoPath: 'Drama/Amelie (2001)/Amelie.mp4',
      videoFolderId: box.folder.id,
    });
    expect(
      box.playback.videoFile({
        videoPath: movie?.videoPath ?? '',
        videoFolderId: movie?.videoFolderId ?? null,
      }).kind
    ).toBe('file');
  });
});
