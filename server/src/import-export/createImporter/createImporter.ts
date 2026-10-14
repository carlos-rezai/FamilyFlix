import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  posix,
  relative,
  sep,
} from 'node:path';

import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import type { Media } from '../../media/createMedia/createMedia';
import { readableFolder } from '../../media/readableFolder/readableFolder';
import type { MovieFolderScan } from '../../media/scanMovieFolder/scanMovieFolder';
import { walkLibraryFolder } from '../../media/walkLibraryFolder/walkLibraryFolder';
import type { Playback } from '../../playback/createPlayback/createPlayback';
import { spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import { derivedRuntime } from '../../playback/derivedRuntime/derivedRuntime';
import {
  groupShows,
  type ShowEpisode,
  type ShowScan,
} from '../groupShows/groupShows';
import { MATCH_REASON, matchRows, type Match } from '../matchRows/matchRows';
import { splitCollections } from '../splitCollections/splitCollections';
import { heldSeriesValues, heldValues } from '../heldValues/heldValues';
import {
  chosenSheetFill,
  movieSheetPatch,
  seriesSheetPatch,
} from '../plannedSheetFill/plannedSheetFill';
import {
  planSheetFields,
  type SheetFill,
} from '../planSheetFields/planSheetFields';
import { readSheet, type SheetRow } from '../readSheet/readSheet';
import { titleGuess, titleKey, yearInName } from '../titleKey/titleKey';
import type {
  CandidateFolder,
  ImportField,
  ImportMode,
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
  SheetChoices,
  SheetDifference,
} from '@/types';
import { SHEET_FIELDS } from '@/types';

/**
 * A start refused before any run exists, naming what it refuses on — the
 * sheet field, or the **Library folders** group when none is listed — and the
 * screen draws the reason under that one. The route answers it as
 * `400 { error, field }`.
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
 * A **Found file** named outside every **Library folder** the **Current run**
 * read — or a folder itself, or a path climbing out of one through `..`.
 * Refused before anything is copied: the resolve route is the one surface in
 * the app that accepts a path, and the listed folders are the whole of what
 * it may be pointed at. The route answers it as `400`.
 */
export class ImportPathError extends Error {
  constructor(readonly path: string) {
    super('That file is not under a library folder.');
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
 * **Found file** — the absolute path the scan found it at, under a Library
 * folder — or a file the route has already stored from bytes, as its
 * **Stored path**.
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
 * A **Series Resolve** the importer will not write — a number the held series
 * already has. Refused before anything is copied; the route answers it as
 * `400`, its message naming the number.
 */
export class ResolveRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResolveRefusedError';
  }
}

/** One **Episode file row** of the **Series Resolve**, as _Save & continue_ sends it. */
export interface ResolveEpisode {
  season: number;
  number: number;
  title?: string;
  video: ResolveFile;
  subtitles: { file: ResolveFile; language: string }[];
}

/**
 * The series kind of the **Movie form** as the **Series Resolve** sends it:
 * the fields as the maintainer left them, the poster, and each episode.
 */
export interface ResolveSeriesForm {
  title: string;
  year?: number;
  endYear?: number;
  creator?: string;
  synopsis?: string;
  rating?: number;
  cast: string[];
  genres: string[];
  poster: ResolveFile | null;
  episodes: ResolveEpisode[];
}

/**
 * What a press on a **Review step** row that imports a folder answers — an
 * outcome value, never a throw, as enrichment's `pick` answers:
 *
 * - `imported`: the title is in the library and the row is off;
 * - `redrawn`: the row became another **Problem** in its place — the folder's
 *   `no-video`, or the `failed` its copy filed — answered for the screen;
 * - `not-found`: no such row, or no run;
 * - `refused`: a press the importer will not take, in its own sentence,
 *   before anything is copied.
 */
export type ReviewOutcome =
  | { kind: 'imported' }
  | { kind: 'redrawn'; problem: ImportProblem }
  | { kind: 'not-found' }
  | { kind: 'refused'; error: string };

/**
 * What the API layer can ask the import domain for. Injected into the router
 * as the fifth argument the way `playback` and `media` are, so the route layer
 * never learns there is a spreadsheet. `start`, `scan`, `current`, `cancel`,
 * `dismiss`, `apply`, `pick`, `importGuessed`, `problem`, `resolve` and
 * `resolveSeries`.
 */
export interface Importer {
  /**
   * Start the **Current run** over a sheet and every listed **Library
   * folder**, and answer its first snapshot. Rejects with
   * {@link ImportStartError} for a sheet that does not exist, cannot be read,
   * is neither `.xlsx` nor `.csv` or has no title column, and on `folders`
   * when none is listed — before any run exists; with {@link ImportBusyError}
   * while a run is scanning or importing — a run in review is let go. `enrich`
   * is only carried on the run, for _Finish_ to read; `mode`, the **Import
   * mode**, is carried as `ImportRun.mode` to every import the run makes.
   */
  start(
    sheetPath: string,
    enrich?: boolean,
    mode?: ImportMode
  ): Promise<ImportRun>;
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
   * _Apply choices_ on a `differs` **Problem**: write the sheet's side of each
   * of its fields chosen `sheet`, keep the rest, and take the Problem off —
   * `true` for having gone. `false` for an id that is not there, and when
   * there is no run, writing nothing.
   */
  apply(id: string, choices: SheetChoices): boolean;
  /**
   * A press on an `ambiguous` **Problem**'s **Folder picker**: import the row
   * from one of its own **Candidate folders** and take the Problem off —
   * `imported`. A candidate holding no single video turns the row into that
   * folder's `no-video` Problem in its place, and a copy that fails into its
   * `failed` one — `redrawn`. `not-found` for an id that is not there, and
   * when there is no run; `refused` for a folder that is not a candidate,
   * before anything is copied.
   */
  pick(id: string, folder: string): Promise<ReviewOutcome>;
  /**
   * _Import as_ on a `no-row` **Problem**: import its folder under the row a
   * **Folder scan** would give it — `guessedRow` — and take the Problem off,
   * `imported`; a folder holding no single video, or a copy that fails, is
   * `redrawn` as {@link pick}'s are. `not-found` for an id that is not there,
   * for a Problem that is not a `no-row`, and when there is no run.
   */
  importGuessed(id: string): Promise<ReviewOutcome>;
  /**
   * The **Problem detail** _Resolve_ prefills the form from: the problem, the
   * **Sheet row**, the **Source folder** it is about, the candidate folders
   * and the folder's **Found files** as absolute paths. `null` for an id that
   * is not there, and when there is no run.
   */
  problem(id: string): ImportProblemDetail | null;
  /**
   * _Save & continue_: copy every **Found file** the form names in from under
   * the run's Library folders, take a file the route already stored as it is,
   * add the movie by the form's own sequence and dismiss the problem. Rejects
   * with {@link ImportPathError} for a found path outside them — before
   * anything is copied — and with {@link ProblemNotFoundError} for a problem
   * that is not there; a copy that fails leaves no folder behind and keeps the
   * problem.
   */
  resolve(id: string, form: ResolveForm): Promise<Movie>;
  /**
   * The **Series Resolve**'s _Save & continue_ on an `unplaced` Problem:
   * create the series, or join the one the Problem names, copying every
   * found video in from under the Library folders and recording each as its
   * **Source file**, then dismiss the problem. Rejects with
   * {@link ImportPathError}, {@link ResolveRefusedError} for a number the
   * held series has, and {@link ProblemNotFoundError}, each before anything
   * is copied.
   */
  resolveSeries(id: string, form: ResolveSeriesForm): Promise<Series>;
  /**
   * Start the **Current run** as a **Folder scan** over the listed **Library
   * folders**, in the order given, and answer its first snapshot. No sheet:
   * each film is named off its folder, each show off its Show folder. A folder
   * that cannot be reached is skipped with a **Warning line**. Rejects with
   * {@link ImportBusyError} while a run is scanning or importing — a run in
   * review is let go — and `enrich` is only carried. Under the **Import
   * mode** `link` a found film's video is recorded where it lies, a **Linked
   * video**, rather than copied in; `copy` when none is given.
   */
  scan(
    folders: StoredLibraryFolder[],
    enrich?: boolean,
    mode?: ImportMode
  ): Promise<ImportRun>;
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
    "Imported, but the row has no genre, so it won't appear in any genre row.",
  differs:
    'The spreadsheet has different values for fields you already filled in.',
} as const;

/**
 * A **Problem** as the snapshot lists it, under an id of its own — and, for
 * one about a title the library holds, its owner: the movie or the series.
 */
const problemOf = (
  kind: ProblemKind,
  title: string,
  reason: string,
  owner?: { movieId: string } | { seriesId: string }
): ImportProblem => ({
  id: randomUUID(),
  kind,
  title,
  reason,
  ...owner,
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

/** Paths in name order, as the **Problem detail** lists them. */
const inNameOrder = (paths: string[]): string[] =>
  [...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * The **Found files** of one **Source folder**, as the form's slots take them.
 * Every video in `videos`, in name order; `video` only when the folder holds
 * exactly one: two is the `no-video` verdict, and the detail guesses no more
 * than the run did — the maintainer picks, on the **Found-file choice**.
 */
const filesOf = (scan: MovieFolderScan): ImportProblemDetail['files'] => ({
  ...(scan.videos.length === 1 ? { video: scan.videos[0] } : {}),
  videos: inNameOrder(scan.videos),
  ...(scan.poster === null ? {} : { poster: scan.poster }),
  ...(scan.backdrop === null ? {} : { backdrop: scan.backdrop }),
  subtitles: scan.subtitles.map(({ path, language }) => ({ path, language })),
});

/**
 * An `ambiguous` **Problem**'s **Candidate folders**, as the **Folder picker**
 * draws them: each weighed scan's whole folder — the folder as the walk found
 * it, before a **Collection folder** was split — once per path, in the order
 * weighed.
 */
const candidateFolders = (
  scans: MovieFolderScan[],
  wholeOf: (scan: MovieFolderScan) => MovieFolderScan
): CandidateFolder[] => [
  ...new Map(
    scans.map((scan) => {
      const whole = wholeOf(scan);
      return [
        whole.dir,
        { path: whole.dir, name: whole.name, videos: whole.videos.length },
      ] as const;
    })
  ).values(),
];

/** The sentences a review press is refused in, before anything is copied. */
const REFUSAL = {
  notCandidate: 'That folder is not one of the candidates.',
  unlisted: 'That folder is no longer under a Library folder.',
} as const;

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

/**
 * A video's **Source file**: its path relative to its show's **Source
 * folder** `dir`, with forward slashes whatever the platform spells — the one
 * spelling the scan and the **Series Resolve** both record.
 */
const sourceFileOf = (dir: string, video: string): string =>
  relative(dir, video).split(sep).join('/');

/**
 * A **Collection folder** film's **Source file**, its one video relative to
 * the shared folder; `null` for a film in a folder of its own.
 */
const collectionFileOf = (scan: MovieFolderScan): string | null =>
  scan.collection === true ? sourceFileOf(scan.dir, scan.videos[0]) : null;

/** An episode as the console names it: `Harbor & Vine · S01E03`. */
const episodeLabel = (title: string, { season, episode }: ShowEpisode) =>
  `${title} · ${spellEpisodeTag(season, episode)}`;

/** The reason a show's **Unplaced** videos are filed with: their count. */
const unplacedReason = (n: number): string =>
  n === 1 ? '1 episode needs a number' : `${count(n)} episodes need numbers`;

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
  images: [],
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
  /**
   * The show's one `unplaced` **Problem**, once filed: the run names the
   * series on it when it creates one, so _Resolve_ joins it.
   */
  unplaced: ImportProblem | null;
  /** Whether the held series took **Sheet fills** this run. */
  updated: boolean;
}

/**
 * The **Genre pool** by lower-cased name, and the unknown names already
 * warned of — one per run, shared by the fills and the imports.
 */
interface GenreReader {
  pool: Map<string, string>;
  warned: Set<string>;
}

/** A title the library already holds: a film or a series, by id. */
interface HeldTitle {
  kind: 'movie' | 'series';
  id: string;
}

/**
 * A `differs` **Problem**'s held title and the sheet's side of each of its
 * **Sheet differences**, as `planSheetFields` proposed it — what _Apply
 * choices_ writes from.
 */
interface Differing extends HeldTitle {
  proposed: SheetFill;
}

/** The fields a fill names on its `✓ Updated` line, in the sheet's order. */
const filledNames = (fill: SheetFill): string[] => [
  ...SHEET_FIELDS.filter((field) => fill[field] !== undefined),
  ...(fill.watched === true ? ['watched'] : []),
];

/**
 * A film or show a run will import, and the **Library folder** it was found
 * under — where its **Source folder** is recorded relative to.
 */
interface Placed<M> {
  match: M;
  libraryFolder: StoredLibraryFolder;
}

/** One listed **Library folder** as the walk found it: its films and its shows. */
interface WalkedFolder {
  folder: StoredLibraryFolder;
  films: MovieFolderScan[];
  shows: ShowScan[];
}

/**
 * A series the library already holds, as a run needs it: the series, the
 * `(season, episode)` tags it has, the **Source files** its episodes came
 * from, and the **Series folder** they live in — or `null` when none of them
 * names one.
 */
interface HeldSeries {
  series: Series;
  tags: Set<string>;
  sourceFiles: Set<string>;
  folder: string | null;
}

/**
 * The row a folder no row names imports under — a show the sheet left out, or
 * every title of a **Folder scan**: its title guessed from the folder's name,
 * its year the one the name carries, and nothing else.
 */
const guessedRow = (name: string): SheetRow => ({
  title: titleGuess(name),
  year: yearInName(name),
  endYear: null,
  genres: [],
  director: null,
  cast: [],
  synopsis: null,
  rating: null,
  watched: false,
});

/**
 * Whether `path` lies strictly under `folder` — not the folder itself, not a
 * path climbing out of it through `..`, and not one on another drive, which
 * `relative` answers with an absolute path rather than a climb.
 */
const isUnder = (folder: string, path: string): boolean => {
  const under = relative(folder, path);
  return under !== '' && !under.startsWith('..') && !isAbsolute(under);
};

/**
 * How many folders the scan went through: every **Source folder** and every
 * shelf between it and its Library folder — `Drama/` counts, the Library
 * folder does not.
 */
function foldersUnder(listed: string, scans: MovieFolderScan[]): number {
  const folders = new Set<string>();
  for (const scan of scans) {
    for (let dir = scan.dir; isUnder(listed, dir); dir = dirname(dir)) {
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
 * sheet is a thousand lookups otherwise. A title already there is **Already
 * in library**: by the **Source folder** on record first, then by key and
 * year. It is never a **Match** — nothing is added for it, which is what
 * makes cancel-then-restart harmless — but it takes its row's **Sheet
 * fills** during the run and files its **Sheet differences** as one `differs`
 * **Problem**.
 *
 * Each match is imported by the **Movie form**'s own sequence: reserve the
 * **Movie folder**, copy in the video, the poster, the backdrop and each
 * subtitle, derive the runtime, `addMovie` with `tmdbId` null. A match whose
 * import throws has its folder taken back and is filed as `failed`; one whose
 * row leaves it in no genre imports and is filed as the soft `missing-meta`.
 * The originals under the Library folders are never written to.
 *
 * **Problems are data.** The rows the matcher could not settle and the
 * folders no row claimed are on the snapshot before the first copy starts,
 * `failed` and `missing-meta` as the loop reaches them, and the complete line
 * counts them all. `dismiss` takes one off — the **Review step**'s _Skip_.
 * What the run knew when it filed each one — the row, the folders — is kept
 * beside the snapshot for `problem`, the **Problem detail** _Resolve_ opens
 * the form on; `resolve` is that form's _Save & continue_, copying **Found
 * files** in from under the Library folders and nowhere else.
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
  /** The run's **Library folders**: the only places a found file may be. */
  let listedPaths: string[] = [];
  /** What the run knew when it filed each **Problem**, by the problem's id. */
  const sources = new Map<string, ProblemSource>();
  /**
   * Each `differs` **Problem**'s held title and the sheet's side of each
   * difference — what _Apply choices_ writes from.
   */
  const differing = new Map<string, Differing>();
  /**
   * Each film **Source folder** the walk found, by its path, before a
   * **Collection folder** was split: what a **Candidate folder** is, whole.
   */
  const wholeFolders = new Map<string, MovieFolderScan>();
  /** A scan's folder as the walk found it — the scan itself, unless split. */
  const wholeOf = (scan: MovieFolderScan): MovieFolderScan =>
    wholeFolders.get(scan.dir) ?? scan;
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
    differing.delete(id);
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
    { pool, warned }: GenreReader,
    current: ImportRun
  ): string[] =>
    names.flatMap((name) => {
      const known = pool.get(name.toLowerCase());
      if (known !== undefined) {
        return [known];
      }
      if (!warned.has(name.toLowerCase())) {
        warned.add(name.toLowerCase());
        log(current, `⚠ Unknown genre "${name}", dropped`, 'warning');
      }
      return [];
    });

  /** The **Genre pool** read for one run, nothing warned of yet. */
  const genreReader = (): GenreReader => ({
    pool: new Map(
      storage
        .listGenrePool()
        .map((genre) => [genre.name.toLowerCase(), genre.name])
    ),
    warned: new Set<string>(),
  });

  /**
   * The row as a held title is planned against: its genres read onto the
   * **Genre pool**, an unknown one dropped and warned of once.
   */
  const pooledRow = (
    row: SheetRow,
    genres: GenreReader,
    current: ImportRun
  ): SheetRow => ({
    ...row,
    genres: knownGenres(row.genres, genres, current),
  });

  /**
   * A held title's **Sheet differences** filed as one `differs` **Problem**,
   * carrying its movie or series — nothing filed when there are none — and
   * the sheet's side of each kept beside it, `proposed`, for _Apply choices_.
   * The run never writes them; _Apply choices_ does.
   */
  const fileDiffers = (
    current: ImportRun,
    row: SheetRow,
    held: Differing,
    differences: SheetDifference[]
  ): void => {
    if (differences.length === 0) {
      return;
    }
    const problem: ImportProblem = {
      ...problemOf(
        'differs',
        titleWithYear(row.title, row.year),
        REASON.differs,
        held.kind === 'movie' ? { movieId: held.id } : { seriesId: held.id }
      ),
      differences,
    };
    file(current, problem, { row, folder: null, candidates: [] });
    differing.set(problem.id, held);
  };

  /**
   * Any **Sheet fill** written onto a held title — the run's fills and
   * _Apply choices_ alike, so a sheet value lands the same whichever wrote
   * it. A film through `updateMovie`, its Watched mark through `markWatched`;
   * a series through `enrichSeries`, its rating through `setSeriesRating`. An
   * empty patch is never written.
   */
  const writeSheetFill = ({ kind, id }: HeldTitle, fill: SheetFill): void => {
    if (kind === 'movie') {
      const patch = movieSheetPatch(fill);
      if (Object.keys(patch).length > 0) {
        storage.updateMovie(id, patch);
      }
      if (fill.watched === true) {
        storage.markWatched(id);
      }
      return;
    }
    const patch = seriesSheetPatch(fill);
    if (Object.keys(patch).length > 0) {
      storage.enrichSeries(id, patch);
    }
    if (fill.rating !== undefined) {
      storage.setSeriesRating(id, fill.rating);
    }
  };

  /** The **Already in library** line: a held title the run added nothing to. */
  const logAlreadyHeld = (current: ImportRun, row: SheetRow): void => {
    log(
      current,
      `· Already in library ${titleWithYear(row.title, row.year)}`,
      'info'
    );
  };

  /**
   * A held title's `✓ Updated` line, naming what it took — nothing written
   * when it took nothing. Answers whether it took any.
   */
  const logUpdated = (
    current: ImportRun,
    row: SheetRow,
    fill: SheetFill
  ): boolean => {
    const names = filledNames(fill);
    if (names.length === 0) {
      return false;
    }
    log(
      current,
      `✓ Updated    ${titleWithYear(row.title, row.year)} — ${names.join(', ')}`,
      'success'
    );
    return true;
  };

  /**
   * A held title's **Sheet fills** written during the run, through
   * {@link writeSheetFill} — never a field raised as a difference, which is
   * filed instead, and never its title. Only its `✓ Updated` line is written
   * here: what took nothing is **Already in library** once the caller knows
   * nothing else was added either. Answers whether it took any.
   */
  const fillHeld = (
    current: ImportRun,
    held: HeldTitle,
    row: SheetRow,
    genres: GenreReader
  ): boolean => {
    const movie = held.kind === 'movie' ? storage.getMovie(held.id) : null;
    const series = held.kind === 'series' ? storage.getSeries(held.id) : null;
    const values =
      movie !== null
        ? heldValues(movie)
        : series !== null
          ? heldSeriesValues(series)
          : null;
    if (values === null) {
      return false;
    }
    const pooled = pooledRow(row, genres, current);
    const { fill, differences, proposed } = planSheetFields(
      values,
      pooled,
      held.kind
    );
    fileDiffers(current, pooled, { ...held, proposed }, differences);
    writeSheetFill(held, fill);
    return logUpdated(current, row, fill);
  };

  /**
   * Import one match by the form's own sequence. Answers the movie added, or
   * `null` when the import threw — a locked or vanishing file, a cancel — with
   * the folder taken back and, unless the run was cancelled, `failed` filed
   * with the OS's reason. The run goes on to the next match either way.
   * `named` is whether a **Sheet row** named the match: only a row can name a
   * genre, so only its match can be missing one.
   */
  const importMatch = async (
    { row, folder: scan }: Match,
    named: boolean,
    genreNames: GenreReader,
    current: ImportRun,
    signal: AbortSignal,
    libraryFolder: StoredLibraryFolder
  ): Promise<Movie | null> => {
    const folder = media.reserveFolder(row.title, row.year);
    try {
      // Link records the video where it lies, relative to its Library folder;
      // Copy copies it in. Everything after is the same either way.
      const linked = current.mode === 'link';
      const videoPath = linked
        ? relative(libraryFolder.path, scan.videos[0]).split(sep).join('/')
        : await media.copyIn(folder, scan.videos[0], signal);
      const videoFolderId = linked ? libraryFolder.id : null;
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
      const runtime = derivedRuntime(playback, { videoPath, videoFolderId });
      const genres = knownGenres(row.genres, genreNames, current);

      const movie: NewMovie = {
        title: row.title,
        videoPath,
        ...(videoFolderId === null ? {} : { videoFolderId }),
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
        mediaFolder: basename(folder),
      };
      const added = storage.addMovie(movie);
      storage.setSourceFolder(
        added.id,
        libraryFolder.id,
        relative(libraryFolder.path, scan.dir),
        collectionFileOf(scan)
      );
      // A row no sheet named has no genre to be missing.
      if (genres.length === 0 && named) {
        // Imported — nothing about the film is missing — and then listed,
        // because a film in no genre row is a film the family will not find.
        file(
          current,
          problemOf('missing-meta', row.title, REASON.missingMeta, {
            movieId: added.id,
          }),
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
    match: ShowMatch,
    genreNames: GenreReader,
    current: ImportRun,
    signal: AbortSignal,
    libraryFolder: StoredLibraryFolder
  ): Promise<void> => {
    const { row, show, held, episodes } = match;
    // Where the show came from, relative to its Library folder: on a held
    // series too, so a re-run backfills a library imported before it was
    // remembered.
    const sourceFolder = relative(libraryFolder.path, show.dir);
    if (held !== null) {
      storage.setSourceFolder(held.series.id, libraryFolder.id, sourceFolder);
    }
    for (const stray of show.straySubtitles) {
      log(
        current,
        `⚠ ${row.title}: ${basename(stray)} matches no episode, skipped`,
        'warning'
      );
    }
    if (episodes.length === 0) {
      if (held !== null && !match.updated) {
        logAlreadyHeld(current, row);
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
        // Link records the video where it lies, relative to its Library
        // folder; Copy copies it in. The subtitles are copied either way.
        const linked = current.mode === 'link';
        const videoPath = linked
          ? relative(libraryFolder.path, episode.video).split(sep).join('/')
          : await media.copyIn(into, episode.video, signal);
        const videoFolderId = linked ? libraryFolder.id : null;
        const subtitles: NewSubtitle[] = [];
        for (const track of episode.subtitles) {
          subtitles.push({
            path: await media.copyIn(into, track.path, signal),
            language: track.language,
          });
        }
        signal.throwIfAborted();
        const runtime = derivedRuntime(playback, { videoPath, videoFolderId });

        if (series === null) {
          const genres = knownGenres(row.genres, genreNames, current);
          const input: NewSeries = {
            title: row.title,
            ...(row.year === null ? {} : { year: row.year }),
            ...(row.endYear === null ? {} : { endYear: row.endYear }),
            ...(row.director === null ? {} : { creator: row.director }),
            ...(row.synopsis === null ? {} : { synopsis: row.synopsis }),
            ...(row.rating === null ? {} : { rating: row.rating }),
            ...(row.cast.length === 0 ? {} : { cast: row.cast }),
            ...(genres.length === 0 ? {} : { genres }),
            mediaFolder: basename(folder),
          };
          series = storage.addSeries(input);
          storage.setSourceFolder(series.id, libraryFolder.id, sourceFolder);
          if (match.unplaced !== null) {
            match.unplaced.seriesId = series.id;
          }
        }
        storage.addEpisode(series.id, {
          season: episode.season,
          number: episode.episode,
          videoPath,
          ...(videoFolderId === null ? {} : { videoFolderId }),
          sourceFile: sourceFileOf(show.dir, episode.video),
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
   * A matched show's **Unplaced** videos: one hard Problem for the show,
   * titled with it, its reason the count, its detail listing every video —
   * resolved in the **Series Resolve**. A held series is named on it now; one
   * the run creates, once it has.
   */
  const fileUnplaced = (current: ImportRun, match: ShowMatch) => {
    const { row, show, held } = match;
    const videos = inNameOrder(
      show.unplaced.filter(
        (video) => !held?.sourceFiles.has(sourceFileOf(show.dir, video))
      )
    );
    if (videos.length === 0) {
      return;
    }
    const problem = problemOf(
      'unplaced',
      row.title,
      unplacedReason(videos.length),
      held === null ? undefined : { seriesId: held.series.id }
    );
    file(current, problem, {
      row,
      folder: { ...asMatchable(show), videos },
      candidates: [],
    });
    match.unplaced = problem;
  };

  /**
   * The two **Warning lines** that never block: subtitles and posters are
   * optional on the form this run shares its save with, so their absence is
   * noted under the imported line rather than held against the match.
   */
  const warnOfMissingFiles = (current: ImportRun, { row, folder }: Match) => {
    if (folder.subtitles.length === 0) {
      log(current, `⚠ ${row.title}: no subtitle track found`, 'warning');
    }
    if (folder.poster === null) {
      log(current, `⚠ ${row.title}: no poster found`, 'warning');
    }
  };

  /**
   * The **Series folder** a held series' files live in — its recorded **Media
   * folder**, opened — or `null` when none is recorded or it is not there.
   */
  const heldFolder = (seriesId: string): string | null => {
    const recorded = storage.mediaFolderOf('series', seriesId);
    return recorded === null ? null : media.openFolder(recorded);
  };

  /**
   * A show as this run imports it: joined to the held series of its key and
   * year, if there is one, with only the episodes that series lacks — a video
   * whose **Source file** the series holds first, whatever its tag says, then
   * one whose `(season, episode)` it holds.
   */
  const showMatch = (
    row: SheetRow,
    show: ShowScan,
    held: HeldSeries | null
  ): ShowMatch => {
    return {
      row,
      show,
      held,
      episodes:
        held === null
          ? show.episodes
          : show.episodes.filter(
              (episode) =>
                !held.sourceFiles.has(sourceFileOf(show.dir, episode.video)) &&
                !held.tags.has(spellEpisodeTag(episode.season, episode.episode))
            ),
      unplaced: null,
      updated: false,
    };
  };

  /**
   * Every series the library holds, by key and year, with its episodes' tags
   * and folder — read once per run, before its first `await`, as
   * `heldFilmsByKey` is: a storage read after the walk would sit outside every
   * catch.
   */
  const heldSeriesList = (): HeldSeries[] =>
    storage.getSeriesHome().series.map((series) => {
      const episodes = storage.listEpisodes(series.id);
      return {
        series,
        tags: new Set(
          episodes.map((episode) =>
            spellEpisodeTag(episode.season, episode.number)
          )
        ),
        sourceFiles: new Set(
          episodes.flatMap((episode) =>
            episode.sourceFile === null ? [] : [episode.sourceFile]
          )
        ),
        folder: heldFolder(series.id),
      };
    });

  /** The held series by key and year — built once per run, from its list. */
  const heldSeriesByKey = (held: HeldSeries[]): Map<string, HeldSeries> =>
    new Map(
      held.map((entry) => [
        filmKey(entry.series.title, entry.series.year),
        entry,
      ])
    );

  /**
   * Every film the library holds, by key and year, to its id — read once per
   * run.
   */
  const heldFilmsByKey = (): Map<string, string> =>
    new Map(
      storage
        .listMovies({ sort: 'a-z' })
        .map((movie: Movie) => [filmKey(movie.title, movie.year), movie.id])
    );

  /**
   * Import one folder from the **Review step** under one row — the **Folder
   * picker**'s and _Import as_'s one way in. The row comes off before the
   * copy, so a second press finds nothing to import. A folder without exactly
   * one video is `redrawn` as its `no-video` Problem in the row's place, and
   * a copy that fails as the `failed` Problem it filed, in the same place;
   * otherwise `imported`. `named` is whether a **Sheet row** is the row.
   */
  const importFromReview = async (
    current: ImportRun,
    id: string,
    row: SheetRow,
    named: boolean,
    scan: MovieFolderScan,
    libraryFolder: StoredLibraryFolder
  ): Promise<ReviewOutcome> => {
    const at = current.problems.findIndex((problem) => problem.id === id);
    takeOff(id);

    /** The row redrawn in its own place, as `problem` reads it. */
    const redraw = (
      problem: ImportProblem,
      kept: ProblemSource
    ): ReviewOutcome => {
      current.problems.splice(at, 0, problem);
      sources.set(problem.id, kept);
      return { kind: 'redrawn', problem };
    };

    if (scan.videos.length !== 1) {
      return redraw(
        {
          id,
          kind: 'no-video',
          title: row.title,
          reason:
            scan.videos.length === 0
              ? MATCH_REASON.noVideo
              : MATCH_REASON.manyVideos,
        },
        { row, folder: scan, candidates: [] }
      );
    }

    const before = current.problems.length;
    const added = await importMatch(
      { row, folder: scan },
      named,
      genreReader(),
      current,
      stop.signal,
      libraryFolder
    );
    if (added === null && current.problems.length > before) {
      // The copy failed: the row becomes the `failed` Problem it filed.
      const [failed] = current.problems.splice(before, 1);
      const kept = sources.get(failed.id) ?? {
        row,
        folder: scan,
        candidates: [],
      };
      sources.delete(failed.id);
      return redraw(failed, kept);
    }
    return { kind: 'imported' };
  };

  /**
   * The **Import phase** both runs end in: each placed film, then each placed
   * show, imported against the folder it was found under, and the completion
   * line — `✓ Import complete` for a sheet, `✓ Scan complete` for a **Folder
   * scan**. A sheet's films are named by its rows; a scan's by their folders.
   * A cancel stops it where it is, and the run never reaches review.
   */
  const importPlaced = async (
    current: ImportRun,
    films: Placed<Match>[],
    shows: Placed<ShowMatch>[],
    verb: 'Import' | 'Scan',
    signal: AbortSignal,
    genres: GenreReader = genreReader()
  ): Promise<void> => {
    // Only new imports count: a held show taking episodes is not one.
    current.matched =
      films.length + shows.filter(({ match }) => match.held === null).length;
    // Each episode is one item on the bar, as each film is.
    current.total =
      films.length +
      shows.reduce((sum, { match }) => sum + match.episodes.length, 0);
    current.phase = 'importing';

    let imported = 0;
    for (const { match, libraryFolder } of films) {
      current.currentItem = match.row.title;
      const added = await importMatch(
        match,
        verb === 'Import',
        genres,
        current,
        signal,
        libraryFolder
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

    for (const { match, libraryFolder } of shows) {
      await importShow(match, genres, current, signal, libraryFolder);
      if (signal.aborted) {
        return;
      }
    }

    current.currentItem = '';
    log(
      current,
      `✓ ${verb} complete: ${count(imported)} imported, ${count(current.problems.length)} need attention.`,
      'success'
    );
    current.phase = 'review';
  };

  /**
   * The walk both starts take: one `Scanning   <path>` line per listed
   * **Library folder**, in the order given, then each folder walked — one that
   * cannot be reached skipped with a **Warning line**, the run going on over
   * the others — and the found line. Each folder answers its films, Collection
   * folders split, and its shows, so every title is placed against the folder
   * it was found under. `null` once the run was cancelled mid-walk.
   */
  const walkListed = async (
    current: ImportRun,
    folders: StoredLibraryFolder[],
    signal: AbortSignal
  ): Promise<WalkedFolder[] | null> => {
    for (const folder of folders) {
      log(current, `Scanning   ${folder.path}`, 'scan');
    }
    wholeFolders.clear();

    const walked: WalkedFolder[] = [];
    let found = 0;
    let shelves = 0;
    for (const folder of folders) {
      if ((await readableFolder(folder.path)) !== 'readable') {
        log(current, `⚠ Can't reach ${folder.path}, skipped`, 'warning');
        continue;
      }
      let scans: MovieFolderScan[] = [];
      try {
        scans = await walkLibraryFolder(
          folder.path,
          (scan) => {
            current.found += 1;
            current.currentItem = scan.dir;
          },
          (dir) => {
            log(current, `⚠ Could not read ${dir}, skipped`, 'warning');
          }
        );
      } catch {
        // A folder that stopped being readable mid-walk: what was found is
        // what there is, and the run still reaches review.
      }
      if (signal.aborted) {
        return null;
      }
      found += scans.length;
      shelves += foldersUnder(folder.path, scans);
      const grouped = groupShows(scans);
      for (const film of grouped.films) {
        wholeFolders.set(film.dir, film);
      }
      walked.push({
        folder,
        films: splitCollections(grouped.films),
        shows: grouped.shows,
      });
    }

    log(
      current,
      `✓ Found ${count(found)} movies across ${count(shelves)} folders. Starting import…`,
      'success'
    );
    return walked;
  };

  /**
   * The film the library already holds for a **Source folder**, by the two
   * **Already in library** rules in order: the folder on record first,
   * whatever its title now says — a **Collection folder** film by its Source
   * file — then the title key and year the row or the folder gives.
   */
  const heldFilm = (
    filmsByKey: Map<string, string>,
    folder: StoredLibraryFolder,
    scan: MovieFolderScan,
    row: SheetRow
  ): string | null =>
    storage.titleAt(
      folder.id,
      relative(folder.path, scan.dir),
      collectionFileOf(scan)
    ) ??
    filmsByKey.get(filmKey(row.title, row.year)) ??
    null;

  /**
   * The same two rules for a **Show folder**, over the held series: the folder
   * on record found in their list, the key and year in their map.
   */
  const heldShow = (
    held: HeldSeries[],
    seriesByKey: Map<string, HeldSeries>,
    folder: StoredLibraryFolder,
    show: ShowScan,
    row: SheetRow
  ): HeldSeries | null => {
    const atFolder = storage.titleAt(
      folder.id,
      relative(folder.path, show.dir)
    );
    return (
      held.find((entry) => entry.series.id === atFolder) ??
      seriesByKey.get(filmKey(row.title, row.year)) ??
      null
    );
  };

  /**
   * The listed **Library folder** a review press imports a folder under, read
   * live — the list as it is now, not as the run read it — or `null` when the
   * folder lies under none.
   */
  const listedFolderOf = (dir: string): StoredLibraryFolder | null =>
    storage.libraryFolders().find((listed) => isUnder(listed.path, dir)) ??
    null;

  /** A held film linked to where it was found. */
  const linkHeld = (
    heldId: string,
    folder: StoredLibraryFolder,
    scan: MovieFolderScan
  ): void => {
    storage.setSourceFolder(
      heldId,
      folder.id,
      relative(folder.path, scan.dir),
      collectionFileOf(scan)
    );
  };

  /** A held film linked to where it was found, and its skip line. */
  const skipHeld = (
    current: ImportRun,
    heldId: string,
    folder: StoredLibraryFolder,
    scan: MovieFolderScan,
    row: SheetRow
  ): void => {
    linkHeld(heldId, folder, scan);
    logAlreadyHeld(current, row);
  };

  /**
   * A sheet run: every listed folder walked, each **Sheet row** naming its
   * folder through `matchRows`, in whichever listed folder it lies.
   */
  const execute = async (
    current: ImportRun,
    { rows, blankTitleRows }: SheetRead,
    folders: StoredLibraryFolder[],
    signal: AbortSignal
  ): Promise<void> => {
    const filmsByKey = heldFilmsByKey();
    const held = heldSeriesList();
    const seriesByKey = heldSeriesByKey(held);
    const genres = genreReader();

    const walked = await walkListed(current, folders, signal);
    if (walked === null) {
      return;
    }
    for (const rowNumber of blankTitleRows) {
      log(current, `⚠ Row ${rowNumber} has no title, skipped`, 'warning');
    }

    // A show is matched by the film's own rule, over a scan standing for it —
    // and told apart again once matched. Every scan remembers its folder.
    const folderOf = new Map<MovieFolderScan, StoredLibraryFolder>();
    const showOf = new Map<MovieFolderScan, ShowScan>();
    const films: MovieFolderScan[] = [];
    for (const { folder, films: found, shows } of walked) {
      for (const scan of found) {
        folderOf.set(scan, folder);
        films.push(scan);
      }
      for (const show of shows) {
        const matchable = asMatchable(show);
        folderOf.set(matchable, folder);
        showOf.set(matchable, show);
      }
    }

    const verdicts = matchRows(rows, [...films, ...showOf.keys()]);
    const matched: Placed<Match>[] = [];
    const matchedShows: Placed<ShowMatch>[] = [];
    for (const match of verdicts.matched) {
      const libraryFolder = folderOf.get(match.folder);
      if (libraryFolder === undefined) {
        continue;
      }
      const show = showOf.get(match.folder);
      if (show !== undefined) {
        const joined = showMatch(
          match.row,
          show,
          heldShow(held, seriesByKey, libraryFolder, show, match.row)
        );
        if (joined.held !== null) {
          joined.updated = fillHeld(
            current,
            { kind: 'series', id: joined.held.series.id },
            match.row,
            genres
          );
        }
        matchedShows.push({ match: joined, libraryFolder });
        continue;
      }
      const heldId = heldFilm(
        filmsByKey,
        libraryFolder,
        match.folder,
        match.row
      );
      if (heldId !== null) {
        // Already in library: nothing is added, but where it came from is
        // remembered — the backfill for a library imported before this was —
        // and its empty fields take the row's **Sheet fills**.
        linkHeld(heldId, libraryFolder, match.folder);
        if (
          !fillHeld(current, { kind: 'movie', id: heldId }, match.row, genres)
        ) {
          logAlreadyHeld(current, match.row);
        }
        continue;
      }
      matched.push({ match, libraryFolder });
    }
    // Every match-time problem is on the snapshot before the first byte is
    // copied: the rows the matcher could not settle, and then the folders no
    // row claimed.
    for (const { kind, reason, row, candidates } of verdicts.problems) {
      // A row for a title held with no folder found is reached by its key and
      // year, and filled.
      const key = filmKey(row.title, row.year);
      const heldId = filmsByKey.get(key);
      const heldSeries = seriesByKey.get(key);
      const heldTitle: HeldTitle | null =
        heldId !== undefined
          ? { kind: 'movie', id: heldId }
          : heldSeries !== undefined
            ? { kind: 'series', id: heldSeries.series.id }
            : null;
      if (heldTitle !== null) {
        // No folder found, so nothing else is added to say it took nothing.
        if (!fillHeld(current, heldTitle, row, genres)) {
          logAlreadyHeld(current, row);
        }
      } else {
        // The first folder weighed is the one the detail is about — the one
        // an `ambiguous` prefills from, the one a `no-video` matched — and
        // only an `ambiguous` has others to name.
        const problem = problemOf(kind, row.title, reason);
        file(
          current,
          kind === 'ambiguous'
            ? { ...problem, candidates: candidateFolders(candidates, wholeOf) }
            : problem,
          {
            row,
            folder: candidates[0] ?? null,
            candidates: kind === 'ambiguous' ? candidates : [],
          }
        );
      }
    }
    for (const { match } of matchedShows) {
      fileUnplaced(current, match);
    }
    for (const folder of verdicts.unclaimed) {
      // A show no row names imports anyway, under the title its folder
      // suggests: a `no-row` Problem would open a form that cannot take a
      // series.
      const show = showOf.get(folder);
      const libraryFolder = folderOf.get(folder);
      if (show !== undefined && libraryFolder !== undefined) {
        const row = guessedRow(show.name);
        log(
          current,
          `⚠ ${titleWithYear(row.title, row.year)}: not in the spreadsheet, imported under its folder’s name`,
          'warning'
        );
        const unnamed = showMatch(
          row,
          show,
          heldShow(held, seriesByKey, libraryFolder, show, row)
        );
        fileUnplaced(current, unnamed);
        matchedShows.push({ match: unnamed, libraryFolder });
        continue;
      }
      const guess = guessedRow(folder.name);
      file(
        current,
        {
          ...problemOf('no-row', folder.name, REASON.noRow),
          guess: titleWithYear(guess.title, guess.year),
        },
        { row: null, folder, candidates: [] }
      );
    }
    await importPlaced(
      current,
      matched,
      matchedShows,
      'Import',
      signal,
      genres
    );
  };

  /**
   * A **Folder scan**: each listed folder walked in the order given, every
   * film and show named off its own folder. **Already in library** is the
   * sheet run's two rules in order. A held show still gains the episodes it
   * lacks.
   */
  const executeScan = async (
    current: ImportRun,
    folders: StoredLibraryFolder[],
    signal: AbortSignal
  ): Promise<void> => {
    const filmsByKey = heldFilmsByKey();
    const held = heldSeriesList();
    const seriesByKey = heldSeriesByKey(held);

    const walked = await walkListed(current, folders, signal);
    if (walked === null) {
      return;
    }

    const films: Placed<Match>[] = [];
    const shows: Placed<ShowMatch>[] = [];
    for (const { folder, films: found, shows: grouped } of walked) {
      for (const scan of found) {
        const row = guessedRow(scan.name);
        const heldId = heldFilm(filmsByKey, folder, scan, row);
        if (heldId !== null) {
          // Held: linked to where it was found, and nothing is added.
          skipHeld(current, heldId, folder, scan, row);
          continue;
        }
        if (scan.videos.length > 1) {
          // One film beside its extras: the maintainer picks, on the
          // Found-file choice, as a sheet run's matcher already asks.
          file(
            current,
            problemOf('no-video', row.title, MATCH_REASON.manyVideos),
            { row: null, folder: scan, candidates: [] }
          );
          continue;
        }
        films.push({ match: { row, folder: scan }, libraryFolder: folder });
      }
      for (const show of grouped) {
        const row = guessedRow(show.name);
        const match = showMatch(
          row,
          show,
          heldShow(held, seriesByKey, folder, show, row)
        );
        fileUnplaced(current, match);
        shows.push({ match, libraryFolder: folder });
      }
    }

    await importPlaced(current, films, shows, 'Scan', signal);
  };

  /** A run's first state, from its source and the flag it carries. */
  const freshRun = (
    source: ImportRun['source'],
    enrich: boolean,
    mode: ImportMode
  ): ImportRun => ({
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
    enrich,
    source,
    mode,
  });

  /**
   * Whether a start must be refused: a run is still scanning or importing. A
   * run in review is not — it has nothing left to copy or roll back, and only
   * _Finish_ lets it go from the screen, so a run left there by Back would
   * otherwise refuse every start onto its stale review until the app restarts.
   */
  const busy = (): boolean => run !== null && run.phase !== 'review';

  /**
   * Make a new run the **Current run**, for either start: refused with
   * {@link ImportBusyError} while one is {@link busy}, a run in review let go
   * as _Finish_ would have, and only once a run just cancelled has finished
   * rolling its folder back. Answers the run, with its Library folders' paths,
   * an empty problem record and a fresh cancel.
   */
  const claimRun = async (
    source: ImportRun['source'],
    enrich: boolean,
    mode: ImportMode,
    runFolders: string[]
  ): Promise<ImportRun> => {
    if (busy()) {
      throw new ImportBusyError();
    }
    // A run just cancelled may still be rolling its folder back; the new one
    // waits for that rather than reserving beside it.
    await running;
    // Checked again: two starts could have been racing through the wait, and
    // only one of them gets to be the run.
    if (busy()) {
      throw new ImportBusyError();
    }

    const current = freshRun(source, enrich, mode);
    run = current;
    listedPaths = runFolders;
    sources.clear();
    differing.clear();
    stop = new AbortController();
    return current;
  };

  return {
    start: async (sheetPath, enrich = false, mode = 'copy') => {
      // Busy before the sheet is read; `claimRun` asks again after it.
      if (busy()) {
        throw new ImportBusyError();
      }

      const sheet = await checkSheet(sheetPath);
      const folders = storage.libraryFolders();
      if (folders.length === 0) {
        throw new ImportStartError('folders', 'Add a library folder first.');
      }
      const current = await claimRun(
        'sheet',
        enrich,
        mode,
        folders.map((folder) => folder.path)
      );

      // Not awaited: the run goes on in the background, and `current` answers
      // where it has got to. Nothing in `execute` throws past its own catches.
      running = execute(current, sheet, folders, stop.signal);

      return snapshot() as ImportRun;
    },

    scan: async (folders, enrich = false, mode = 'copy') => {
      const current = await claimRun(
        'folders',
        enrich,
        mode,
        folders.map((folder) => folder.path)
      );

      // Not awaited, as a sheet run's is not.
      running = executeScan(current, folders, stop.signal);

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

    apply: (id, choices) => {
      const listed = run?.problems.some((problem) => problem.id === id);
      const held = differing.get(id);
      if (listed !== true || held === undefined) {
        return false;
      }
      writeSheetFill(held, chosenSheetFill(held.proposed, choices));
      return takeOff(id);
    },

    pick: async (id, folder) => {
      const current = run;
      const source = sources.get(id);
      if (
        current === null ||
        source === undefined ||
        !current.problems.some((problem) => problem.id === id)
      ) {
        return { kind: 'not-found' };
      }
      const candidate = source.candidates.find((each) => each.dir === folder);
      const row = source.row;
      if (candidate === undefined || row === null) {
        return { kind: 'refused', error: REFUSAL.notCandidate };
      }
      const scan = wholeOf(candidate);
      const libraryFolder = listedFolderOf(scan.dir);
      if (libraryFolder === null) {
        return { kind: 'refused', error: REFUSAL.unlisted };
      }
      return importFromReview(current, id, row, true, scan, libraryFolder);
    },

    importGuessed: async (id) => {
      const current = run;
      const listed = current?.problems.find((problem) => problem.id === id);
      const folder = sources.get(id)?.folder ?? null;
      if (
        current === null ||
        listed === undefined ||
        listed.kind !== 'no-row' ||
        folder === null
      ) {
        return { kind: 'not-found' };
      }
      const libraryFolder = listedFolderOf(folder.dir);
      if (libraryFolder === null) {
        return { kind: 'refused', error: REFUSAL.unlisted };
      }
      return importFromReview(
        current,
        id,
        guessedRow(folder.name),
        false,
        folder,
        libraryFolder
      );
    },

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
        files:
          folder === null ? { videos: [], subtitles: [] } : filesOf(folder),
      };
    },

    resolve: async (id, form) => {
      const current = run;
      const source = sources.get(id);
      if (
        current === null ||
        source === undefined ||
        !current.problems.some((problem) => problem.id === id)
      ) {
        throw new ProblemNotFoundError(id);
      }

      // Every found path is checked before the first is copied: a refusal
      // copies nothing at all, not even the files named inside a Library folder
      // beside the one named outside it.
      const slots: ResolveFile[] = [
        form.video,
        ...(form.poster === null ? [] : [form.poster]),
        ...form.subtitles.map((track) => track.file),
      ];
      for (const slot of slots) {
        if (
          'found' in slot &&
          !listedPaths.some((listed) => isUnder(listed, slot.found))
        ) {
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
        (stored === undefined
          ? null
          : media.openFolder(posix.dirname(stored.stored))) ??
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
        const runtime = derivedRuntime(playback, {
          videoPath,
          videoFolderId: null,
        });

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

    resolveSeries: async (id, form) => {
      const current = run;
      const source = sources.get(id);
      const listed = current?.problems.find((problem) => problem.id === id);
      if (current === null || source === undefined || listed === undefined) {
        throw new ProblemNotFoundError(id);
      }

      // Joining: the held series, and every number it has refused up front.
      const heldSeries =
        listed.seriesId === undefined
          ? null
          : storage.getSeries(listed.seriesId);
      const heldEpisodes =
        heldSeries === null ? [] : storage.listEpisodes(heldSeries.id);
      const heldTags = new Set(
        heldEpisodes.map((episode) =>
          spellEpisodeTag(episode.season, episode.number)
        )
      );

      // A join adds episodes and nothing else: the held series keeps its
      // poster, so the form's — the held one, sent back — is not read.
      const poster = heldSeries === null ? form.poster : null;

      // Every found path is checked before the first is copied, as the
      // film's are.
      const slots: ResolveFile[] = [
        ...(poster === null ? [] : [poster]),
        ...form.episodes.flatMap((episode) => [
          episode.video,
          ...episode.subtitles.map((track) => track.file),
        ]),
      ];
      for (const slot of slots) {
        if (
          'found' in slot &&
          !listedPaths.some((listed) => isUnder(listed, slot.found))
        ) {
          throw new ImportPathError(slot.found);
        }
      }
      for (const { season, number } of form.episodes) {
        const tag = spellEpisodeTag(season, number);
        if (heldTags.has(tag)) {
          throw new ResolveRefusedError(
            `Episode ${tag} is already in the series`
          );
        }
      }

      const stored = slots.find(
        (slot): slot is { stored: string } => 'stored' in slot
      );
      const ownFolder = heldSeries === null ? null : heldFolder(heldSeries.id);
      const folder =
        ownFolder ??
        (stored === undefined
          ? null
          : media.openFolder(posix.dirname(stored.stored))) ??
        media.reserveFolder(form.title, form.year ?? null);
      const copied: string[] = [];

      /** A stored file as it is; a found one copied into its season. */
      const place = async (slot: ResolveFile, season: number) => {
        if ('stored' in slot) {
          return slot.stored;
        }
        const path = await media.copyIn(
          media.seasonFolder(folder, season),
          slot.found
        );
        copied.push(path);
        return path;
      };
      const showDir = source.folder?.dir ?? null;
      const sourceFile = (slot: ResolveFile): string | undefined =>
        'found' in slot && showDir !== null
          ? sourceFileOf(showDir, slot.found)
          : undefined;

      try {
        const episodes = [];
        for (const episode of form.episodes) {
          const videoPath = await place(episode.video, episode.season);
          const subtitles: NewSubtitle[] = [];
          for (const track of episode.subtitles) {
            subtitles.push({
              path: await place(track.file, episode.season),
              language: track.language,
            });
          }
          const runtime = derivedRuntime(playback, {
            videoPath,
            videoFolderId: null,
          });
          const found = sourceFile(episode.video);
          episodes.push({
            season: episode.season,
            number: episode.number,
            videoPath,
            ...(episode.title === undefined ? {} : { title: episode.title }),
            ...(runtime === null ? {} : { runtimeMinutes: runtime }),
            ...(subtitles.length === 0 ? {} : { subtitles }),
            ...(found === undefined ? {} : { sourceFile: found }),
          });
        }

        let series: Series;
        if (heldSeries !== null) {
          for (const episode of episodes) {
            storage.addEpisode(heldSeries.id, episode);
          }
          series = heldSeries;
        } else {
          const posterPath =
            poster === null
              ? undefined
              : 'stored' in poster
                ? poster.stored
                : await media.copyIn(folder, poster.found);
          const input: NewSeries = {
            title: form.title,
            ...(form.year === undefined ? {} : { year: form.year }),
            ...(form.endYear === undefined ? {} : { endYear: form.endYear }),
            ...(form.creator === undefined ? {} : { creator: form.creator }),
            ...(form.synopsis === undefined ? {} : { synopsis: form.synopsis }),
            ...(form.rating === undefined ? {} : { rating: form.rating }),
            ...(form.cast.length === 0 ? {} : { cast: form.cast }),
            ...(form.genres.length === 0 ? {} : { genres: form.genres }),
            ...(posterPath === undefined ? {} : { posterPath }),
          };
          series = storage.addSeries(input, episodes);
        }
        takeOff(id);
        return series;
      } catch (error) {
        // A held series' folder keeps what it held: only this save's copies go.
        if (ownFolder === null) {
          media.removeFolder(folder);
        } else {
          for (const path of copied) {
            media.removeFile(path);
          }
        }
        throw error;
      }
    },
  };
}
