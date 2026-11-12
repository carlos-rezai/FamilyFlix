// @vitest-environment node
//
// 61, Export round trip, Phase 1 (issue #582): the Export round trip.
//
// The **Round trip**'s twin for the **Export**: QA ticket 580's Amélie repro,
// a title renamed in the app (`Le Fabuleux Destin d'Amélie Poulain`, rated 7,
// TMDB id 194, genres) whose **Source folder** is still `Amelie (2001)`. It is
// exported, as the Export route exports it (`sourceFoldersOf` over every
// folder), and the library Factory reset. Then, both ways:
//
// - **uploaded**: the Library folder listed again and the Export's sheet
//   imported, the run reaches review with no **Problem** and every field back;
// - **copied over**: the Export folder copied over a Library folder of bare
//   videos and scanned, it comes back whole, with no stray folder, no
//   **Orphaned row** and no Problem.
//
// The run is real: Amélie from the importer's fixture in a sandboxed Library
// folder, a real `Media`, the absent Playback component, a real **Library
// sheet writer** wired to `LibraryStorage.onChange` as the server wires it,
// and a real `writeExport`.

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  createLibrarySheet,
  type LibrarySheet,
} from '../createLibrarySheet/createLibrarySheet';
import { sourceFoldersOf } from '../sourceFoldersOf/sourceFoldersOf';
import { writeExport } from '../writeExport/writeExport';
import type { ImportRun, Movie, Subtitle } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const RENAMED = "Le Fabuleux Destin d'Amélie Poulain";

const EXPORT_NAME = 'familyflix-collection_12-11-2026';

/** The fixture's Title folder, Amélie's Source folder. */
const AMELIE_FOLDER = 'Amelie (2001)';

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  writer: LibrarySheet;
  mediaDomain: Media;
  /** The managed media directory, where copied art and tracks land. */
  media: string;
  /** The Library folder's path on disk. */
  root: string;
  /** Where the Export is written. */
  exports: string;
  dir: string;
}

/** Amélie in a Library folder, a fresh library over it, the writer wired. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-export-round-trip-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  mkdirSync(root);
  cpSync(
    join(LIBRARY_FIXTURE, 'root', AMELIE_FOLDER),
    join(root, AMELIE_FOLDER),
    {
      recursive: true,
    }
  );
  const exports = join(dir, 'Backups');
  mkdirSync(exports);

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const writer = createLibrarySheet({ storage });
  storage.onChange((folderIds) => writer.touch(folderIds));
  const mediaDomain = createMedia(media);
  const importer = createImporter({
    storage,
    media: mediaDomain,
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: writer,
    layoutFill: idleLayoutFill(),
  });
  return { storage, importer, writer, mediaDomain, media, root, exports, dir };
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

/** One whole offline scan of the Library folder at `path`, closed at review. */
async function scanAndClose(box: Sandbox, path: string): Promise<ImportRun> {
  const folder: StoredLibraryFolder = box.storage.addLibraryFolder(path);
  await box.importer.scan([folder], false);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  await box.writer.flush();
  return run;
}

/** A file's content by its stored path, so a copy under a new name compares equal. */
function contentOf(box: Sandbox, stored: string | null): string | null {
  if (stored === null) {
    return null;
  }
  const path = isAbsolute(stored) ? stored : join(box.media, stored);
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Every held film, whole. */
const moviesOf = (box: Sandbox): Movie[] =>
  box.storage.listMovies({ sort: 'a-z' }).map((listed) => {
    const movie = box.storage.getMovie(listed.id);
    if (movie === null) {
      throw new Error(`the library lost ${listed.title}`);
    }
    return movie;
  });

/** Every film's fields as a maintainer would compare them; never an id or a file. */
const fieldsOf = (box: Sandbox) =>
  moviesOf(box).map((movie) => ({
    title: movie.title,
    year: movie.year,
    runtimeMinutes: movie.runtimeMinutes,
    genres: movie.genres.map((genre) => genre.name).sort(),
    director: movie.director,
    cast: movie.cast,
    synopsis: movie.synopsis,
    rating: movie.rating,
    tmdbScore: movie.tmdbScore,
    tmdbId: movie.tmdbId,
    status: movie.status,
    watched: movie.watched,
    isFavorite: movie.isFavorite,
  }));

const tracksOf = (box: Sandbox, subtitles: readonly Subtitle[]) =>
  subtitles.map((track) => ({
    language: track.language,
    content: contentOf(box, track.path),
  }));

/** Every film's fields and the content of its art and tracks. */
const wholeOf = (box: Sandbox) =>
  moviesOf(box).map((movie, index) => ({
    ...fieldsOf(box)[index],
    subtitles: tracksOf(box, movie.subtitles),
    poster: contentOf(box, movie.posterPath),
    backdrop: contentOf(box, movie.backdropPath),
  }));

/**
 * The ticket's repro: Amélie scanned, then renamed in the app, rated 7 and
 * given TMDB id 194 and genres. Answers once its Library sheet is written.
 */
async function originalLibrary(box: Sandbox): Promise<void> {
  await scanAndClose(box, box.root);
  const [film] = box.storage.listMovies({ sort: 'a-z' });
  expect(film?.title).toBe('Amelie');
  box.storage.enrichMovie(film.id, {
    tmdbId: 194,
    tmdbScore: 7.9,
    year: 2001,
    synopsis: 'A shy waitress in Montmartre sets out to change lives.',
    genres: ['Comedy', 'Romance'],
    director: 'Jean-Pierre Jeunet',
    cast: ['Audrey Tautou', 'Mathieu Kassovitz'],
  });
  box.storage.updateMovie(film.id, { title: RENAMED });
  box.storage.setRating(film.id, 7);
  box.storage.setFavorite(film.id, true);
  await box.writer.flush();
}

/** The Export as the route writes it, csv with images and subtitles; its folder. */
async function exportLibrary(box: Sandbox): Promise<string> {
  const outcome = await writeExport(
    box.mediaDomain,
    {
      format: 'csv',
      destination: box.exports,
      images: true,
      subtitles: true,
      name: EXPORT_NAME,
    },
    {
      movies: moviesOf(box),
      series: [],
      sourceFolders: sourceFoldersOf(box.storage.libraryTitles()),
    }
  );
  if (outcome.kind !== 'written') {
    throw new Error(`the export was not written: ${JSON.stringify(outcome)}`);
  }
  return outcome.folder;
}

/** Every log line's text of a run. */
const logOf = (run: ImportRun): string[] => run.log.map((line) => line.text);

describe('createImporter: the Export round trip, uploaded after a Factory reset', () => {
  /** The repro exported, reset, the folder listed again and the sheet run to review. */
  async function uploaded(box: Sandbox): Promise<ImportRun> {
    const folder = await exportLibrary(box);
    box.storage.reset();
    box.storage.addLibraryFolder(box.root);

    await box.importer.start(
      join(folder, 'Meta', 'familyflix-library.csv'),
      false
    );
    return untilReview(box.importer);
  }

  it('raises no Problem', async () => {
    const box = sandbox();
    await originalLibrary(box);

    const run = await uploaded(box);

    expect(run.problems).toEqual([]);
  });

  it('gives back the renamed title with every field', async () => {
    const box = sandbox();
    await originalLibrary(box);
    const original = fieldsOf(box);
    expect(original).toMatchObject([
      { title: RENAMED, rating: 7, tmdbId: 194, genres: ['Comedy', 'Romance'] },
    ]);

    await uploaded(box);
    await box.importer.cancel();

    expect(fieldsOf(box)).toEqual(original);
  });
});

describe('createImporter: the Export round trip, copied over a Library folder of bare videos', () => {
  /**
   * The repro exported and reset, then a Library folder holding only
   * Amélie's video under her Source folder, the Export folder copied over it
   * and scanned.
   */
  async function copiedOver(box: Sandbox): Promise<ImportRun> {
    const folder = await exportLibrary(box);
    box.storage.reset();

    const bare = join(box.dir, 'Bare');
    mkdirSync(join(bare, AMELIE_FOLDER), { recursive: true });
    cpSync(
      join(box.root, AMELIE_FOLDER, 'Amelie.mp4'),
      join(bare, AMELIE_FOLDER, 'Amelie.mp4')
    );
    cpSync(folder, bare, { recursive: true });

    return scanAndClose(box, bare);
  }

  it('raises no Problem', async () => {
    const box = sandbox();
    await originalLibrary(box);

    const run = await copiedOver(box);

    expect(run.problems).toEqual([]);
  });

  it('leaves no stray folder and no Orphaned row', async () => {
    const box = sandbox();
    await originalLibrary(box);

    const run = await copiedOver(box);

    const lines = logOf(run);
    expect(lines.filter((line) => line.includes('holds no video'))).toEqual([]);
    expect(
      lines.filter((line) => line.includes('is in the sheet but has no folder'))
    ).toEqual([]);
  });

  it('gives back the renamed title whole: every field, its art and its tracks', async () => {
    const box = sandbox();
    await originalLibrary(box);
    const original = wholeOf(box);

    await copiedOver(box);

    expect(wholeOf(box)).toEqual(original);
  });
});
