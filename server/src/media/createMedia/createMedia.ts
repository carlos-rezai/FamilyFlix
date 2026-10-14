import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';

import { mediaFilePath } from '../../playback/mediaFilePath/mediaFilePath';
import { movieFolder } from '../movieFolder/movieFolder';
import { safeFilename } from '../safeFilename/safeFilename';

/**
 * A **Movie folder** that has just been renamed, and what the paths already
 * written into it are now.
 *
 * The route reserves a folder the moment a part needs somewhere to go, which
 * can be before the title that names it has arrived — a `FormData` carries its
 * parts in whatever order the client appended them. So the folder gets its
 * final name once the whole body has been read, and the **Stored paths**
 * `storeUpload` already answered are re-anchored here rather than rebuilt by a
 * caller: how a stored path is spelled is this domain's business, not the
 * route's.
 */
export interface RenamedFolder {
  /** The folder the movie's files are in now. */
  folder: string;
  /** What a path {@link Media.storeUpload} answered before the rename is now. */
  storedPath(previous: string): string;
}

/**
 * What the API layer can ask the media domain for: the one object in the app
 * that writes into the **Managed media directory**, and the only thing that
 * ever deletes from it.
 *
 * It is injected into the router the way `playback` already is, so the route
 * layer never learns there is a filesystem — it reserves somewhere to put a
 * film, hands over a part, and is told the **Stored path** the library should
 * remember.
 */
export interface Media {
  /**
   * Somewhere for one movie's files to live, created and empty.
   *
   * The name is {@link movieFolder}'s, with `-2`, `-3` … appended if a folder
   * of that name is already taken: two films that happen to share a title and
   * a year must not share a folder, because the second one's files would
   * overwrite the first one's.
   */
  reserveFolder(title: string, year: number | null): string;

  /**
   * A title's recorded **Media folder**, as an absolute directory ready to be
   * written into — or `null` for a folder that is not there, is the media root
   * itself, or lies outside it.
   *
   * What an *edit* uses instead of {@link reserveFolder}: a title already has
   * somewhere its files live, and giving it a second folder because its title
   * was corrected would mean moving gigabytes to fix a spelling. A caller with
   * nothing here has no folder to reuse and must reserve one.
   */
  openFolder(folder: string): string | null;

  /**
   * The title's folder a **Stored path** lies under — its first segment, a
   * `season-NN/` between them or not — opened as {@link openFolder} opens a
   * recorded one, or `null`. What a **Resolve** reuses when the route's bytes
   * already went somewhere: the folder they went into becomes the title's.
   */
  storedFolder(storedPath: string): string | null;

  /**
   * The `season-NN/` directory under a reserved **Series folder**, created if
   * it is not there yet, and its path — where one season's episodes are copied
   * in. Two digits, so the seasons list in order; asking again for a season
   * already made is harmless.
   */
  seasonFolder(seriesFolder: string, season: number): string;

  /**
   * Give a reserved folder the name its movie's title asks for, once that
   * title is known — and leave it exactly where it is when it already has one.
   */
  renameFolder(
    folder: string,
    title: string,
    year: number | null
  ): RenamedFolder;

  /**
   * Write one part's bytes to `<folder>/<safe name>`, and answer with the path
   * the library stores: **relative** to the managed media directory, separated
   * with forward slashes.
   *
   * The source is a stream and stays one all the way to the file, so a 12 GB
   * film never sits in memory. It resolves once the bytes are on disk, because
   * the row that points at them is written after it.
   */
  storeUpload(
    folder: string,
    filename: string,
    source: Readable
  ): Promise<string>;

  /**
   * Write `source` as exactly `name` into a recorded **Media folder** — or,
   * given a `season`, into that season's `season-NN/` under it, made if it is
   * not there, the name {@link seasonFolder} spells — answering the **Stored
   * path** of what it wrote: a **Sync**'s `poster.jpg` and `backdrop.jpg`, a
   * Season poster, a Still. A file of that name is replaced, so a second Sync
   * leaves one poster. Rejects, writing nothing, for a folder that is not
   * there, is the media root, or lies outside it.
   */
  storeNamed(
    folder: string,
    name: string,
    source: Readable,
    season?: number
  ): Promise<string>;

  /**
   * The bytes of the file a **Stored path** names, as a stream — what a
   * **Write target** copies out of managed storage. Rejects for a path that
   * escapes the media directory or names no file, `mediaFilePath`'s check.
   */
  readStored(storedPath: string): Promise<Readable>;

  /**
   * **Copy-in**: {@link storeUpload}'s **Bulk import** counterpart — the same
   * **Managed copy** into `<folder>/<safe name>`, from a file where it lies
   * under a **Library folder** instead of from a stream, answering the same
   * **Stored path**. The name is the source's own, through the same sanitiser.
   *
   * Copy, never move: the originals under the root survive a bad run, and
   * cancelling needs no undo. A source that is not there is refused rather
   * than answered with a path to nothing.
   *
   * `signal`, when given, is **Bulk import**'s cancel reaching the copy that
   * is going: an aborted copy rejects and leaves no half-file behind for the
   * folder's rollback to miss.
   */
  copyIn(
    folder: string,
    sourcePath: string,
    signal?: AbortSignal
  ): Promise<string>;

  /**
   * Remove a folder and everything one request wrote into it — the rollback,
   * so a save that fails partway leaves no row *and* no bytes.
   *
   * A folder that was never reserved, or one that is not under the managed
   * media directory at all, is silently nothing to do: a rollback runs on the
   * path a failed save happened to reach, and a throw there would replace the
   * route's own answer with an exception.
   */
  removeFolder(folder: string): void;

  /**
   * Remove the one file a **Stored path** names, and nothing beside it.
   *
   * The cleanup after a replaced file, which runs *after* the row has
   * committed — so it swallows its own failure. Losing an edit that already
   * succeeded is the wrong trade against one stranded file.
   */
  removeFile(storedPath: string): void;

  /**
   * Remove a title's whole recorded **Media folder** — a film's Movie folder
   * or a series' Series folder, everything in it. What a **Delete** runs
   * *after* the row has gone, so it is **best-effort** and swallows its own
   * failure — a locked video leaves a **Stranded folder**, not a failed
   * delete. A folder outside the media root, the root itself, or one already
   * gone is nothing to do.
   */
  removeTitleFolder(folder: string): void;

  /**
   * Empty the **Managed media directory** and keep it — **Factory reset**'s
   * removal. Each entry directly inside the root is removed on its own,
   * **best-effort**: one that will not go — a video the stream route still has
   * open — is left, and the rest go anyway. A link is removed as a link, its
   * target never followed. A root that does not exist is nothing to do. Never
   * throws: it runs after the library's rows have gone.
   */
  emptyRoot(): void;
}

/**
 * Compose the media domain over a **Managed media directory**.
 *
 * The directory is bound here rather than passed per call, for `createPlayback`'s
 * reason: every route reaches the same tree and none of them can be handed a
 * different root by a request. `main.ts` composes it from
 * `FAMILYFLIX_MEDIA_PATH`; the tests compose it from a temporary directory.
 *
 * **Containment is checked on the resolved path, on both deletions.** This is
 * the only thing in the app that removes media, so the media root is the whole
 * of what it is allowed to remove inside — and the rule is `mediaFilePath`'s
 * own rather than a second spelling of it, because a second spelling is where
 * the two drift apart.
 */
export function createMedia(mediaPath: string): Media {
  /**
   * A free name for a folder, without creating it: the slug itself if nothing
   * holds it, and `-2`, `-3` … until something is free.
   */
  const freeFolder = (title: string, year: number | null): string => {
    const wanted = movieFolder(title, year);
    let candidate = join(mediaPath, wanted);

    for (let n = 2; existsSync(candidate); n += 1) {
      candidate = join(mediaPath, `${wanted}-${n}`);
    }
    return candidate;
  };

  /** The stored path of a file sitting directly inside a movie folder. */
  const storedIn = (folder: string, filename: string): string =>
    relative(mediaPath, join(folder, filename)).split(sep).join('/');

  /** The media root as the filesystem itself spells it, or `null` if it is not there. */
  const realRoot = (): string | null => {
    try {
      return realpathSync(resolve(mediaPath));
    } catch {
      return null;
    }
  };

  /**
   * A directory strictly inside the media root, as the filesystem spells it —
   * or `null` for one that is not there, is the root itself, or escapes it.
   * `mediaFilePath`'s rule, stated once for both removals of a folder:
   * `removeFolder` hands it the absolute path `reserveFolder` made, and
   * `removeTitleFolder` — through {@link recordedFolder} — a recorded **Media
   * folder**.
   */
  const containedFolder = (candidate: string): string | null => {
    const root = realRoot();
    if (root === null) {
      return null;
    }

    let target: string;
    let isDirectory: boolean;
    try {
      target = realpathSync(resolve(root, candidate));
      isDirectory = statSync(target).isDirectory();
    } catch {
      // Not there — or gone between the two calls, which is the same answer.
      return null;
    }

    if (target === root || !target.startsWith(root + sep)) {
      return null;
    }
    return isDirectory ? target : null;
  };

  /**
   * A recorded **Media folder** — relative to the root, as the library stores
   * it — as the filesystem spells it, or `null`: an absolute path is refused
   * before anything is resolved, as `mediaFilePath` refuses one, and the rest
   * is {@link containedFolder}'s rule. The one reading `openFolder`,
   * `storeNamed` and `removeTitleFolder` share.
   */
  const recordedFolder = (folder: string): string | null =>
    isAbsolute(folder) ? null : containedFolder(folder);

  /** A season's `season-NN/` under a Series folder, made if it is not there. */
  const seasonDir = (seriesFolder: string, season: number): string => {
    const folder = join(
      seriesFolder,
      `season-${String(season).padStart(2, '0')}`
    );
    mkdirSync(folder, { recursive: true });
    return folder;
  };

  return {
    reserveFolder: (title, year) => {
      // The dev default is `./media`, which does not exist until the first film
      // is added — and the first film added is exactly this call.
      mkdirSync(mediaPath, { recursive: true });

      const folder = freeFolder(title, year);
      mkdirSync(folder);
      return folder;
    },

    openFolder: (folder) => recordedFolder(folder),

    storedFolder: (storedPath) => {
      const [first] = storedPath.split('/');
      return first === '' ? null : recordedFolder(first);
    },

    seasonFolder: (seriesFolder, season) => seasonDir(seriesFolder, season),

    renameFolder: (folder, title, year) => {
      const wanted = movieFolder(title, year);
      const current = basename(folder);

      // Already named for this movie — including the `-2` a collision gave it,
      // which is this movie's name and not a stale one.
      if (current === wanted || new RegExp(`^${wanted}-\\d+$`).test(current)) {
        return { folder, storedPath: (previous) => previous };
      }

      const renamed = freeFolder(title, year);
      renameSync(folder, renamed);

      return {
        folder: renamed,
        // The folder is the first segment of every stored path under it, and
        // the only one that changed.
        storedPath: (previous) =>
          `${basename(renamed)}/${previous.slice(previous.indexOf('/') + 1)}`,
      };
    },

    storeUpload: async (folder, filename, source) => {
      const safe = safeFilename(filename);

      // The name is sanitised here rather than at the route, so every caller of
      // this domain — the form, and the bulk importer after it — gets the
      // guarantee without having to remember it.
      await pipeline(source, createWriteStream(join(folder, safe)));

      return storedIn(folder, safe);
    },

    storeNamed: async (recorded, name, source, season) => {
      const title = recordedFolder(recorded);
      if (title === null) {
        throw new Error(`No title folder at ${recorded}`);
      }
      const folder = season === undefined ? title : seasonDir(title, season);
      const safe = safeFilename(name);
      await pipeline(source, createWriteStream(join(folder, safe)));
      return storedIn(folder, safe);
    },

    readStored: async (storedPath) => {
      const file = mediaFilePath(mediaPath, storedPath);
      if (file === null) {
        throw new Error(`No stored file at ${storedPath}`);
      }
      return createReadStream(file);
    },

    copyIn: async (folder, sourcePath, signal) => {
      const safe = safeFilename(basename(sourcePath));
      const target = join(folder, safe);

      // A stream rather than `copyFile`, because a copy has to be stoppable:
      // a 12 GB film that cancel could only wait out is not cancelled. A copy
      // that did not finish — a source that is not there, or the signal —
      // takes its half-file with it, so nothing is left for a row to point at.
      try {
        await pipeline(
          createReadStream(sourcePath),
          createWriteStream(target),
          signal === undefined ? {} : { signal }
        );
      } catch (error) {
        rmSync(target, { force: true });
        throw error;
      }

      return storedIn(folder, safe);
    },

    removeFolder: (folder) => {
      // `null` is nothing to remove — a save that failed before the first part
      // arrived, a folder something else has already taken away, or one that
      // was never under the root. The `rmSync` itself is left to throw: this
      // is a rollback, before any row has committed.
      const target = containedFolder(folder);
      if (target === null) {
        return;
      }
      rmSync(target, { recursive: true, force: true });
    },

    removeFile: (storedPath) => {
      const file = mediaFilePath(mediaPath, storedPath);
      if (file === null) {
        return;
      }

      try {
        unlinkSync(file);
      } catch {
        // A file that will not delete — locked, or gone between the check and
        // the unlink. The edit that authorised this has already committed.
      }
    },

    removeTitleFolder: (recorded) => {
      const folder = recordedFolder(recorded);
      if (folder === null) {
        return;
      }

      try {
        rmSync(folder, { recursive: true, force: true });
      } catch {
        // A folder that will not go — a video the stream route still has open.
        // The row is already gone, and a stranded folder beats a ghost row.
      }
    },

    emptyRoot: () => {
      let entries: string[];
      try {
        entries = readdirSync(mediaPath);
      } catch {
        // No root, or none readable: nothing to empty.
        return;
      }

      for (const entry of entries) {
        try {
          // `rmSync` reads the entry with `lstat`, so a link or junction is
          // unlinked rather than followed into what it points at.
          rmSync(join(mediaPath, entry), { recursive: true, force: true });
        } catch {
          // An entry that will not go is left; the others still go.
        }
      }
    },
  };
}
