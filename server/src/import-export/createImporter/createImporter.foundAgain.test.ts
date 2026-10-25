// @vitest-environment node
//
// 51, Library audit, follow-up Phase 23: "found again" (issue #470).
//
// The **Missing video** rule sits third in `heldFilm`: a found video no
// earlier rule placed, whose file name is the file name of exactly one held
// film's Missing video. When it, or the folder on record, finds a film whose
// video is missing, the film is **Found again**:
//
// - the found video is placed by the run's **Import mode**, linked in Link
//   and copied into the film's **Media folder** in Copy (reserved and
//   recorded when that is gone);
// - only its video columns change, so its title, rating and watch history
//   are kept;
// - the run logs one `✓ Updated` line naming `video`, and files nothing;
// - two missing films of one file name are both left alone.
//
// The runs are real: the fixture copied into a sandboxed Library folder, an
// on-disk library with a raw handle for the columns no shared type carries, a
// real `Media` over a sandbox managed directory, and the absent **Playback
// component**.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
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
import type { ImportMode, ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const STAR_WARS = 'Star Wars';
const FILE_NAME = 'The Last Jedi (2017).mp4';
/** The found video, relative to the films folder. */
const FOUND_VIDEO = `${STAR_WARS}/${FILE_NAME}`;
/** The household's dead copy: its file's name, its Media folder gone. */
const DEAD_COPY = `star-wars/${FILE_NAME}`;

interface Sandbox {
  dir: string;
  media: string;
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  playback: Playback;
  films: StoredLibraryFolder;
}

/**
 * The fixture in a listed films folder, with a `Star Wars` Source folder
 * beside it holding the real `The Last Jedi (2017).mp4`.
 */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-found-again-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  const { root } = libraryFixture(join(dir, 'films'), 'library.csv');
  mkdirSync(join(root, STAR_WARS));
  copyFileSync(
    join(root, 'Drama', 'Amelie (2001)', 'Amelie.mp4'),
    join(root, STAR_WARS, FILE_NAME)
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
    media,
    storage,
    db,
    importer,
    playback,
    films: storage.addLibraryFolder(root),
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

/** One whole scan of the films folder in this mode, then the run let go. */
async function scanOnce(box: Sandbox, mode: ImportMode): Promise<ImportRun> {
  await box.importer.scan([box.films], false, mode);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

interface VideoRow {
  video_path: string;
  video_folder_id: string | null;
}

const videoOf = (db: SqliteDatabase, id: string): VideoRow =>
  db
    .prepare('SELECT video_path, video_folder_id FROM movies WHERE id = ?')
    .get(id) as VideoRow;

/** Every film recorded at the `Star Wars` Source folder, by id. */
const filmsFromStarWars = (db: SqliteDatabase): string[] =>
  (
    db
      .prepare('SELECT id FROM movies WHERE source_folder = ? ORDER BY id')
      .all(STAR_WARS) as { id: string }[]
  ).map((row) => row.id);

/** The run's `✓ Updated` lines that name `video`. */
const videoUpdates = (run: ImportRun): string[] =>
  run.log
    .filter(
      (line) =>
        line.kind === 'success' &&
        line.text.startsWith('✓ Updated') &&
        /— .*\bvideo\b/.test(line.text)
    )
    .map((line) => line.text);

/** The dead copy, rated and half watched, its Media folder named but gone. */
function deadCopy(box: Sandbox): string {
  const dead = box.storage.addMovie(
    newMovie({
      title: STAR_WARS,
      year: 1977,
      rating: 9,
      videoPath: DEAD_COPY,
      mediaFolder: 'star-wars',
    })
  );
  box.storage.setResumePosition(dead.id, 1200);
  expect(
    box.playback.videoFile({ videoPath: DEAD_COPY, videoFolderId: null })
  ).toEqual({ kind: 'missing' });
  return dead.id;
}

describe("createImporter.scan: a dead copy with the found file's name", () => {
  it('is found again in Link: it links the found video, and no second film is added', async () => {
    const box = sandbox();
    const id = deadCopy(box);

    await scanOnce(box, 'link');

    expect(filmsFromStarWars(box.db)).toEqual([id]);
    expect(videoOf(box.db, id)).toEqual({
      video_path: FOUND_VIDEO,
      video_folder_id: box.films.id,
    });
    expect(box.storage.titleSource(id)).toMatchObject({
      folderId: box.films.id,
      sourceFolder: STAR_WARS,
    });
  });

  it('is found again in Copy: the video is copied into its Media folder, and no second film is added', async () => {
    const box = sandbox();
    const id = deadCopy(box);
    // The Media folder is still there; only its video is gone.
    mkdirSync(join(box.media, 'star-wars'));

    await scanOnce(box, 'copy');

    expect(filmsFromStarWars(box.db)).toEqual([id]);
    const video = videoOf(box.db, id);
    expect(video.video_folder_id).toBeNull();
    expect(video.video_path.startsWith('star-wars/')).toBe(true);
    expect(
      box.playback.videoFile({
        videoPath: video.video_path,
        videoFolderId: null,
      })
    ).toMatchObject({ kind: 'file' });
    expect(box.storage.mediaFolderOf('movie', id)).toBe('star-wars');
  });

  it('in Copy, reserves and records a Media folder when its own is gone', async () => {
    const box = sandbox();
    const id = deadCopy(box);

    await scanOnce(box, 'copy');

    expect(filmsFromStarWars(box.db)).toEqual([id]);
    const video = videoOf(box.db, id);
    expect(video.video_folder_id).toBeNull();
    expect(
      box.playback.videoFile({
        videoPath: video.video_path,
        videoFolderId: null,
      })
    ).toMatchObject({ kind: 'file' });
    const recorded = box.storage.mediaFolderOf('movie', id);
    expect(recorded).not.toBeNull();
    expect(video.video_path.split('/')[0]).toBe(recorded);
    expect(existsSync(join(box.media, recorded ?? ''))).toBe(true);
  });

  it('keeps its title, rating and watch history', async () => {
    const box = sandbox();
    const id = deadCopy(box);
    const before = box.storage.getMovie(id);

    await scanOnce(box, 'link');

    expect(videoOf(box.db, id).video_path).toBe(FOUND_VIDEO);
    expect(box.storage.getMovie(id)).toMatchObject({
      title: before?.title,
      year: before?.year,
      rating: before?.rating,
      watched: before?.watched,
      resumePositionSeconds: before?.resumePositionSeconds,
      lastWatchedAt: before?.lastWatchedAt,
    });
  });

  it('logs one ✓ Updated line naming video, and files nothing in review', async () => {
    const box = sandbox();
    deadCopy(box);

    const run = await scanOnce(box, 'link');

    expect(videoUpdates(run)).toHaveLength(1);
    expect(run.problems).toEqual([]);
  });
});

describe('createImporter.scan: a film whose folder is on record and whose video is gone', () => {
  it('takes the video found in that folder', async () => {
    const box = sandbox();
    const gone = `${STAR_WARS}/Star Wars (1977).mp4`;
    const held = box.storage.addMovie(
      newMovie({
        title: STAR_WARS,
        year: 1977,
        videoPath: gone,
        videoFolderId: box.films.id,
      })
    );
    box.storage.setSourceFolder(held.id, box.films.id, STAR_WARS);
    expect(
      box.playback.videoFile({ videoPath: gone, videoFolderId: box.films.id })
    ).toEqual({ kind: 'missing' });

    const run = await scanOnce(box, 'link');

    expect(filmsFromStarWars(box.db)).toEqual([held.id]);
    expect(videoOf(box.db, held.id)).toEqual({
      video_path: FOUND_VIDEO,
      video_folder_id: box.films.id,
    });
    expect(videoUpdates(run)).toHaveLength(1);
  });
});

describe('createImporter.scan: two missing films of one file name', () => {
  it('leaves both alone, while a film whose file name is its own is found again', async () => {
    const box = sandbox();
    // A second found video, whose name only one missing film's file carries.
    mkdirSync(join(box.films.path, 'Rogue One'));
    copyFileSync(
      join(box.films.path, STAR_WARS, FILE_NAME),
      join(box.films.path, 'Rogue One', 'Rogue One (2016).mp4')
    );
    const rogue = box.storage.addMovie(
      newMovie({
        title: 'A Star Wars Story',
        videoPath: 'rogue-one/Rogue One (2016).mp4',
      })
    );
    const first = box.storage.addMovie(
      newMovie({ title: STAR_WARS, year: 1977, videoPath: DEAD_COPY })
    );
    const secondPath = `last-jedi/${FILE_NAME}`;
    const second = box.storage.addMovie(
      newMovie({
        title: 'Star Wars: The Last Jedi',
        year: 2017,
        videoPath: secondPath,
      })
    );

    const run = await scanOnce(box, 'link');

    expect(videoOf(box.db, first.id)).toEqual({
      video_path: DEAD_COPY,
      video_folder_id: null,
    });
    expect(videoOf(box.db, second.id)).toEqual({
      video_path: secondPath,
      video_folder_id: null,
    });
    expect(videoOf(box.db, rogue.id)).toEqual({
      video_path: 'Rogue One/Rogue One (2016).mp4',
      video_folder_id: box.films.id,
    });
    expect(videoUpdates(run)).toHaveLength(1);
  });
});

describe('createImporter.scan: a second folder keying to a film found again earlier in the run', () => {
  it('is Already in library, and the library holds one film', async () => {
    const box = sandbox();
    deadCopy(box);
    // A folder whose name keys to the dead copy's title and year, its video
    // named otherwise, walked after the `Star Wars` folder that finds it.
    const keyed = `${STAR_WARS} (1977)`;
    mkdirSync(join(box.films.path, keyed));
    copyFileSync(
      join(box.films.path, STAR_WARS, FILE_NAME),
      join(box.films.path, keyed, 'A New Hope.mp4')
    );

    const run = await scanOnce(box, 'link');

    expect(videoUpdates(run)).toHaveLength(1);
    expect(
      run.log.filter(
        (line) => line.text === `· Already in library ${STAR_WARS} (1977)`
      )
    ).toHaveLength(1);
    expect(
      box.db
        .prepare('SELECT COUNT(*) AS count FROM movies WHERE title = ?')
        .get(STAR_WARS)
    ).toEqual({ count: 1 });
  });
});
