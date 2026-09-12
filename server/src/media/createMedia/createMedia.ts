import {
  createWriteStream,
  existsSync,
  mkdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
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
   * The **Movie folder** a **Stored path** already lives in, ready to be
   * written into — or `null` for a path that names nothing under the managed
   * media directory.
   *
   * What an *edit* uses instead of {@link reserveFolder}: a movie already has
   * somewhere its files live, and giving it a second folder because its title
   * was corrected would mean moving gigabytes to fix a spelling. The folder is
   * the movie's, not the title's, so the managed directory's names are allowed
   * to drift from the library's.
   *
   * It answers `null` for exactly what {@link mediaFilePath} answers `null` for
   * — a path that escaped the root, a file that is not there, a media directory
   * that does not exist — because it is that same check, asked one directory
   * up. A caller with nothing here has no folder to reuse and must reserve one.
   */
  openFolder(storedPath: string): string | null;

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
   * Remove the whole **Movie folder** a **Stored path** lives in — video,
   * poster, subtitles, and anything else that found its way in — whether or
   * not the named file is still there.
   *
   * The folder is the first segment of the path, named rather than found
   * through the file: {@link openFolder} answers nothing for a missing file,
   * which would leave a hand-deleted video's siblings on disk forever. What a
   * **Delete** runs *after* the row has gone, so like {@link removeFile} it is
   * **best-effort** and swallows its own failure — a locked video leaves a
   * **Stranded folder**, not a failed delete. A path that escapes the managed
   * media directory, or names a folder already gone, is nothing to do.
   */
  removeMovieFolder(storedPath: string): void;
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
   * `mediaFilePath`'s rule, asked of a folder rather than a file.
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

  return {
    reserveFolder: (title, year) => {
      // The dev default is `./media`, which does not exist until the first film
      // is added — and the first film added is exactly this call.
      mkdirSync(mediaPath, { recursive: true });

      const folder = freeFolder(title, year);
      mkdirSync(folder);
      return folder;
    },

    openFolder: (storedPath) => {
      // The containment rule is `mediaFilePath`'s own rather than a second
      // spelling of it: a stored path that escapes the media root names no
      // folder here either, whatever it says.
      const file = mediaFilePath(mediaPath, storedPath);
      return file === null ? null : dirname(file);
    },

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

    removeFolder: (folder) => {
      const root = realRoot();
      if (root === null) {
        return;
      }

      let target: string;
      try {
        target = realpathSync(resolve(folder));
      } catch {
        // Nothing there to remove — a save that failed before the first part
        // arrived, or a folder something else has already taken away.
        return;
      }

      if (target === root || !target.startsWith(root + sep)) {
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

    removeMovieFolder: (storedPath) => {
      // The folder is the first segment of every stored path under it. An
      // absolute path is refused before anything is resolved, as
      // `mediaFilePath` refuses it; a relative one that escapes the root, or
      // names the root itself, is refused on the resolved path.
      if (isAbsolute(storedPath)) {
        return;
      }
      const folder = containedFolder(storedPath.split('/')[0]);
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
  };
}
