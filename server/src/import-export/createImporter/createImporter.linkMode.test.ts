// @vitest-environment node
//
// 41 — Link or copy, Slice 3: "a linked film plays" (issue #343).
//
// `createImporter.scan(folders, enrich, mode)` — the **Folder scan** under an
// **Import mode**. Link changes one call: where a Copy run would `copyIn` a
// film's video, a Link run records `{ videoFolderId, videoPath }`, the path
// relative to the **Library folder** with forward slashes — a **Linked
// video**. Everything else is as a Copy run's: the Movie folder reserved and
// recorded, the art and subtitles copied in, the runtime derived off the
// bytes, the Source folder recorded. `ImportRun.mode` is on the snapshot; a
// held title never changes mode on a re-run; a cancelled Link run rolls back
// its reserved folder.
//
// The runs are real: the film fixture copied into a sandboxed Library folder,
// a real `Media` over a sandbox managed directory, a `Playback` reading the
// folder's path off the same library, the absent **Playback component**, and
// a raw handle on the database for the column no shared type carries.

import { existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { openDatabase, type SqliteDatabase } from '../../db';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import {
  createPlayback,
  type Playback,
} from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { heldCopy } from '../../test-support/heldCopy/heldCopy';
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportMode, ImportRun, Movie } from '@/types';

afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  playback: Playback;
  /** The managed media directory. */
  media: string;
  /** The Library folder the film fixture was copied into, listed. */
  folder: StoredLibraryFolder;
}

function sandbox({
  media: mediaSeam = (real) => real,
}: { media?: (real: Media) => Media } = {}): Sandbox {
  const dir = sandboxRoot('familyflix-import-link-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  const { root: films } = libraryFixture(join(dir, 'films'), 'library.csv');

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
    media: mediaSeam(createMedia(media)),
    playback,
  });
  const folder = storage.addLibraryFolder(films);
  return { storage, db, importer, playback, media, folder };
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

/** One whole scan in a mode, then the run let go, so another may start. */
async function scanOnce(box: Sandbox, mode: ImportMode): Promise<ImportRun> {
  await box.importer.scan([box.folder], false, mode);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

function byTitle(storage: LibraryStorage): Record<string, Movie> {
  return Object.fromEntries(
    storage.listMovies({ sort: 'a-z' }).map((movie) => [movie.title, movie])
  );
}

/** Every file under a directory, relative to it, with forward slashes. */
function filesUnder(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  return (
    readdirSync(root, { recursive: true, withFileTypes: true }) as {
      isFile(): boolean;
      name: string;
      parentPath: string;
    }[]
  )
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(root, join(entry.parentPath, entry.name)).split(sep).join('/')
    )
    .sort();
}

const isVideo = (path: string) => /\.(mp4|mkv|avi|webm|mov)$/i.test(path);

/** The Source folder recorded for a film, read with forward slashes. */
function sourceFolderOf(db: SqliteDatabase, id: string): string | null {
  const row = db
    .prepare('SELECT source_folder FROM movies WHERE id = ?')
    .get(id) as { source_folder: string | null } | undefined;
  return row?.source_folder?.split(sep).join('/') ?? null;
}

describe('createImporter.scan — a Link scan', () => {
  it('records each film’s video as linked, relative to its Library folder', async () => {
    const box = sandbox();

    await scanOnce(box, 'link');

    const films = byTitle(box.storage);
    expect(films['Amelie']).toMatchObject({
      videoFolderId: box.folder.id,
      videoPath: 'Drama/Amelie (2001)/Amelie.mp4',
    });
    expect(films['Die Hard']).toMatchObject({
      videoFolderId: box.folder.id,
      videoPath: 'Die.Hard.1988.1080p/Die.Hard.1988.1080p.mp4',
    });
  });

  it('copies no video into the managed media directory', async () => {
    const box = sandbox();

    await scanOnce(box, 'link');

    expect(byTitle(box.storage)['Amelie']).toBeDefined();
    expect(filesUnder(box.media).filter(isVideo)).toEqual([]);
  });

  it('still reserves and records each film’s Movie folder', async () => {
    const box = sandbox();

    await scanOnce(box, 'link');

    const amelie = byTitle(box.storage)['Amelie'];
    expect(amelie.videoFolderId).toBe(box.folder.id);
    expect(box.storage.mediaFolderOf('movie', amelie.id)).toBe('amelie-2001');
    expect(existsSync(join(box.media, 'amelie-2001'))).toBe(true);
  });

  it('copies the art and the subtitles into the Movie folder', async () => {
    const box = sandbox();

    await scanOnce(box, 'link');

    const amelie = byTitle(box.storage)['Amelie'];
    expect(amelie.posterPath).toBe('amelie-2001/cover.png');
    expect(amelie.backdropPath).toBe('amelie-2001/backdrop.png');
    expect(amelie.subtitles.map((track) => track.path)).toEqual([
      'amelie-2001/Amelie.srt',
    ]);
    expect(filesUnder(join(box.media, 'amelie-2001'))).toEqual([
      'Amelie.srt',
      'backdrop.png',
      'cover.png',
    ]);
  });

  it('derives the runtime off the linked video', async () => {
    const box = sandbox();

    await scanOnce(box, 'link');

    // The fixture's headers say 132 and 122 minutes, read where they lie.
    const films = byTitle(box.storage);
    expect(films['Amelie'].videoFolderId).toBe(box.folder.id);
    expect(films['Die Hard'].runtimeMinutes).toBe(132);
    expect(films['Amelie'].runtimeMinutes).toBe(122);
  });

  it('records the Source folder', async () => {
    const box = sandbox();

    await scanOnce(box, 'link');

    const amelie = byTitle(box.storage)['Amelie'];
    expect(amelie.videoFolderId).toBe(box.folder.id);
    expect(sourceFolderOf(box.db, amelie.id)).toBe('Drama/Amelie (2001)');
  });

  it('plays: the linked video opens where it lies', async () => {
    const box = sandbox();

    await scanOnce(box, 'link');

    const amelie = byTitle(box.storage)['Amelie'];
    const opened = box.playback.videoFile({
      videoPath: amelie.videoPath,
      videoFolderId: amelie.videoFolderId,
    });
    expect(opened.kind).toBe('file');
    const file = opened.kind === 'file' ? opened.file : '';
    expect(
      relative(realpathSync(box.folder.path), realpathSync(file))
        .split(sep)
        .join('/')
    ).toBe('Drama/Amelie (2001)/Amelie.mp4');
  });
});

describe('createImporter.scan — a Copy scan', () => {
  it('copies each film’s video in, as today', async () => {
    const box = sandbox();

    const run = await scanOnce(box, 'copy');

    expect(run.mode).toBe('copy');
    const films = byTitle(box.storage);
    expect(films['Amelie']).toMatchObject({
      videoFolderId: null,
      videoPath: 'amelie-2001/Amelie.mp4',
    });
    expect(films['Die Hard']).toMatchObject({
      videoFolderId: null,
      videoPath: 'die-hard-1988/Die.Hard.1988.1080p.mp4',
    });
    expect(filesUnder(box.media).filter(isVideo)).toEqual([
      'amelie-2001/Amelie.mp4',
      'die-hard-1988/Die.Hard.1988.1080p.mp4',
    ]);
  });

  it('copies the art and subtitles, and derives the runtime, as today', async () => {
    const box = sandbox();

    const run = await scanOnce(box, 'copy');

    expect(run.mode).toBe('copy');
    const amelie = byTitle(box.storage)['Amelie'];
    expect(amelie.posterPath).toBe('amelie-2001/cover.png');
    expect(amelie.backdropPath).toBe('amelie-2001/backdrop.png');
    expect(amelie.runtimeMinutes).toBe(122);
    expect(sourceFolderOf(box.db, amelie.id)).toBe('Drama/Amelie (2001)');
  });
});

describe('createImporter.scan — ImportRun.mode', () => {
  it.each(['link', 'copy'] as const)(
    'carries mode %s on every snapshot',
    async (mode) => {
      const box = sandbox();

      const first = await box.importer.scan([box.folder], false, mode);
      const last = await untilReview(box.importer);
      await box.importer.cancel();

      expect(first.mode).toBe(mode);
      expect(last.mode).toBe(mode);
    }
  );
});

describe('createImporter.scan — a re-run in the other mode', () => {
  it('a Copy re-run over a Link library changes nothing', async () => {
    const box = sandbox();
    await scanOnce(box, 'link');
    const before = byTitle(box.storage);
    const filesBefore = filesUnder(box.media);

    await scanOnce(box, 'copy');

    expect(byTitle(box.storage)).toEqual(before);
    expect(filesUnder(box.media)).toEqual(filesBefore);
    expect(before['Amelie'].videoFolderId).toBe(box.folder.id);
  });

  it('a Link re-run over a Copy library changes nothing', async () => {
    const box = sandbox();
    await scanOnce(box, 'copy');
    const before = byTitle(box.storage);
    const filesBefore = filesUnder(box.media);

    const rerun = await scanOnce(box, 'link');

    expect(rerun.mode).toBe('link');
    expect(byTitle(box.storage)).toEqual(before);
    expect(filesUnder(box.media)).toEqual(filesBefore);
    expect(before['Amelie'].videoFolderId).toBeNull();
  });
});

describe('createImporter.scan — a cancelled Link run', () => {
  it('rolls back the folder it reserved for the title in flight', async () => {
    // Under Link the first copy of Amélie's is her poster, not her video.
    const hold = heldCopy('cover.png');
    const box = sandbox({ media: hold.seam });
    await box.importer.scan([box.folder], false, 'link');
    await hold.reached;
    expect(box.importer.current()?.mode).toBe('link');
    expect(existsSync(join(box.media, 'amelie-2001'))).toBe(true);

    const cancelled = box.importer.cancel();
    hold.release();
    await cancelled;

    expect(box.importer.current()).toBeNull();
    expect(byTitle(box.storage)['Amelie']).toBeUndefined();
    expect(existsSync(join(box.media, 'amelie-2001'))).toBe(false);
  });
});
