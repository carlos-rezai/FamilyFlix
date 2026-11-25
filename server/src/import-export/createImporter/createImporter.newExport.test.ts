// @vitest-environment node
//
// 67, Export paths, Phase 3 (issue #646): a new Export lands where a scan
// reads it.
//
// A library whose **Source folders** lie a level deep (`Movies/Amelie
// (2001)`, `Movies\Die Hard (1988)`) is exported by today's `writeExport`.
// After a Factory reset the inner `Movies/` folder, holding the videos alone,
// is re-linked as a Library folder:
//
// - the Export's **Title folders** copied over it scan back whole: a
//   **Folder scan** imports every title with its poster and backdrop, as the
//   new Export is flat, one Title folder per title directly in it;
// - the Export's sheet uploaded from its `_meta/` does too.
//
// Real SQLite, a real `createMedia`, real folders in a sandbox.

import {
  cpSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import type { ImportRun, Movie, StartExport } from '@/types';
import { createImporter, type Importer } from './createImporter';
import { createSqliteStorage, type LibraryStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { idleFrameFill } from '../../test-support/idleFrameFill/idleFrameFill';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { createLibrarySheet } from '../createLibrarySheet/createLibrarySheet';
import { writeExport } from '../writeExport/writeExport';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const NAME = 'familyflix-collection_17-11-2026';

/** The art each film was stored with, by stored path. */
const STORED: Record<string, string> = {
  'amelie-2001/poster.png': 'amelie poster',
  'amelie-2001/backdrop.png': 'amelie backdrop',
  'die-hard-1988/poster.jpg': 'die hard poster',
  'die-hard-1988/backdrop.jpg': 'die hard backdrop',
};

const AMELIE: Movie = makeMovie({
  id: 'amelie',
  title: 'Amelie',
  year: 2001,
  posterPath: 'amelie-2001/poster.png',
  backdropPath: 'amelie-2001/backdrop.png',
});

const DIE_HARD: Movie = makeMovie({
  id: 'die-hard',
  title: 'Die Hard',
  year: 1988,
  posterPath: 'die-hard-1988/poster.jpg',
  backdropPath: 'die-hard-1988/backdrop.jpg',
});

/** The library's nested Source folders, one stored with a backslash. */
const SOURCE_FOLDERS: ReadonlyMap<string, string> = new Map([
  ['amelie', 'Movies/Amelie (2001)'],
  ['die-hard', 'Movies\\Die Hard (1988)'],
]);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  /** The re-linked inner Library folder, holding the videos alone. */
  movies: string;
  /** The new Export folder. */
  exported: string;
}

/** Copy only the videos and the folders holding them: the art stays behind. */
const videosOnly = (source: string): boolean =>
  statSync(source).isDirectory() || source.endsWith('.mp4');

/** The library exported by today's `writeExport` into `dir/Backups`. */
async function exportLibrary(dir: string): Promise<string> {
  const mediaPath = join(dir, 'old-media');
  for (const [stored, bytes] of Object.entries(STORED)) {
    const file = join(mediaPath, ...stored.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  const destination = join(dir, 'Backups');
  mkdirSync(destination);
  const request: StartExport = {
    format: 'csv',
    destination,
    images: true,
    subtitles: true,
    name: NAME,
  };
  await writeExport(createMedia(mediaPath, unfittedArt()), request, {
    movies: [AMELIE, DIE_HARD],
    series: [],
    sourceFolders: SOURCE_FOLDERS,
  });
  return join(destination, NAME);
}

/**
 * A fresh library after a Factory reset: the fixture's films, videos only,
 * in an inner `Movies/` folder linked as the one Library folder, and the new
 * Export beside it.
 */
async function sandbox(): Promise<Sandbox> {
  const dir = sandboxRoot('familyflix-new-export-');
  const exported = await exportLibrary(dir);
  const media = join(dir, 'media');
  mkdirSync(media);
  const movies = join(dir, 'Library', 'Movies');
  cpSync(join(LIBRARY_FIXTURE, 'root'), movies, {
    recursive: true,
    filter: videosOnly,
  });

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const writer = createLibrarySheet({ storage });
  storage.onChange((folderIds) => writer.touch(folderIds));
  const importer = createImporter({
    storage,
    media: createMedia(media, unfittedArt()),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: writer,
    layoutFill: idleLayoutFill(),
    frameFill: idleFrameFill(),
  });
  return { storage, importer, movies, exported };
}

/** The Export's folders but its `_meta/`, copied over the inner folder. */
function copyTitleFoldersOver(box: Sandbox): void {
  for (const entry of readdirSync(box.exported)) {
    if (entry !== '_meta') {
      cpSync(join(box.exported, entry), join(box.movies, entry), {
        recursive: true,
      });
    }
  }
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

/** Every film held, A to Z, with whether its poster and backdrop are set. */
const filmsWithArt = (storage: LibraryStorage) =>
  storage.listMovies({ sort: 'a-z' }).map((movie) => ({
    title: movie.title,
    poster: movie.posterPath !== null,
    backdrop: movie.backdropPath !== null,
  }));

const EVERY_FILM_WITH_ART = [
  { title: 'Amelie', poster: true, backdrop: true },
  { title: 'Die Hard', poster: true, backdrop: true },
];

describe('createImporter: a new Export’s folders copied over a re-linked inner folder', () => {
  it('scans back every title with its art', async () => {
    const box = await sandbox();
    copyTitleFoldersOver(box);
    const folder = box.storage.addLibraryFolder(box.movies);

    await box.importer.scan([folder]);
    await untilReview(box.importer);

    expect(filmsWithArt(box.storage)).toEqual(EVERY_FILM_WITH_ART);
  });

  it('adds no folder but the Export’s own Title folders to the inner folder', async () => {
    const box = await sandbox();
    copyTitleFoldersOver(box);

    expect(readdirSync(box.movies).sort()).toEqual([
      'Amelie (2001)',
      'Die Hard (1988)',
    ]);
  });
});

describe('createImporter: a new Export’s sheet uploaded over the re-linked folder', () => {
  it('imports every title with its art', async () => {
    const box = await sandbox();
    copyTitleFoldersOver(box);
    box.storage.addLibraryFolder(box.movies);

    await box.importer.start(
      join(box.exported, '_meta', 'familyflix-library.csv'),
      false
    );
    await untilReview(box.importer);

    expect(filmsWithArt(box.storage)).toEqual(EVERY_FILM_WITH_ART);
  });
});
