import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';

import type { LibraryStorage } from '../../library';
import type { Media } from '../../media/createMedia/createMedia';
import type { MovieFolderScan } from '../../media/scanMovieFolder/scanMovieFolder';
import { walkLibraryRoot } from '../../media/walkLibraryRoot/walkLibraryRoot';
import type { Playback } from '../../playback/createPlayback/createPlayback';
import { matchRows, type Match } from '../matchRows/matchRows';
import { readSheet, type SheetRow } from '../readSheet/readSheet';
import type { ImportRun, NewMovie, NewSubtitle } from '@/types';

/** The two fields the **Setup step** has, and the one a refusal names. */
export type ImportField = 'sheet' | 'root';

/**
 * A start refused before any run exists, naming the field it refuses on — the
 * screen has two fields and draws the reason under one of them. The route
 * answers it as `400 { error, field }`.
 */
export class ImportStartError extends Error {
  constructor(
    readonly field: ImportField,
    message: string
  ) {
    super(message);
    this.name = 'ImportStartError';
  }
}

/**
 * A start refused because a **Current run** already exists. One run at a
 * time, in memory: the route answers it as `409`.
 */
export class ImportBusyError extends Error {
  constructor() {
    super('An import is already running.');
    this.name = 'ImportBusyError';
  }
}

/**
 * What the API layer can ask the import domain for. Injected into the router
 * as the fifth argument the way `playback` and `media` are, so the route layer
 * never learns there is a spreadsheet. In this slice: `start` and `current`.
 * Cancel, the re-attach and the **Problems** are the next slices'.
 */
export interface Importer {
  /**
   * Start the **Current run** over a sheet and a **Library root**, and answer
   * its first snapshot. Rejects with {@link ImportStartError} for a sheet that
   * does not exist, cannot be read, is neither `.xlsx` nor `.csv` or has no
   * title column, and for a root that does not exist or is not a directory —
   * before any run exists; with {@link ImportBusyError} while a run exists.
   */
  start(sheetPath: string, rootPath: string): Promise<ImportRun>;
  /** The **Current run**'s snapshot, or `null` when there is none. */
  current(): ImportRun | null;
}

/** The sheet formats the reader opens, by extension. */
const SHEET_EXTENSIONS = ['.xlsx', '.csv'];

/** The units the `runtime_minutes` column stores, and the film's own. */
const SECONDS_PER_MINUTE = 60;

/**
 * The **Runtime label**'s minutes for a film that has just been copied in, or
 * `null` when this machine cannot say. `duration` asks the **Playback
 * component**'s probe first and the container's own header second, so a
 * machine with no FFmpeg still measures an MP4. It never throws — a runtime is
 * the least of what the import was for.
 *
 * The same derivation `routes/derivedRuntime` makes for the form's save; it is
 * spelled here rather than imported because a domain must not reach into the
 * HTTP layer, and lifting the one helper into `playback/` is the refactor
 * step's, not this slice's.
 */
function runtimeMinutes(playback: Playback, storedPath: string): number | null {
  try {
    const file = playback.videoFile(storedPath);
    const seconds = file === null ? null : playback.duration(file);
    if (seconds === null) {
      return null;
    }
    const minutes = Math.round(seconds / SECONDS_PER_MINUTE);
    return minutes > 0 ? minutes : null;
  } catch {
    return null;
  }
}

/**
 * Check the sheet before any run exists: it has to be there, be a file, be
 * one of the two formats, and have a title column. Answers the rows, which
 * the run will need anyway, so the file is read once.
 */
async function checkSheet(sheetPath: string): Promise<SheetRow[]> {
  if (!SHEET_EXTENSIONS.includes(extname(sheetPath).toLowerCase())) {
    throw new ImportStartError(
      'sheet',
      'The spreadsheet must be an .xlsx or .csv file.'
    );
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(sheetPath);
  } catch (error) {
    const code = (error as { code?: string }).code;
    throw new ImportStartError(
      'sheet',
      code === 'ENOENT'
        ? 'That spreadsheet could not be found.'
        : 'That spreadsheet could not be read.'
    );
  }

  try {
    return await readSheet(bytes, sheetPath);
  } catch (error) {
    throw new ImportStartError(
      'sheet',
      error instanceof Error && error.message !== ''
        ? error.message
        : 'That spreadsheet could not be read.'
    );
  }
}

/** Check the root before any run exists: it has to be there and be a folder. */
async function checkRoot(rootPath: string): Promise<void> {
  let isDirectory: boolean;
  try {
    isDirectory = (await stat(rootPath)).isDirectory();
  } catch {
    throw new ImportStartError('root', 'That folder could not be found.');
  }
  if (!isDirectory) {
    throw new ImportStartError('root', 'That path is not a folder.');
  }
}

/**
 * Compose the import domain over the library, the media domain and playback.
 *
 * One run at a time, in memory — the **Current run**. `start` checks both
 * fields, creates the run and answers its first snapshot at once; the run
 * itself goes on in the background, scanning → importing → review, and
 * `current` answers where it has got to. The scan completes before the first
 * copy starts, so by the first byte copied `found` and `total` are already
 * the numbers review will show.
 *
 * Each match is imported by the **Movie form**'s own sequence: reserve the
 * **Movie folder**, copy in the video, the poster, the backdrop and each
 * subtitle, derive the runtime, `addMovie` with `tmdbId` null. A match whose
 * import throws has its folder taken back and is, in this slice, neither
 * imported nor shown — the `failed` **Problem** is the review slice's. The
 * originals under the root are never written to.
 */
export function createImporter({
  storage,
  media,
  playback,
}: {
  storage: LibraryStorage;
  media: Media;
  playback: Playback;
}): Importer {
  let run: ImportRun | null = null;

  /** A copy of the run, so a caller can never reach into the live one. */
  const snapshot = (): ImportRun | null =>
    run === null
      ? null
      : { ...run, log: [...run.log], problems: [...run.problems] };

  /**
   * The genres a row names that the **Genre pool** knows, in the pool's own
   * spelling; a genre it does not know is dropped and the row still imports.
   */
  const knownGenres = (names: string[], pool: Map<string, string>): string[] =>
    names.flatMap((name) => {
      const known = pool.get(name.toLowerCase());
      return known === undefined ? [] : [known];
    });

  const importMatch = async (
    { row, folder: scan }: Match,
    pool: Map<string, string>
  ): Promise<void> => {
    const folder = media.reserveFolder(row.title, row.year);
    try {
      const videoPath = await media.copyIn(folder, scan.videos[0]);
      const posterPath =
        scan.poster === null
          ? undefined
          : await media.copyIn(folder, scan.poster);
      const backdropPath =
        scan.backdrop === null
          ? undefined
          : await media.copyIn(folder, scan.backdrop);
      const subtitles: NewSubtitle[] = [];
      for (const track of scan.subtitles) {
        subtitles.push({
          path: await media.copyIn(folder, track.path),
          language: track.language,
        });
      }
      const runtime = runtimeMinutes(playback, videoPath);
      const genres = knownGenres(row.genres, pool);

      const movie: NewMovie = {
        title: row.title,
        videoPath,
        watched: row.watched,
        ...(row.year === null ? {} : { year: row.year }),
        ...(runtime === null ? {} : { runtimeMinutes: runtime }),
        ...(row.director === null ? {} : { director: row.director }),
        ...(row.synopsis === null ? {} : { synopsis: row.synopsis }),
        ...(row.rating === null ? {} : { rating: row.rating }),
        ...(row.cast.length === 0 ? {} : { cast: row.cast }),
        ...(genres.length === 0 ? {} : { genres }),
        ...(posterPath === undefined ? {} : { posterPath }),
        ...(backdropPath === undefined ? {} : { backdropPath }),
        ...(subtitles.length === 0 ? {} : { subtitles }),
      };
      storage.addMovie(movie);
    } catch {
      // A match that could not be imported leaves no folder behind. Filing it
      // as a `failed` **Problem** is the review slice's; here the run goes on
      // to the next match.
      media.removeFolder(folder);
    }
  };

  const execute = async (
    current: ImportRun,
    rows: SheetRow[],
    rootPath: string
  ): Promise<void> => {
    const pool = new Map(
      storage
        .listGenrePool()
        .map((genre) => [genre.name.toLowerCase(), genre.name])
    );

    let scans: MovieFolderScan[] = [];
    try {
      scans = await walkLibraryRoot(rootPath, (scan) => {
        current.found += 1;
        current.currentItem = scan.dir;
      });
    } catch {
      // A root that stopped being readable mid-walk: what was found is what
      // there is, and the run still reaches review rather than hanging.
    }

    const { matched } = matchRows(rows, scans);
    current.matched = matched.length;
    current.total = matched.length;
    current.phase = 'importing';

    for (const match of matched) {
      current.currentItem = match.folder.dir;
      await importMatch(match, pool);
      current.done += 1;
    }

    current.currentItem = '';
    current.phase = 'review';
  };

  return {
    start: async (sheetPath, rootPath) => {
      if (run !== null) {
        throw new ImportBusyError();
      }

      const rows = await checkSheet(sheetPath);
      await checkRoot(rootPath);

      // Checked again: two starts could have been racing through the checks
      // above, and only one of them gets to be the run.
      if (run !== null) {
        throw new ImportBusyError();
      }

      const current: ImportRun = {
        id: randomUUID(),
        phase: 'scanning',
        startedAt: new Date().toISOString(),
        found: 0,
        total: 0,
        done: 0,
        matched: 0,
        currentItem: '',
        log: [],
        problems: [],
      };
      run = current;

      // Not awaited: the run goes on in the background, and `current` answers
      // where it has got to. Nothing in `execute` throws past its own catches.
      void execute(current, rows, rootPath);

      return snapshot() as ImportRun;
    },

    current: snapshot,
  };
}
