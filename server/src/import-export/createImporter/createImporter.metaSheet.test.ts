// @vitest-environment node
//
// Log 58, Folder layout, Phase 8: "the scan reads Meta/" (issue #541).
//
// A **Folder scan** reads its **Library folder**'s **Meta folder** sheet,
// `Meta/familyflix-library.csv` when there, else the `.xlsx`, as that
// folder's sheet; a folder with neither scans as the layout alone names it.
//
// - A new title imports with every field and art the sheet and its folder
//   hold, Rating, Favorite and Status included, with no Sync; so a **Factory
//   reset** then a scan gives every title back, offline. An `In progress`
//   title starts at its start: no resume position.
// - A held title's empty fields are filled; its differing values are one
//   `differs` **Problem**, the review's _Yours | Spreadsheet_.
// - The importer calls `hold` on each Library folder whose sheet the
//   **Current run** read and `release` when the run closes, so the **Library
//   sheet** is not rewritten during the run and is rewritten from the library
//   when it closes.
//
// The runs are real: the importer's fixture library copied into a sandboxed
// Library folder, a real `Media`, the absent Playback component, and a real
// **Library sheet writer** wired to `LibraryStorage.onChange` as the server
// wires it.

import {
  cpSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  createLibrarySheet,
  type LibrarySheet,
} from '../createLibrarySheet/createLibrarySheet';
import { readSheet } from '../readSheet/readSheet';
import type { ImportProblem, ImportRun, Movie } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

/** The fixture's own sheet, every path cell relative to the Library folder. */
const FIXTURE_CSV = readFileSync(join(LIBRARY_FIXTURE, 'library.csv'), 'utf8');

/** What the Library folder's `Meta/` holds. */
type MetaSheet =
  | { kind: 'none' }
  | { kind: 'csv'; text?: string }
  | { kind: 'xlsx' }
  | { kind: 'both'; csv: string };

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  writer: LibrarySheet;
  /** The Library folder's path on disk. */
  root: string;
  /** The Library folder, listed. */
  folder: StoredLibraryFolder;
}

/**
 * The fixture library copied into a Library folder with `meta` in its
 * `Meta/`, a fresh library over it, and the **Library sheet writer** wired to
 * the library's changes.
 */
function sandbox(meta: MetaSheet): Sandbox {
  const dir = sandboxRoot('familyflix-meta-sheet-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  cpSync(join(LIBRARY_FIXTURE, 'root'), root, { recursive: true });
  const metaDir = join(root, 'Meta');
  if (meta.kind !== 'none') {
    mkdirSync(metaDir);
  }
  if (meta.kind === 'csv') {
    writeFileSync(
      join(metaDir, 'familyflix-library.csv'),
      meta.text ?? FIXTURE_CSV
    );
  }
  if (meta.kind === 'xlsx' || meta.kind === 'both') {
    cpSync(
      join(LIBRARY_FIXTURE, 'library.xlsx'),
      join(metaDir, 'familyflix-library.xlsx')
    );
  }
  if (meta.kind === 'both') {
    writeFileSync(join(metaDir, 'familyflix-library.csv'), meta.csv);
  }

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const writer = createLibrarySheet({ storage });
  storage.onChange((folderIds) => writer.touch(folderIds));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: writer,
  });
  return {
    storage,
    importer,
    writer,
    root,
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

/** One whole offline scan of `folder`, left in review. */
async function scanned(
  importer: Importer,
  folder: StoredLibraryFolder
): Promise<ImportRun> {
  await importer.scan([folder], false);
  return untilReview(importer);
}

/** The held movie whose title is `title`, read whole. */
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

const titles = (storage: LibraryStorage): string[] =>
  storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title);

const genresOf = (movie: Movie): string[] =>
  movie.genres.map((genre) => genre.name).sort();

/** The fixture's sheet with one row's cell swapped, by its old text. */
const fixtureWith = (from: string, to: string): string => {
  expect(FIXTURE_CSV).toContain(from);
  return FIXTURE_CSV.replace(from, to);
};

/** The Library folder's CSV sheet, read back as rows. */
async function sheetRows(root: string) {
  return readSheet(
    readFileSync(join(root, 'Meta', 'familyflix-library.csv')),
    'familyflix-library.csv'
  );
}

/** Die Hard held against the fixture's folder, rated 4 by the family, no details. */
function holdDieHard(box: Sandbox): Movie {
  const held = box.storage.addMovie(
    newMovie({
      title: 'Die Hard',
      year: 1988,
      videoPath: 'Die Hard (1988)/Die.Hard.1988.1080p.mp4',
      videoFolderId: box.folder.id,
    })
  );
  box.storage.setSourceFolder(held.id, box.folder.id, 'Die Hard (1988)');
  box.storage.setRating(held.id, 4);
  return held;
}

describe('createImporter.scan, which sheet it reads', () => {
  it('reads Meta/familyflix-library.csv as the folder’s sheet', async () => {
    const box = sandbox({ kind: 'csv' });

    await scanned(box.importer, box.folder);

    expect(titles(box.storage)).toEqual(['Amélie', 'Die Hard']);
    const dieHard = movieTitled(box.storage, 'Die Hard');
    expect(dieHard.director).toBe('John McTiernan');
    expect(dieHard.synopsis).toBe(
      'A New York cop takes on a tower full of thieves on Christmas Eve.'
    );
    expect(genresOf(dieHard)).toEqual(['Action', 'Thriller']);
  });

  it('reads Meta/familyflix-library.xlsx when there is no CSV', async () => {
    const box = sandbox({ kind: 'xlsx' });

    await scanned(box.importer, box.folder);

    expect(titles(box.storage)).toEqual(['Amélie', 'Die Hard']);
    expect(movieTitled(box.storage, 'Die Hard').director).toBe(
      'John McTiernan'
    );
  });

  it('reads the CSV over the .xlsx when both are there', async () => {
    const box = sandbox({
      kind: 'both',
      csv: fixtureWith('John McTiernan', 'Renny Harlin'),
    });

    await scanned(box.importer, box.folder);

    expect(movieTitled(box.storage, 'Die Hard').director).toBe('Renny Harlin');
  });

  it('scans a folder with neither by its layout alone', async () => {
    const box = sandbox({ kind: 'none' });

    const run = await scanned(box.importer, box.folder);

    expect(titles(box.storage)).toEqual(['Amelie', 'Die Hard']);
    const dieHard = movieTitled(box.storage, 'Die Hard');
    expect(dieHard.director).toBeNull();
    expect(dieHard.genres).toEqual([]);
    expect(dieHard.posterPath).not.toBeNull();
    expect(run.problems).toEqual([]);
  });
});

describe('createImporter.scan, a Factory reset then a scan', () => {
  it('rebuilds every title with its Rating, Favorite, Status and art, offline', async () => {
    const box = sandbox({ kind: 'csv' });
    await scanned(box.importer, box.folder);
    await box.importer.cancel();
    const dieHard = movieTitled(box.storage, 'Die Hard');
    const amelie = movieTitled(box.storage, 'Amélie');
    box.storage.setRating(dieHard.id, 4);
    box.storage.markUnwatched(dieHard.id);
    box.storage.setFavorite(amelie.id, true);
    box.storage.markWatched(amelie.id);
    await box.writer.flush();

    box.storage.reset();
    const again = box.storage.addLibraryFolder(box.root);
    await scanned(box.importer, again);

    expect(titles(box.storage)).toEqual(['Amélie', 'Die Hard']);
    expect(movieTitled(box.storage, 'Die Hard')).toMatchObject({
      rating: 4,
      isFavorite: false,
      watched: false,
      director: 'John McTiernan',
      tmdbId: null,
    });
    expect(movieTitled(box.storage, 'Amélie')).toMatchObject({
      rating: 7,
      isFavorite: true,
      watched: true,
      status: 'watched',
    });
    for (const title of ['Amélie', 'Die Hard']) {
      const movie = movieTitled(box.storage, title);
      expect(movie.posterPath).not.toBeNull();
      expect(movie.backdropPath).not.toBeNull();
    }
    expect(movieTitled(box.storage, 'Die Hard').subtitles).toHaveLength(2);
  });

  it('takes the folder’s art when a path cell names a file that is not there', async () => {
    const box = sandbox({ kind: 'csv' });
    const images = join(box.root, 'Die Hard (1988)', 'Images');
    renameSync(join(images, 'poster.jpg'), join(images, 'Die Hard poster.jpg'));

    await scanned(box.importer, box.folder);

    expect(movieTitled(box.storage, 'Die Hard')).toMatchObject({
      director: 'John McTiernan',
      posterPath: expect.any(String),
    });
  });
});

describe('createImporter.scan, an In progress title', () => {
  it('comes back with no resume position', async () => {
    const box = sandbox({
      kind: 'csv',
      text: fixtureWith(',7,,,Unwatched,', ',7,,,In progress,'),
    });

    await scanned(box.importer, box.folder);

    expect(movieTitled(box.storage, 'Amélie')).toMatchObject({
      resumePositionSeconds: 0,
      watched: false,
    });
  });
});

describe('createImporter.scan, a held title', () => {
  it('fills its empty fields from the folder’s sheet', async () => {
    const box = sandbox({ kind: 'csv' });
    const held = holdDieHard(box);

    await scanned(box.importer, box.folder);

    expect(box.storage.getMovie(held.id)).toMatchObject({
      director: 'John McTiernan',
      synopsis:
        'A New York cop takes on a tower full of thieves on Christmas Eve.',
      rating: 4,
    });
    expect(titles(box.storage)).toEqual(['Amélie', 'Die Hard']);
  });

  it('lists its differing values in review as Yours | Spreadsheet', async () => {
    const box = sandbox({ kind: 'csv' });
    const held = holdDieHard(box);

    const run = await scanned(box.importer, box.folder);

    const differs = run.problems.filter(
      (problem: ImportProblem) => problem.kind === 'differs'
    );
    expect(differs).toHaveLength(1);
    expect(differs[0]).toMatchObject({ kind: 'differs', movieId: held.id });
    const fields = differs[0].differences?.map((each) => each.field) ?? [];
    expect(fields).toContain('rating');
    expect(fields).not.toContain('director');
    const rating = differs[0].differences?.find(
      (each) => each.field === 'rating'
    );
    expect(rating?.mine).not.toBe(rating?.sheet);
  });
});

describe('createImporter.scan, the Library sheet held during the run', () => {
  it('leaves the sheet as it was while the run is in review', async () => {
    const box = sandbox({ kind: 'csv' });
    holdDieHard(box);
    const sheet = join(box.root, 'Meta', 'familyflix-library.csv');
    const before = readFileSync(sheet);

    await scanned(box.importer, box.folder);
    await box.writer.flush();

    expect(readFileSync(sheet).equals(before)).toBe(true);
  });

  it('rewrites the sheet from the library when the run closes, a skipped difference the family’s', async () => {
    const box = sandbox({ kind: 'csv' });
    holdDieHard(box);

    await scanned(box.importer, box.folder);
    await box.importer.cancel();
    await box.writer.flush();

    const rows = await sheetRows(box.root);
    const dieHard = rows.find((row) => row.title === 'Die Hard');
    expect(dieHard?.rating).toBe(4);
    expect(dieHard?.director).toBe('John McTiernan');
    expect(
      rows
        .filter((row) => row.type === 'Movie')
        .map((row) => row.title)
        .sort()
    ).toEqual(['Amélie', 'Die Hard']);
  });

  it('rewrites the sheet when the next scan lets the run in review go', async () => {
    const box = sandbox({ kind: 'csv' });
    holdDieHard(box);
    await scanned(box.importer, box.folder);

    const other = join(box.root, '..', 'Elsewhere');
    mkdirSync(other);
    await scanned(box.importer, box.storage.addLibraryFolder(other));
    await box.writer.flush();

    const rows = await sheetRows(box.root);
    expect(rows.find((row) => row.title === 'Die Hard')).toMatchObject({
      rating: 4,
      director: 'John McTiernan',
    });
  });
});
