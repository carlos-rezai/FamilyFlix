// @vitest-environment node
//
// 51, Library audit, follow-up Phase 22: "a missing film holds by evidence"
// (issue #469).
//
// The **Title key** rule in **Already in library** passes over a held film
// whose video is a **Missing video** (`playback.videoFile` answers `missing`)
// wherever a found video is at stake:
//
// - a scan beside a held _Guardians of the Galaxy_ whose copied video is gone
//   imports the found `Guardians of the Galaxy.mp4` as a new film, and it
//   plays;
// - a held film whose Library folder is only unplugged (`unreachable`) still
//   holds by key, so an offline drive never makes a double;
// - a **Sheet row** with no folder found still reaches a missing film by key,
//   for its **Sheet fills**.
//
// The runs are real: the fixture copied into a sandboxed Library folder, an
// on-disk library with a raw handle for the columns no shared type carries, a
// real `Media` over a sandbox managed directory, and the absent **Playback
// component**.

import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
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
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const GUARDIANS = 'Guardians of the Galaxy';
const FOUND_VIDEO = `${GUARDIANS}/${GUARDIANS}.mp4`;
/** The household's dead copy: _Vol. 2_, mistitled, its file gone. */
const DEAD_COPY = 'guardians-of-the-galaxy/Guardians of the Galaxy Vol. 2.mp4';

interface Sandbox {
  dir: string;
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  playback: Playback;
  films: StoredLibraryFolder;
  /** The fixture's sheet, naming Die Hard and Amelie. */
  sheet: string;
}

/**
 * The fixture in a listed films folder, with a `Guardians of the Galaxy`
 * Source folder beside it holding the real `Guardians of the Galaxy.mp4`.
 */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-missing-video-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  const { root, sheet } = libraryFixture(join(dir, 'films'), 'library.csv');
  mkdirSync(join(root, GUARDIANS));
  copyFileSync(
    join(root, 'Drama', 'Amelie (2001)', 'Amelie.mp4'),
    join(root, GUARDIANS, `${GUARDIANS}.mp4`)
  );

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
  });
  return {
    dir,
    storage,
    db,
    importer,
    playback,
    films: storage.addLibraryFolder(root),
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

/** One whole Link scan of the films folder, then the run let go. */
async function scanOnce(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan([box.films], false, 'link');
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

/** One whole sheet run, then the run let go. */
async function runSheet(box: Sandbox): Promise<ImportRun> {
  await box.importer.start(box.sheet);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

interface VideoRow {
  id: string;
  video_path: string;
  video_folder_id: string | null;
}

/** Every film with this title, with its video columns. */
const filmsTitled = (db: SqliteDatabase, title: string): VideoRow[] =>
  db
    .prepare(
      'SELECT id, video_path, video_folder_id FROM movies WHERE title = ? ORDER BY video_path'
    )
    .all(title) as VideoRow[];

describe('createImporter.scan: a held film whose video is missing', () => {
  it('imports the found Guardians of the Galaxy.mp4 beside it as a new film', async () => {
    const box = sandbox();
    const dead = box.storage.addMovie(
      newMovie({ title: GUARDIANS, videoPath: DEAD_COPY })
    );
    expect(
      box.playback.videoFile({ videoPath: DEAD_COPY, videoFolderId: null })
    ).toEqual({ kind: 'missing' });

    await scanOnce(box);

    const films = filmsTitled(box.db, GUARDIANS);
    expect(films).toHaveLength(2);
    const found = films.find((film) => film.id !== dead.id);
    expect(found).toMatchObject({
      video_path: FOUND_VIDEO,
      video_folder_id: box.films.id,
    });
  });

  it('leaves the new film playable', async () => {
    const box = sandbox();
    const dead = box.storage.addMovie(
      newMovie({ title: GUARDIANS, videoPath: DEAD_COPY })
    );

    await scanOnce(box);

    const found = filmsTitled(box.db, GUARDIANS).find(
      (film) => film.id !== dead.id
    );
    expect(found).toBeDefined();
    expect(
      box.playback.videoFile({
        videoPath: found?.video_path ?? '',
        videoFolderId: found?.video_folder_id ?? null,
      })
    ).toMatchObject({ kind: 'file' });
  });
});

describe('createImporter.scan: a held film on an unreadable Library folder', () => {
  it('still holds by key, so no second film is made', async () => {
    const box = sandbox();
    const unplugged = join(box.dir, 'unplugged');
    mkdirSync(unplugged);
    const offline = box.storage.addLibraryFolder(unplugged);
    const held = box.storage.addMovie(
      newMovie({
        title: GUARDIANS,
        videoPath: FOUND_VIDEO,
        videoFolderId: offline.id,
      })
    );
    // The drive is unplugged: the folder is listed but no longer reads.
    rmSync(unplugged, { recursive: true, force: true });
    expect(
      box.playback.videoFile({
        videoPath: FOUND_VIDEO,
        videoFolderId: offline.id,
      })
    ).toEqual({ kind: 'unreachable' });

    await scanOnce(box);

    expect(filmsTitled(box.db, GUARDIANS).map((film) => film.id)).toEqual([
      held.id,
    ]);
  });
});

describe('createImporter.start: a sheet row with no folder found', () => {
  it('still fills a held film whose video is missing', async () => {
    const box = sandbox();
    // The fixture's Die Hard folder is gone, so its row finds no folder.
    rmSync(join(box.films.path, 'Die.Hard.1988.1080p'), {
      recursive: true,
      force: true,
    });
    const held = box.storage.addMovie({
      title: 'Die Hard',
      year: 1988,
      videoPath: 'die-hard-1988/video.mp4',
    });
    expect(
      box.playback.videoFile({
        videoPath: 'die-hard-1988/video.mp4',
        videoFolderId: null,
      })
    ).toEqual({ kind: 'missing' });

    await runSheet(box);

    expect(box.storage.getMovie(held.id)).toMatchObject({
      director: 'John McTiernan',
      rating: 8,
    });
  });
});
