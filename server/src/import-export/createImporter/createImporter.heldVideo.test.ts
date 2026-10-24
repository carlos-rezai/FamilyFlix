// @vitest-environment node
//
// 51 — Library audit, Phase 6: "a scan knows a file it already plays"
// (issue #449).
//
// The importer's **Already in library** runs three rules in order: the
// folder on record, then the **Held video** rule, then the title key. The
// Held video rule (`storage.titleHolding`) is what catches a title a Sync
// renamed and that has no folder on record:
//
// - a found film whose video is a held title's **Linked video** is _Already
//   in library_, and its folder is recorded with `setSourceFolder`;
// - a **Show folder** with any one held episode video is the held series:
//   it still takes the folder's new episodes, and its folder is recorded;
// - the rule ignores titles, so a double an older library already holds (two
//   titles over one video) neither fails the migration nor gets a third.
//
// The runs are real: the fixtures copied into sandboxed Library folders, an
// on-disk library with a raw handle for the columns no shared type carries,
// a real `Media` over a sandbox managed directory, and the absent
// **Playback component**.

import { mkdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { openDatabase, type SqliteDatabase } from '../../db';
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
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const DIE_HARD = 'Die.Hard.1988.1080p/Die.Hard.1988.1080p.mp4';
const HARBOR_PILOT =
  'Harbor & Vine (2021)/Season 01/Harbor.and.Vine.S01E01.Pilot.mp4';
const HARBOR_SECOND =
  'Harbor & Vine (2021)/Season 01/Harbor.and.Vine.S01E02.The.Night.Market.mp4';

interface Sandbox {
  dbPath: string;
  media: string;
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  films: StoredLibraryFolder;
  shows: StoredLibraryFolder;
}

/** The library, the importer and the two listed folders over one database file. */
function open(
  dbPath: string,
  media: string
): Omit<Sandbox, 'films' | 'shows' | 'dbPath' | 'media'> {
  const storage = track(createSqliteStorage(dbPath));
  const db = track(openDatabase(dbPath));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(
      media,
      fixedSlot(null),
      (id) =>
        storage.libraryFolders().find((folder) => folder.id === id)?.path ??
        null
    ),
  });
  return { storage, db, importer };
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-held-video-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  mkdirSync(join(dir, 'shows'));
  const films = libraryFixture(join(dir, 'films'), 'library.csv');
  const shows = seriesFixture(join(dir, 'shows'), 'library.csv');
  const dbPath = join(dir, 'familyflix.db');
  const opened = open(dbPath, media);
  return {
    dbPath,
    media,
    ...opened,
    films: opened.storage.addLibraryFolder(films.root),
    shows: opened.storage.addLibraryFolder(shows.root),
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

/** One whole Link scan of both folders, then the run let go. */
async function scanOnce(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan([box.films, box.shows], false, 'link');
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

const filmTitles = (storage: LibraryStorage): string[] =>
  storage
    .listMovies({ sort: 'a-z' })
    .map((movie) => movie.title)
    .sort();

const showTitles = (storage: LibraryStorage): string[] =>
  storage
    .getSeriesHome()
    .series.map((series) => series.title)
    .sort();

const idOf = (
  storage: LibraryStorage,
  kind: 'movies' | 'series',
  title: string
): string => {
  const found =
    kind === 'movies'
      ? storage.listMovies({ sort: 'a-z' }).find((m) => m.title === title)
      : storage.getSeriesHome().series.find((s) => s.title === title);
  if (found === undefined) {
    throw new Error(`the library holds no ${title}`);
  }
  return found.id;
};

/** Rename a title and forget its folder, as a Sync's rename over an old library would leave it. */
function renameWithNoFolder(
  db: SqliteDatabase,
  table: 'movies' | 'series',
  id: string,
  title: string
): void {
  db.prepare(
    `UPDATE ${table} SET title = ?, library_folder_id = NULL, source_folder = NULL WHERE id = ?`
  ).run(title, id);
}

/** A title's recorded folder, its Source folder read with forward slashes. */
function recordedFolder(
  storage: LibraryStorage,
  id: string
): { folderId: string; sourceFolder: string } | null {
  const source = storage.titleSource(id);
  return source === null
    ? null
    : {
        folderId: source.folderId,
        sourceFolder: source.sourceFolder.split(sep).join('/'),
      };
}

const alreadyHeldLines = (run: ImportRun): string[] =>
  run.log
    .map((line) => line.text)
    .filter((text) => text.startsWith('· Already in library'));

describe('createImporter.scan — a renamed title with no folder on record', () => {
  it('finds a renamed film Already in library by its Linked video', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = idOf(box.storage, 'movies', 'Die Hard');
    renameWithNoFolder(box.db, 'movies', id, 'Nakatomi Plaza');

    const run = await scanOnce(box);

    expect(filmTitles(box.storage)).toEqual(['Amelie', 'Nakatomi Plaza']);
    expect(alreadyHeldLines(run)).toContain(
      '· Already in library Die Hard (1988)'
    );
  });

  it('records the renamed film’s folder, so the next scan matches by folder', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = idOf(box.storage, 'movies', 'Die Hard');
    renameWithNoFolder(box.db, 'movies', id, 'Nakatomi Plaza');

    await scanOnce(box);

    expect(recordedFolder(box.storage, id)).toEqual({
      folderId: box.films.id,
      sourceFolder: 'Die.Hard.1988.1080p',
    });
  });

  it('finds a renamed series Already in library by its episodes’ videos', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = idOf(box.storage, 'series', 'Harbor & Vine');
    renameWithNoFolder(box.db, 'series', id, 'Harbour Lights');

    await scanOnce(box);

    expect(showTitles(box.storage)).toEqual(['Harbour Lights', 'Tidewater']);
    expect(box.storage.listEpisodes(id)).toHaveLength(2);
  });

  it('records the renamed series’ Show folder', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = idOf(box.storage, 'series', 'Harbor & Vine');
    renameWithNoFolder(box.db, 'series', id, 'Harbour Lights');

    await scanOnce(box);

    expect(recordedFolder(box.storage, id)).toEqual({
      folderId: box.shows.id,
      sourceFolder: 'Harbor & Vine (2021)',
    });
  });
});

describe('createImporter.scan — a held series found by one episode', () => {
  it('is the held series, and gains the Show folder’s new episodes', async () => {
    const box = sandbox();
    const held = box.storage.addSeries(
      { title: 'Harbour Lights', mediaFolder: 'harbour-lights' },
      [
        {
          season: 1,
          number: 1,
          videoPath: HARBOR_PILOT,
          videoFolderId: box.shows.id,
        },
      ]
    );

    await scanOnce(box);

    expect(showTitles(box.storage)).toEqual(['Harbour Lights', 'Tidewater']);
    expect(
      box.storage.listEpisodes(held.id).map((episode) => episode.videoPath)
    ).toEqual([HARBOR_PILOT, HARBOR_SECOND]);
    expect(recordedFolder(box.storage, held.id)).toEqual({
      folderId: box.shows.id,
      sourceFolder: 'Harbor & Vine (2021)',
    });
  });
});

describe('createImporter.scan — a double an older library holds', () => {
  it('still migrates, and the scan adds no third title over the shared video', async () => {
    const box = sandbox();
    const first = box.storage.addMovie(
      newMovie({
        title: 'Nakatomi Plaza',
        videoPath: DIE_HARD,
        videoFolderId: box.films.id,
      })
    );
    const second = box.storage.addMovie(
      newMovie({
        title: 'Nakatomi Plaza (copy)',
        videoPath: DIE_HARD,
        videoFolderId: box.films.id,
      })
    );
    closeTracked();
    // Reopened: every migration runs again over a database holding the double.
    const reopened = { ...box, ...open(box.dbPath, box.media) };

    await scanOnce(reopened);

    expect(filmTitles(reopened.storage)).toEqual([
      'Amelie',
      'Nakatomi Plaza',
      'Nakatomi Plaza (copy)',
    ]);
    expect(
      [first.id, second.id].map((id) => recordedFolder(reopened.storage, id))
    ).toContainEqual({
      folderId: box.films.id,
      sourceFolder: 'Die.Hard.1988.1080p',
    });
  });
});
