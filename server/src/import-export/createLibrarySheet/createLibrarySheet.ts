import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { Movie, SeriesDetail } from '@/types';
import type { LibraryStorage } from '../../library';
import {
  LIBRARY_SHEET_STEM,
  META_FOLDER,
} from '../../media/folderLayout/folderLayout';
import { readableFolder } from '../../media/readableFolder/readableFolder';
import {
  readTitleFolder,
  type TitleFolderScan,
} from '../../media/readTitleFolder/readTitleFolder';
import { exportRows } from '../exportRows/exportRows';
import { layoutCells } from '../layoutCells/layoutCells';
import { writeSheet } from '../writeSheet/writeSheet';

/** The **Library sheet**'s path inside its Library folder. */
export const LIBRARY_SHEET = `${META_FOLDER}/${LIBRARY_SHEET_STEM}.csv`;

/** How long after the last touch a folder's sheet is rewritten. */
export const LIBRARY_SHEET_DELAY_MS = 3000;

/** The temporary file a rewrite lands through, beside the sheet in `Meta/`. */
const TEMPORARY_SHEET = `${LIBRARY_SHEET}.tmp`;

/**
 * What one Library folder's sheet is written from: the titles recorded
 * against it with a **Source folder**, and each one's Source folder by its id.
 */
interface FolderContent {
  movies: Movie[];
  series: SeriesDetail[];
  sourceFolders: Map<string, string>;
}

/** What the **Library sheet writer** reads the library through. */
export interface LibrarySheetDeps {
  storage: Pick<
    LibraryStorage,
    'libraryFolders' | 'libraryTitles' | 'getMovie' | 'getSeriesDetail'
  >;
}

/** The **Library sheet writer**. */
export interface LibrarySheet {
  /** Note the Library folders a write touched; their sheets follow later. */
  touch(folderIds: readonly string[]): void;
  /** Write every pending sheet now, settling once they are written. */
  flush(): Promise<void>;
  /** Write nothing to a folder while a run's review holds its sheet values. */
  hold(folderId: string): void;
  /** Stop holding a folder and rewrite its sheet from the library. */
  release(folderId: string): void;
}

/**
 * The **Library sheet writer**: touches debounced by
 * {@link LIBRARY_SHEET_DELAY_MS} after the last, then each touched folder's
 * {@link LIBRARY_SHEET} rewritten from the library under the **Sheet
 * columns** (`exportRows`, each title's **Folder key** its **Title folder**'s
 * own name, its path cells from each Title folder's **Layout read**,
 * `layoutCells`), through a temporary file in `Meta/` and a rename, behind its
 * BOM. A folder no longer listed (a **Factory reset**'s) or **Unreachable**
 * is skipped; a later touch that finds it reachable writes it. The one
 * replacer inside a Library folder, and only of that one file.
 */
export function createLibrarySheet({
  storage,
}: LibrarySheetDeps): LibrarySheet {
  const pending = new Set<string>();
  const held = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing: Promise<void> = Promise.resolve();

  /** The titles recorded against a folder, as its sheet is written. */
  function contentOf(folderId: string): FolderContent {
    const titles = storage.libraryTitles();
    const recorded = <
      T extends {
        id: string;
        libraryFolderId: string | null;
        sourceFolder: string | null;
      },
    >(
      list: readonly T[]
    ): (T & { sourceFolder: string })[] =>
      list.filter(
        (title): title is T & { sourceFolder: string } =>
          title.libraryFolderId === folderId && title.sourceFolder !== null
      );
    const sourceFolders = new Map<string, string>();
    for (const title of [
      ...recorded(titles.movies),
      ...recorded(titles.series),
    ]) {
      sourceFolders.set(title.id, title.sourceFolder);
    }
    return {
      sourceFolders,
      movies: recorded(titles.movies).flatMap(
        (movie) => storage.getMovie(movie.id) ?? []
      ),
      series: recorded(titles.series).flatMap(
        (series) => storage.getSeriesDetail(series.id) ?? []
      ),
    };
  }

  /**
   * The **Layout read** of each recorded **Title folder**, by its own name;
   * a folder that cannot be read has none, so its path cells are blank.
   */
  async function readFolders(
    root: string,
    sourceFolders: ReadonlyMap<string, string>
  ): Promise<Map<string, TitleFolderScan>> {
    const reads = new Map<string, TitleFolderScan>();
    for (const name of new Set(sourceFolders.values())) {
      try {
        reads.set(name, await readTitleFolder(join(root, name)));
      } catch {
        // An unreadable Title folder keeps every cell but its paths.
      }
    }
    return reads;
  }

  async function writeOne(folderId: string): Promise<void> {
    const folder = storage
      .libraryFolders()
      .find((listed) => listed.id === folderId);
    if (!folder || (await readableFolder(folder.path)) !== 'readable') {
      return;
    }
    const { movies, series, sourceFolders } = contentOf(folderId);
    const reads = await readFolders(folder.path, sourceFolders);
    const { table } = exportRows(
      movies,
      series,
      layoutCells(reads, folder.path),
      (titleId) => sourceFolders.get(titleId) ?? null
    );
    const bytes = await writeSheet(table, 'csv');
    const sheet = join(folder.path, LIBRARY_SHEET);
    const temporary = join(folder.path, TEMPORARY_SHEET);
    await mkdir(dirname(sheet), { recursive: true });
    try {
      await writeFile(temporary, bytes);
      await rename(temporary, sheet);
    } catch {
      // A sheet that cannot land now is written by the folder's next touch.
      await rm(temporary, { force: true });
    }
  }

  /** Take every pending folder and queue its write behind any in flight. */
  function writePending(): Promise<void> {
    const folderIds = [...pending].filter((folderId) => !held.has(folderId));
    for (const folderId of folderIds) {
      pending.delete(folderId);
    }
    writing = writing.then(async () => {
      for (const folderId of folderIds) {
        await writeOne(folderId).catch(() => undefined);
      }
    });
    return writing;
  }

  function touch(folderIds: readonly string[]): void {
    for (const folderId of folderIds) {
      pending.add(folderId);
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void writePending();
    }, LIBRARY_SHEET_DELAY_MS);
  }

  return {
    touch,
    flush() {
      clearTimeout(timer);
      timer = undefined;
      return writePending();
    },
    hold(folderId) {
      held.add(folderId);
    },
    release(folderId) {
      held.delete(folderId);
      touch([folderId]);
    },
  };
}
