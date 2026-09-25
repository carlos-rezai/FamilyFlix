import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative } from 'node:path';

import type { LibraryStorage } from '../../library';
import type { Media } from '../../media/createMedia/createMedia';
import type { MovieFolderScan } from '../../media/scanMovieFolder/scanMovieFolder';
import { walkLibraryRoot } from '../../media/walkLibraryRoot/walkLibraryRoot';
import type { Playback } from '../../playback/createPlayback/createPlayback';
import { episodeTag, spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import { derivedRuntime } from '../../playback/derivedRuntime/derivedRuntime';
import {
  groupShows,
  type ShowEpisode,
  type ShowScan,
} from '../groupShows/groupShows';
import { matchRows, type Match } from '../matchRows/matchRows';
import { readSheet, type SheetRow } from '../readSheet/readSheet';
import { titleGuess, titleKey, yearInName } from '../titleKey/titleKey';
import type {
  Episode,
  ImportField,
  ImportProblem,
  ImportProblemDetail,
  ImportRun,
  LogKind,
  Movie,
  NewMovie,
  NewSeries,
  NewSubtitle,
  ProblemKind,
  Series,
} from '@/types';

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
 * A **Found file** named outside the **Current run**'s root — or the root
 * itself, or a path climbing out of it through `..`. Refused before anything
 * is copied: the resolve route is the one surface in the app that accepts a
 * path, and the root is the whole of what it may be pointed at. The route
 * answers it as `400`.
 */
export class ImportPathError extends Error {
  constructor(readonly path: string) {
    super('That file is not under the import folder.');
    this.name = 'ImportPathError';
  }
}

/**
 * A **Problem** that is not there — one already dismissed, one that never was,
 * or no run at all. The route answers it as `404`.
 */
export class ProblemNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`No such problem: ${id}`);
    this.name = 'ProblemNotFoundError';
  }
}

/**
 * One of the form's **File slots** as _Save & continue_ sends it back: a
 * **Found file** — the absolute path the scan found it at, under the root —
 * or a file the route has already stored from bytes, as its **Stored path**.
 */
export type ResolveFile = { found: string } | { stored: string };

/**
 * The **Movie form** as _Save & continue_ sends it: the fields as the maintainer
 * left them — not the sheet's, which only prefilled them — with every filled
 * slot a {@link ResolveFile}. The film is not optional: the form's own gate is
 * a title and a film, and the route refuses a body with neither before this
 * is built.
 */
export interface ResolveForm {
  title: string;
  year: number | null;
  director: string | null;
  synopsis: string | null;
  rating: number | null;
  cast: string[];
  genres: string[];
  video: ResolveFile;
  poster: ResolveFile | null;
  subtitles: { file: ResolveFile; language: string }[];
}

/**
 * What the API layer can ask the import domain for. Injected into the router
 * as the fifth argument the way `playback` and `media` are, so the route layer
 * never learns there is a spreadsheet. `start`, `current`, `cancel`,
 * `problem`, `resolve` and `dismiss`.
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
  /**
   * Discard the **Current run**: abort the copy in flight, roll that one
   * **Movie folder** back, keep every movie already added. `current` answers
   * `null` from the call on; the promise resolves once the run has stopped
   * and the folder is gone, so a start after it never races a rollback.
   * Nothing to do when there is no run.
   */
  cancel(): Promise<void>;
  /**
   * **Dismiss** a **Problem** — the **Review step**'s _Skip_: gone from the
   * snapshot, nothing imported for it, and `true` for having gone. `false`
   * for an id that is not there — one already dismissed, one that never was
   * — and when there is no run; the route turns that into its `404`.
   */
  dismiss(id: string): boolean;
  /**
   * The **Problem detail** _Resolve_ prefills the form from: the problem, the
   * **Sheet row**, the **Source folder** it is about, the candidate folders
   * and the folder's **Found files** as absolute paths under the root. `null`
   * for an id that is not there, and when there is no run.
   */
  problem(id: string): ImportProblemDetail | null;
  /**
   * _Save & continue_: copy every **Found file** the form names in from under
   * the root, take a file the route already stored as it is, add the movie by
   * the form's own sequence and dismiss the problem. Rejects with
   * {@link ImportPathError} for a found path outside the root — before
   * anything is copied — and with {@link ProblemNotFoundError} for a problem
   * that is not there; a copy that fails leaves no folder behind and keeps the
   * problem.
   */
  resolve(id: string, form: ResolveForm): Promise<Movie>;
}

/** The sheet formats the reader opens, by extension. */
const SHEET_EXTENSIONS = ['.xlsx', '.csv'];

/**
 * How many **Log lines** a snapshot carries, newest kept: a thousand-film run
 * would put a thousand scanning lines on every poll otherwise.
 */
const LOG_CAP = 80;

/** The reason strings the run fixes for the kinds the matcher does not give. */
const REASON = {
  noRow: "Folder isn't in the spreadsheet.",
  missingMeta:
    "Imported, but the row has no genre — it won't appear in any genre row.",
} as const;

/** A **Problem** as the snapshot lists it, under an id of its own. */
const problemOf = (
  kind: ProblemKind,
  title: string,
  reason: string,
  movieId?: string
): ImportProblem => ({
  id: randomUUID(),
  kind,
  title,
  reason,
  ...(movieId === undefined ? {} : { movieId }),
});

/**
 * What the run knew when it filed a **Problem**, kept beside the snapshot for
 * the **Problem detail**: the **Sheet row**, if the problem is a row's; the
 * **Source folder** it is about — a `no-video`'s, a `failed`'s, a `no-row`'s,
 * an `ambiguous`'s first, none for a `no-folder`; and, for an `ambiguous`
 * alone, every folder it was weighing. Never on the snapshot itself: a
 * thousand scans on every poll would be the wire cost of a detail one form
 * reads once.
 */
interface ProblemSource {
  row: SheetRow | null;
  folder: MovieFolderScan | null;
  candidates: MovieFolderScan[];
}

/** A **Sheet row** as the detail carries it: the columns it has, and no nulls. */
const rowDetail = (row: SheetRow): ImportProblemDetail['row'] => ({
  title: row.title,
  genres: row.genres,
  ...(row.year === null ? {} : { year: row.year }),
  ...(row.director === null ? {} : { director: row.director }),
  ...(row.cast.length === 0 ? {} : { cast: row.cast }),
  ...(row.synopsis === null ? {} : { synopsis: row.synopsis }),
  ...(row.rating === null ? {} : { rating: row.rating }),
});

/**
 * The **Found files** of one **Source folder**, as the form's slots take them.
 * The video only when the folder holds exactly one: two is the `no-video`
 * verdict, and the detail guesses no more than the run did — the maintainer
 * picks.
 */
const filesOf = (scan: MovieFolderScan): ImportProblemDetail['files'] => ({
  ...(scan.videos.length === 1 ? { video: scan.videos[0] } : {}),
  ...(scan.poster === null ? {} : { poster: scan.poster }),
  ...(scan.backdrop === null ? {} : { backdrop: scan.backdrop }),
  subtitles: scan.subtitles.map(({ path, language }) => ({ path, language })),
});

/** A count as the prototype prints it: `1,234`. */
const count = (n: number): string => n.toLocaleString('en-US');

/** What the sheet check answers: the rows, and the rows it left out for a blank title. */
interface SheetRead {
  rows: SheetRow[];
  /** The sheet's own row numbers, so the line can name what to look at. */
  blankTitleRows: number[];
}

/**
 * Check the sheet before any run exists: it has to be there, be a file, be
 * one of the two formats, and have a title column. Answers the rows, which
 * the run will need anyway, so the file is read once — and the rows skipped
 * for a blank title, which the run logs once it exists.
 */
async function checkSheet(sheetPath: string): Promise<SheetRead> {
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

  const blankTitleRows: number[] = [];
  try {
    const rows = await readSheet(bytes, sheetPath, (rowNumber) =>
      blankTitleRows.push(rowNumber)
    );
    return { rows, blankTitleRows };
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
 * What joins the two halves of a {@link filmKey}: NUL, because a title key
 * holds letters, digits and single spaces and a year holds digits, so nothing
 * in either half can collide with it. Spelled as the escape rather than typed
 * as the byte, so the source stays text to `grep` and to any editor that
 * folds control characters.
 */
const KEY_SEPARATOR = '\0';

/**
 * What tells a film already in the library apart from a row: its **Title
 * key** and its year, together. The same film under another spelling is the
 * same film; a key-equal film from another year is a remake, and imports.
 */
const filmKey = (title: string, year: number | null): string =>
  [titleKey(title), String(year ?? '')].join(KEY_SEPARATOR);

/** A title as the log names it: with its year when the row has one. */
const titleWithYear = (title: string, year: number | null): string =>
  year === null ? title : `${title} (${year})`;

/** An episode as the console names it: `Harbor & Vine · S01E03`. */
const episodeLabel = (title: string, { season, episode }: ShowEpisode) =>
  `${title} · ${spellEpisodeTag(season, episode)}`;

/**
 * The reason an **Unplaced** video is filed with, naming the fix: the number
 * to rename it to — the next free one in the season its tag names, or in the
 * show's first season when it carries none — and to import again.
 */
function unplacedReason(show: ShowScan, video: string): string {
  const tag = episodeTag(basename(video));
  const season = tag?.season ?? show.episodes[0]?.season ?? 1;
  const last = Math.max(
    0,
    ...show.episodes
      .filter((episode) => episode.season === season)
      .map((episode) => episode.episode)
  );
  const fix = `rename it ${spellEpisodeTag(season, last + 1)} and import again.`;
  return tag === null
    ? `No episode number — ${fix}`
    : `${spellEpisodeTag(tag.season, tag.episode)} is already another file — ${fix}`;
}

/**
 * A **Show folder** as the matcher weighs it: a scan under the show's own
 * name and folder, holding its first episode — or its first **Unplaced**
 * video, so a show whose every video is unplaced still matches its row and
 * files only those — so the **Match rule** a film is held to is the one a
 * show is held to.
 */
const asMatchable = (show: ShowScan): MovieFolderScan => ({
  dir: show.dir,
  name: show.name,
  videos: [
    ...show.episodes.map((episode) => episode.video),
    ...show.unplaced,
  ].slice(0, 1),
  poster: null,
  backdrop: null,
  subtitles: [],
});

/**
 * A matched show: the row that named it, and the show — and, when the show is
 * **Already in library**, the series it joins. `episodes` are the ones this
 * run imports: every numbered episode, less those the held series has.
 */
interface ShowMatch {
  row: SheetRow;
  show: ShowScan;
  held: HeldSeries | null;
  episodes: ShowEpisode[];
}

/**
 * A series the library already holds, as a run needs it: the series, the
 * `(season, episode)` tags it has, and the **Series folder** they live in —
 * or `null` when none of them names one.
 */
interface HeldSeries {
  series: Series;
  tags: Set<string>;
  folder: string | null;
}

/**
 * The row a show no row names imports under: its title guessed from the Show
 * folder's name, its year the one the name carries, and nothing else.
 */
const guessedRow = (show: ShowScan): SheetRow => ({
  title: titleGuess(show.name),
  year: yearInName(show.name),
  endYear: null,
  genres: [],
  director: null,
  cast: [],
  synopsis: null,
  rating: null,
  watched: false,
});

/**
 * Whether `path` lies strictly under `root` — not the root itself, not a path
 * climbing out of it through `..`, and not one on another drive, which
 * `relative` answers with an absolute path rather than a climb.
 */
const isUnder = (root: string, path: string): boolean => {
  const under = relative(root, path);
  return under !== '' && !under.startsWith('..') && !isAbsolute(under);
};

/**
 * How many folders the scan went through: every **Source folder** and every
 * shelf between it and the root — `Drama/` counts, the root does not.
 */
function foldersUnder(root: string, scans: MovieFolderScan[]): number {
  const folders = new Set<string>();
  for (const scan of scans) {
    for (let dir = scan.dir; isUnder(root, dir); dir = dirname(dir)) {
      folders.add(dir);
    }
  }
  return folders.size;
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
 * The library's titles are read once when the run starts — a thousand-row
 * sheet is a thousand lookups otherwise — and a row already there, by key and
 * year, is neither a **Match** nor a **Problem**: the **Already in library**
 * skip, which is what makes cancel-then-restart harmless.
 *
 * Each match is imported by the **Movie form**'s own sequence: reserve the
 * **Movie folder**, copy in the video, the poster, the backdrop and each
 * subtitle, derive the runtime, `addMovie` with `tmdbId` null. A match whose
 * import throws has its folder taken back and is filed as `failed`; one whose
 * row leaves it in no genre imports and is filed as the soft `missing-meta`.
 * The originals under the root are never written to.
 *
 * **Problems are data.** The rows the matcher could not settle and the
 * folders no row claimed are on the snapshot before the first copy starts,
 * `failed` and `missing-meta` as the loop reaches them, and the complete line
 * counts them all. `dismiss` takes one off — the **Review step**'s _Skip_.
 * What the run knew when it filed each one — the row, the folders — is kept
 * beside the snapshot for `problem`, the **Problem detail** _Resolve_ opens
 * the form on; `resolve` is that form's _Save & continue_, copying **Found
 * files** in from under the root and nowhere else.
 *
 * `cancel` aborts the copy in flight through the signal every copy is handed,
 * which makes the match it was in a match that failed: the folder goes the
 * way a failed one does, and the loop stops there instead of going on.
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
  /** The **Library root** of the run, and the only place a found file may be. */
  let root: string | null = null;
  /** What the run knew when it filed each **Problem**, by the problem's id. */
  const sources = new Map<string, ProblemSource>();
  /** The cancel of the run that is going, and the run itself, to be awaited. */
  let stop: AbortController = new AbortController();
  let running: Promise<void> = Promise.resolve();

  /** A copy of the run, so a caller can never reach into the live one. */
  const snapshot = (): ImportRun | null =>
    run === null
      ? null
      : { ...run, log: [...run.log], problems: [...run.problems] };

  /** File one **Problem** on a run, and keep what the run knew beside it. */
  const file = (
    current: ImportRun,
    problem: ImportProblem,
    source: ProblemSource
  ): void => {
    current.problems.push(problem);
    sources.set(problem.id, source);
  };

  /**
   * Take one **Problem** off the run — `dismiss`, and the last step of
   * `resolve`. `false` for one that is not there.
   */
  const takeOff = (id: string): boolean => {
    if (run === null) {
      return false;
    }
    const at = run.problems.findIndex((problem) => problem.id === id);
    if (at === -1) {
      return false;
    }
    run.problems.splice(at, 1);
    sources.delete(id);
    return true;
  };

  /** Write one **Log line** onto a run, dropping the oldest past the cap. */
  const log = (current: ImportRun, text: string, kind: LogKind): void => {
    current.log.push({ text, kind });
    if (current.log.length > LOG_CAP) {
      current.log.splice(0, current.log.length - LOG_CAP);
    }
  };

  /**
   * The genres a row names that the **Genre pool** knows, in the pool's own
   * spelling; a genre it does not know is dropped and the row still imports,
   * with one **Warning line** per unknown name across the run — the same
   * misspelling on every row is one thing to fix, not a thousand lines.
   */
  const knownGenres = (
    names: string[],
    pool: Map<string, string>,
    warned: Set<string>,
    current: ImportRun
  ): string[] =>
    names.flatMap((name) => {
      const known = pool.get(name.toLowerCase());
      if (known !== undefined) {
        return [known];
      }
      if (!warned.has(name.toLowerCase())) {
        warned.add(name.toLowerCase());
        log(current, `⚠ Unknown genre "${name}" — dropped`, 'warning');
      }
      return [];
    });

  /**
   * Import one match by the form's own sequence. Answers the movie added, or
   * `null` when the import threw — a locked or vanishing file, a cancel — with
   * the folder taken back and, unless the run was cancelled, `failed` filed
   * with the OS's reason. The run goes on to the next match either way.
   */
  const importMatch = async (
    { row, folder: scan }: Match,
    pool: Map<string, string>,
    warnedGenres: Set<string>,
    current: ImportRun,
    signal: AbortSignal
  ): Promise<Movie | null> => {
    const folder = media.reserveFolder(row.title, row.year);
    try {
      const videoPath = await media.copyIn(folder, scan.videos[0], signal);
      const posterPath =
        scan.poster === null
          ? undefined
          : await media.copyIn(folder, scan.poster, signal);
      const backdropPath =
        scan.backdrop === null
          ? undefined
          : await media.copyIn(folder, scan.backdrop, signal);
      const subtitles: NewSubtitle[] = [];
      for (const track of scan.subtitles) {
        subtitles.push({
          path: await media.copyIn(folder, track.path, signal),
          language: track.language,
        });
      }
      // A cancel that landed between the last copy and the row: the folder
      // goes, the row is never written, and nothing half-done is left.
      signal.throwIfAborted();
      const runtime = derivedRuntime(playback, videoPath);
      const genres = knownGenres(row.genres, pool, warnedGenres, current);

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
      const added = storage.addMovie(movie);
      if (genres.length === 0) {
        // Imported — nothing about the film is missing — and then listed,
        // because a film in no genre row is a film the family will not find.
        file(
          current,
          problemOf('missing-meta', row.title, REASON.missingMeta, added.id),
          { row, folder: scan, candidates: [] }
        );
      }
      return added;
    } catch (error) {
      // A match that could not be imported leaves no folder behind, and the
      // run goes on to the next match. A cancel is not a failure: the run is
      // being discarded, so there is nothing to file it on.
      media.removeFolder(folder);
      if (!signal.aborted) {
        const reason = error instanceof Error ? error.message : String(error);
        file(
          current,
          problemOf(
            'failed',
            row.title,
            `Couldn't copy the video file: ${reason}.`
          ),
          { row, folder: scan, candidates: [] }
        );
      }
      return null;
    }
  };

  /**
   * Import one matched show as a **Series**: one **Series folder** reserved
   * from the row's title and year, every episode copied under its
   * `season-NN/`, its runtime derived after the copy. Each episode is one item
   * on the bar — the current item and its `success` line read `Show · SnnEnn`
   * — and is written as it lands, so a cancel keeps the episodes already
   * copied, as it keeps the films. The series is written with its first
   * episode, from the row: title, year, genres, synopsis, rating and cast,
   * its _Director_ the creator; its _Status_ is not applied. An episode whose
   * copy fails is filed as `failed` and the show goes on; a show that ends
   * with no episode leaves no folder behind, and one with none to import
   * reserves none. Each episode's subtitles are copied in beside its video;
   * a subtitle that begins with no episode's stem is a **Warning line**.
   *
   * A show **Already in library** joins the series it matched: only its
   * `episodes` — those with no held `(season, episode)` — are copied, into
   * the Series folder the held episodes already live in, and the held
   * metadata is left as it is. One with nothing new says so and adds nothing.
   */
  const importShow = async (
    { row, show, held, episodes }: ShowMatch,
    pool: Map<string, string>,
    warnedGenres: Set<string>,
    current: ImportRun,
    signal: AbortSignal
  ): Promise<void> => {
    for (const stray of show.straySubtitles) {
      log(
        current,
        `⚠ ${row.title} — ${basename(stray)} matches no episode — skipped`,
        'warning'
      );
    }
    if (episodes.length === 0) {
      if (held !== null) {
        log(
          current,
          `– Already in library ${titleWithYear(row.title, row.year)}`,
          'info'
        );
      }
      return;
    }
    const folder = held?.folder ?? media.reserveFolder(row.title, row.year);
    let series: Series | null = held?.series ?? null;

    for (const episode of episodes) {
      const label = episodeLabel(row.title, episode);
      current.currentItem = label;
      try {
        const into = media.seasonFolder(folder, episode.season);
        const videoPath = await media.copyIn(into, episode.video, signal);
        const subtitles: NewSubtitle[] = [];
        for (const track of episode.subtitles) {
          subtitles.push({
            path: await media.copyIn(into, track.path, signal),
            language: track.language,
          });
        }
        signal.throwIfAborted();
        const runtime = derivedRuntime(playback, videoPath);

        if (series === null) {
          const genres = knownGenres(row.genres, pool, warnedGenres, current);
          const input: NewSeries = {
            title: row.title,
            ...(row.year === null ? {} : { year: row.year }),
            ...(row.endYear === null ? {} : { endYear: row.endYear }),
            ...(row.director === null ? {} : { creator: row.director }),
            ...(row.synopsis === null ? {} : { synopsis: row.synopsis }),
            ...(row.rating === null ? {} : { rating: row.rating }),
            ...(row.cast.length === 0 ? {} : { cast: row.cast }),
            ...(genres.length === 0 ? {} : { genres }),
          };
          series = storage.addSeries(input);
        }
        storage.addEpisode(series.id, {
          season: episode.season,
          number: episode.episode,
          videoPath,
          ...(episode.title === null ? {} : { title: episode.title }),
          ...(runtime === null ? {} : { runtimeMinutes: runtime }),
          ...(subtitles.length === 0 ? {} : { subtitles }),
        });
        log(current, `✓ Imported   ${label}`, 'success');
      } catch (error) {
        if (signal.aborted) {
          break;
        }
        const reason = error instanceof Error ? error.message : String(error);
        file(
          current,
          problemOf(
            'failed',
            label,
            `Couldn't copy the video file: ${reason}.`
          ),
          { row, folder: asMatchable(show), candidates: [] }
        );
      }
      if (signal.aborted) {
        break;
      }
      current.done += 1;
    }

    if (series === null) {
      media.removeFolder(folder);
    }
  };

  /**
   * The two **Warning lines** that never block: subtitles and posters are
   * optional on the form this run shares its save with, so their absence is
   * noted under the imported line rather than held against the match.
   */
  const warnOfMissingFiles = (current: ImportRun, { row, folder }: Match) => {
    if (folder.subtitles.length === 0) {
      log(current, `⚠ ${row.title} — no subtitle track found`, 'warning');
    }
    if (folder.poster === null) {
      log(current, `⚠ ${row.title} — no poster found`, 'warning');
    }
  };

  /**
   * The **Series folder** a held series' episodes live in — one up from an
   * episode's season folder — or `null` when none of them names one.
   */
  const heldFolder = (episodes: Episode[]): string | null => {
    for (const episode of episodes) {
      const season = media.openFolder(episode.videoPath);
      if (season !== null) {
        return dirname(season);
      }
    }
    return null;
  };

  /**
   * A show as this run imports it: joined to the held series of its key and
   * year, if there is one, with only the episodes that series lacks.
   */
  const showMatch = (
    row: SheetRow,
    show: ShowScan,
    heldSeries: Map<string, HeldSeries>
  ): ShowMatch => {
    const held = heldSeries.get(filmKey(row.title, row.year)) ?? null;
    return {
      row,
      show,
      held,
      episodes:
        held === null
          ? show.episodes
          : show.episodes.filter(
              (episode) =>
                !held.tags.has(spellEpisodeTag(episode.season, episode.episode))
            ),
    };
  };

  /**
   * Every series the library holds, by key and year, with its episodes' tags
   * and folder — read once per run, before its first `await`, as `inLibrary`
   * is: a storage read after the walk would sit outside every catch.
   */
  const seriesInLibrary = (): Map<string, HeldSeries> =>
    new Map(
      storage.getSeriesHome().series.map((series) => {
        const episodes = storage.listEpisodes(series.id);
        return [
          filmKey(series.title, series.year),
          {
            series,
            tags: new Set(
              episodes.map((episode) =>
                spellEpisodeTag(episode.season, episode.number)
              )
            ),
            folder: heldFolder(episodes),
          },
        ];
      })
    );

  /** Every film the library holds, by key and year — read once per run. */
  const inLibrary = (): Set<string> =>
    new Set(
      storage
        .listMovies({ sort: 'a-z' })
        .map((movie: Movie) => filmKey(movie.title, movie.year))
    );

  const execute = async (
    current: ImportRun,
    { rows, blankTitleRows }: SheetRead,
    rootPath: string,
    signal: AbortSignal
  ): Promise<void> => {
    const pool = new Map(
      storage
        .listGenrePool()
        .map((genre) => [genre.name.toLowerCase(), genre.name])
    );
    const already = inLibrary();
    const heldSeries = seriesInLibrary();
    const warnedGenres = new Set<string>();

    log(current, `Connecting to ${rootPath} …`, 'info');
    for (const rowNumber of blankTitleRows) {
      log(current, `⚠ Row ${rowNumber} has no title — skipped`, 'warning');
    }

    let scans: MovieFolderScan[] = [];
    try {
      scans = await walkLibraryRoot(
        rootPath,
        (scan) => {
          current.found += 1;
          current.currentItem = scan.dir;
          log(current, `Scanning   ${scan.dir}`, 'scan');
        },
        (dir) => {
          log(current, `⚠ Could not read ${dir} — skipped`, 'warning');
        }
      );
    } catch {
      // A root that stopped being readable mid-walk: what was found is what
      // there is, and the run still reaches review rather than hanging.
    }
    if (signal.aborted) {
      return;
    }
    log(
      current,
      `✓ Found ${count(scans.length)} movies across ${count(foldersUnder(rootPath, scans))} folders. Starting import…`,
      'success'
    );

    // Season folders gather under their Show folder; every other scan is a
    // film, exactly as it came. A show is matched by the film's own rule, over
    // a scan standing for it — and told apart again once matched.
    const { shows, films } = groupShows(scans);
    const showOf = new Map<MovieFolderScan, ShowScan>(
      shows.map((show) => [asMatchable(show), show])
    );

    const verdicts = matchRows(rows, [...films, ...showOf.keys()]);
    const matched: Match[] = [];
    const matchedShows: ShowMatch[] = [];
    for (const match of verdicts.matched) {
      const show = showOf.get(match.folder);
      if (show !== undefined) {
        matchedShows.push(showMatch(match.row, show, heldSeries));
      } else if (already.has(filmKey(match.row.title, match.row.year))) {
        log(
          current,
          `– Already in library ${titleWithYear(match.row.title, match.row.year)}`,
          'info'
        );
      } else {
        matched.push(match);
      }
    }
    // Every match-time problem is on the snapshot before the first byte is
    // copied: the rows the matcher could not settle — a row already in the
    // library is neither a match nor a problem — and then the folders no row
    // claimed.
    for (const { kind, reason, row, candidates } of verdicts.problems) {
      if (!already.has(filmKey(row.title, row.year))) {
        // The first folder weighed is the one the detail is about — the one
        // an `ambiguous` prefills from, the one a `no-video` matched — and
        // only an `ambiguous` has others to name.
        file(current, problemOf(kind, row.title, reason), {
          row,
          folder: candidates[0] ?? null,
          candidates: kind === 'ambiguous' ? candidates : [],
        });
      }
    }
    // A matched show's **Unplaced** videos: hard, and Skip alone — there is
    // no form an episode is resolved in; the reason names the rename.
    const fileUnplaced = ({ row, show }: ShowMatch) => {
      for (const video of show.unplaced) {
        file(
          current,
          problemOf(
            'unplaced',
            `${row.title} · ${basename(video)}`,
            unplacedReason(show, video)
          ),
          { row, folder: asMatchable(show), candidates: [] }
        );
      }
    };
    matchedShows.forEach(fileUnplaced);
    for (const folder of verdicts.unclaimed) {
      // A show no row names imports anyway, under the title its folder
      // suggests: a `no-row` Problem would open a form that cannot take a
      // series.
      const show = showOf.get(folder);
      if (show !== undefined) {
        const row = guessedRow(show);
        log(
          current,
          `⚠ ${titleWithYear(row.title, row.year)} — not in the spreadsheet, imported under its folder’s name`,
          'warning'
        );
        const unnamed = showMatch(row, show, heldSeries);
        fileUnplaced(unnamed);
        matchedShows.push(unnamed);
        continue;
      }
      file(current, problemOf('no-row', folder.name, REASON.noRow), {
        row: null,
        folder,
        candidates: [],
      });
    }
    current.matched = matched.length + matchedShows.length;
    // Each episode is one item on the bar, as each film is.
    current.total =
      matched.length +
      matchedShows.reduce((sum, { episodes }) => sum + episodes.length, 0);
    current.phase = 'importing';

    let imported = 0;
    for (const match of matched) {
      current.currentItem = match.row.title;
      const added = await importMatch(
        match,
        pool,
        warnedGenres,
        current,
        signal
      );
      if (signal.aborted) {
        return;
      }
      if (added !== null) {
        imported += 1;
        log(current, `✓ Imported   ${match.row.title}`, 'success');
        warnOfMissingFiles(current, match);
      }
      current.done += 1;
    }

    for (const match of matchedShows) {
      await importShow(match, pool, warnedGenres, current, signal);
      if (signal.aborted) {
        return;
      }
    }

    current.currentItem = '';
    log(
      current,
      `✓ Import complete — ${count(imported)} imported, ${count(current.problems.length)} need attention.`,
      'success'
    );
    current.phase = 'review';
  };

  return {
    start: async (sheetPath, rootPath) => {
      if (run !== null) {
        throw new ImportBusyError();
      }

      const sheet = await checkSheet(sheetPath);
      await checkRoot(rootPath);
      // A run just cancelled may still be rolling its folder back; the new
      // one waits for that rather than reserving beside it.
      await running;

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
      root = rootPath;
      sources.clear();
      stop = new AbortController();

      // Not awaited: the run goes on in the background, and `current` answers
      // where it has got to. Nothing in `execute` throws past its own catches.
      running = execute(current, sheet, rootPath, stop.signal);

      return snapshot() as ImportRun;
    },

    current: snapshot,

    cancel: async () => {
      // Gone from the first line: a `current` read while the rollback is
      // still going must not show a run that is being discarded.
      run = null;
      stop.abort();
      await running;
    },

    dismiss: takeOff,

    problem: (id) => {
      const listed = run?.problems.find((problem) => problem.id === id);
      const source = sources.get(id);
      if (listed === undefined || source === undefined) {
        return null;
      }
      const { folder } = source;
      return {
        ...listed,
        // A folder no row claimed has only its name to offer as a title, and
        // the guess is that name with the tail forms dropped, so the title
        // is already typed, as "Harbor Lights", not as the folder spells it.
        // The snapshot's row keeps naming the folder as it is.
        row:
          source.row === null
            ? { title: titleGuess(listed.title), genres: [] }
            : rowDetail(source.row),
        ...(folder === null ? {} : { folder: folder.dir }),
        candidates: source.candidates.map((scan) => scan.dir),
        files: folder === null ? { subtitles: [] } : filesOf(folder),
      };
    },

    resolve: async (id, form) => {
      const current = run;
      const source = sources.get(id);
      if (
        current === null ||
        root === null ||
        source === undefined ||
        !current.problems.some((problem) => problem.id === id)
      ) {
        throw new ProblemNotFoundError(id);
      }

      // Every found path is checked before the first is copied: a refusal
      // copies nothing at all, not even the files named inside the root
      // beside the one named outside it.
      const slots: ResolveFile[] = [
        form.video,
        ...(form.poster === null ? [] : [form.poster]),
        ...form.subtitles.map((track) => track.file),
      ];
      for (const slot of slots) {
        if ('found' in slot && !isUnder(root, slot.found)) {
          throw new ImportPathError(slot.found);
        }
      }

      // The folder is the one the route's bytes already went into, when there
      // are any — a found film beside a picked poster is one movie in one
      // folder — and a fresh one otherwise, named as the run would have named
      // it.
      const stored = slots.find(
        (slot): slot is { stored: string } => 'stored' in slot
      );
      const folder =
        (stored === undefined ? null : media.openFolder(stored.stored)) ??
        media.reserveFolder(form.title, form.year);

      /** A stored file as it is; a found one copied in beside it. */
      const place = (slot: ResolveFile): Promise<string> =>
        'stored' in slot
          ? Promise.resolve(slot.stored)
          : media.copyIn(folder, slot.found);

      try {
        const videoPath = await place(form.video);
        const posterPath =
          form.poster === null ? undefined : await place(form.poster);
        const subtitles: NewSubtitle[] = [];
        for (const track of form.subtitles) {
          subtitles.push({
            path: await place(track.file),
            language: track.language,
          });
        }
        const runtime = derivedRuntime(playback, videoPath);

        // The form's fields, not the sheet's: the row only prefilled them.
        // What the sheet alone knows — whether the family has seen it — is
        // carried, because the form has no field to contradict it with.
        const added = storage.addMovie({
          title: form.title,
          videoPath,
          ...(source.row === null ? {} : { watched: source.row.watched }),
          ...(form.year === null ? {} : { year: form.year }),
          ...(runtime === null ? {} : { runtimeMinutes: runtime }),
          ...(form.director === null ? {} : { director: form.director }),
          ...(form.synopsis === null ? {} : { synopsis: form.synopsis }),
          ...(form.rating === null ? {} : { rating: form.rating }),
          ...(form.cast.length === 0 ? {} : { cast: form.cast }),
          ...(form.genres.length === 0 ? {} : { genres: form.genres }),
          ...(posterPath === undefined ? {} : { posterPath }),
          ...(subtitles.length === 0 ? {} : { subtitles }),
        });
        takeOff(id);
        return added;
      } catch (error) {
        // A resolve that could not be made leaves no folder behind — the
        // route's own bytes included, since a resolve is a new movie and
        // nothing older lives in that folder — and the problem stays listed.
        media.removeFolder(folder);
        throw error;
      }
    },
  };
}
