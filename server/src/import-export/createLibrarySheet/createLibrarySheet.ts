import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { Movie, SeriesDetail } from '@/types';
import type { LibraryStorage } from '../../library';
import { readableFolder } from '../../media/readableFolder/readableFolder';
import { exportRows } from '../exportRows/exportRows';
import { writeSheet } from '../writeSheet/writeSheet';

/** The **Library sheet**'s path inside its Library folder. */
export const LIBRARY_SHEET = 'Meta/familyflix-library.csv';

/** How long after the last touch a folder's sheet is rewritten. */
export const LIBRARY_SHEET_DELAY_MS = 3000;

/** The temporary file a rewrite lands through, beside the sheet in `Meta/`. */
const TEMPORARY_SHEET = 'Meta/familyflix-library.csv.tmp';

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
}

/**
 * The **Library sheet writer**: touches debounced by
 * {@link LIBRARY_SHEET_DELAY_MS} after the last, then each touched folder's
 * {@link LIBRARY_SHEET} rewritten from the library, through a temporary file
 * in `Meta/` and a rename, behind its BOM. A folder no longer listed (a
 * **Factory reset**'s) or **Unreachable** is skipped; a later touch that
 * finds it reachable writes it. The one replacer inside a Library folder,
 * and only of that one file.
 */
export function createLibrarySheet({
  storage,
}: LibrarySheetDeps): LibrarySheet {
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing: Promise<void> = Promise.resolve();

  /** The titles recorded against a folder with a Source folder. */
  function contentOf(folderId: string): {
    movies: Movie[];
    series: SeriesDetail[];
  } {
    const titles = storage.libraryTitles();
    const recorded = <T extends { libraryFolderId: string | null }>(
      list: readonly (T & { sourceFolder: string | null })[]
    ) =>
      list.filter(
        (title) =>
          title.libraryFolderId === folderId && title.sourceFolder !== null
      );
    return {
      movies: recorded(titles.movies).flatMap(
        (movie) => storage.getMovie(movie.id) ?? []
      ),
      series: recorded(titles.series).flatMap(
        (series) => storage.getSeriesDetail(series.id) ?? []
      ),
    };
  }

  async function writeOne(folderId: string): Promise<void> {
    const folder = storage
      .libraryFolders()
      .find((listed) => listed.id === folderId);
    if (!folder || (await readableFolder(folder.path)) !== 'readable') {
      return;
    }
    const { movies, series } = contentOf(folderId);
    const { table } = exportRows(movies, series, {
      images: true,
      subtitles: true,
    });
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
    const folderIds = [...pending];
    pending.clear();
    writing = writing.then(async () => {
      for (const folderId of folderIds) {
        await writeOne(folderId).catch(() => undefined);
      }
    });
    return writing;
  }

  return {
    touch(folderIds) {
      for (const folderId of folderIds) {
        pending.add(folderId);
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void writePending();
      }, LIBRARY_SHEET_DELAY_MS);
    },
    flush() {
      clearTimeout(timer);
      timer = undefined;
      return writePending();
    },
  };
}
