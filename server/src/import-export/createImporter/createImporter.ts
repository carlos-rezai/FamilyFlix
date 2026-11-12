import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setImmediate as nextTurn } from 'node:timers/promises';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
} from 'node:path';

import type {
  HeldTitle,
  LibraryStorage,
  StoredLibraryFolder,
} from '../../library';
import type { Media } from '../../media/createMedia/createMedia';
import { readableFolder } from '../../media/readableFolder/readableFolder';
import type {
  FilmScan,
  FolderScan,
  SubtitleFound,
} from '../../media/readTitleFolder/readTitleFolder';
import {
  folderKeyOf,
  sameFolderKey,
} from '../../media/folderKeyOf/folderKeyOf';
import {
  walkLibraryFolder,
  type WalkedTitle,
} from '../../media/walkLibraryFolder/walkLibraryFolder';
import type { Playback } from '../../playback/createPlayback/createPlayback';
import { spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import { derivedRuntime } from '../../playback/derivedRuntime/derivedRuntime';
import { spellLinkedVideo } from '../../playback/linkedVideoPath/linkedVideoPath';
import {
  numberShow,
  type ShowEpisode,
  type ShowScan,
} from '../numberShow/numberShow';
import { heldByVideo } from '../heldByVideo/heldByVideo';
import { listedFolderOf } from '../listedFolderOf/listedFolderOf';
import { MATCH_REASON, matchRows, type Match } from '../matchRows/matchRows';
import { filmSourceOf, sourceFileOf } from '../placeFilmFolder/placeFilmFolder';
import { filmWithCells, showWithCells } from '../pathCellFills/pathCellFills';
import { placeFoundVideo } from '../placeFoundVideo/placeFoundVideo';
import { heldSeriesValues, heldValues } from '../heldValues/heldValues';
import {
  chosenSheetFill,
  movieSheetPatch,
  seriesSheetPatch,
} from '../plannedSheetFill/plannedSheetFill';
import {
  FILL_ONLY_FIELDS,
  marksWatched,
  planSheetFields,
  type SheetFill,
} from '../planSheetFields/planSheetFields';
import type { LibrarySheet } from '../createLibrarySheet/createLibrarySheet';
import {
  isTitleRow,
  readSheet,
  skipLine,
  type SheetRow,
  type SheetSkip,
} from '../readSheet/readSheet';
import type { LayoutFill } from '../createLayoutFill/createLayoutFill';
import {
  readShowFolder,
  type ShowFolderAnswer,
} from '../readShowFolder/readShowFolder';
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
  StoredVideo,
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

  /**
   * The **Show folder read** of one absolute folder picked on the series add
   * — `readShowFolder`'s, so no route learns there is a walk — given the
   * listed Library folders and the held series on record at a folder.
   */
  readShowFolder(path: string): Promise<ShowFolderAnswer>;
}

/** The sheet formats the reader opens, by extension. */
const SHEET_EXTENSIONS = ['.xlsx', '.csv'];

/**
 * How many **Log lines** a snapshot carries, newest kept. Enough that a large
 * library's first warnings are still there when the **Review step** draws the
 * log; bounded, because every poll carries the whole of it.
 */
export const LOG_CAP = 2000;

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
  folder: FilmScan | null;
  candidates: FilmScan[];
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
const filesOf = (scan: FilmScan): ImportProblemDetail['files'] => ({
  ...(scan.videos.length === 1 ? { video: scan.videos[0] } : {}),
  videos: inNameOrder(scan.videos),
  ...(scan.poster === null ? {} : { poster: scan.poster }),
  ...(scan.backdrop === null ? {} : { backdrop: scan.backdrop }),
  subtitles: scan.subtitles.map(({ path, language }) => ({ path, language })),
});

/** A series' Episode rows: those of `rows` naming its **Folder key**. */
const episodeRowsOf = (rows: readonly SheetRow[], key: string): SheetRow[] =>
  rows.filter(
    (row) => row.type === 'Episode' && sameFolderKey(row.folder, key)
  );

/** The Season poster a show's scan found for `season`, or `null`. */
const scannedSeasonPoster = (show: ShowScan, season: number): string | null =>
  show.seasons.find((scanned) => scanned.number === season)?.poster ?? null;

/** The episode a show's scan found by season and number, or `null`. */
const scannedEpisode = (
  show: ShowScan,
  season: number,
  episode: number
): ShowScan['episodes'][number] | null =>
  show.episodes.find(
    (scanned) => scanned.season === season && scanned.episode === episode
  ) ?? null;

/** The Still a show's scan found for an episode, or `null`. */
const scannedStill = (
  show: ShowScan,
  season: number,
  episode: number
): string | null => scannedEpisode(show, season, episode)?.still ?? null;

/** The tracks a show's scan found for an episode, or none. */
const scannedTracks = (
  show: ShowScan,
  season: number,
  episode: number
): SubtitleFound[] => scannedEpisode(show, season, episode)?.subtitles ?? [];

/**
 * The tracks of `found` whose language `held` holds none of, the first of
 * each language only: a track the **Layout fill** wrote out is never a
 * second copy.
 */
const lackingTracks = (
  held: readonly { language: string }[],
  found: readonly SubtitleFound[]
): SubtitleFound[] => {
  const languages = new Set(held.map((track) => track.language));
  return found.filter((track) => {
    if (languages.has(track.language)) {
      return false;
    }
    languages.add(track.language);
    return true;
  });
};

/** A held title and its Title folder's read, as `fillHeldFiles` fills it. */
type HeldFiles =
  | { kind: 'movie'; id: string; scan: FilmScan }
  | { kind: 'series'; id: string; show: ShowScan };

/**
 * One piece of art copied `into` managed storage, or `undefined` when there
 * is none or its copy failed and was remembered.
 */
type ArtCopy = (
  into: string,
  file: string | null
) => Promise<string | undefined>;

/** A series' Season and Episode rows: those of `rows` naming its **Folder key**. */
const partRowsOf = (rows: readonly SheetRow[], key: string): SheetRow[] =>
  rows.filter(
    (row) =>
      (row.type === 'Season' || row.type === 'Episode') &&
      sameFolderKey(row.folder, key)
  );

/**
 * An `ambiguous` **Problem**'s **Candidate folders**, as the **Folder picker**
 * draws them: each weighed scan's folder, once per path, in the order
 * weighed.
 */
const candidateFolders = (scans: FilmScan[]): CandidateFolder[] => [
  ...new Map(
    scans.map(
      (scan) =>
        [
          scan.dir,
          { path: scan.dir, name: scan.name, videos: scan.videos.length },
        ] as const
    )
  ).values(),
];

/** The sentences a review press is refused in, before anything is copied. */
const REFUSAL = {
  notCandidate: 'That folder is not one of the candidates.',
  unlisted: 'That folder is no longer under a Library folder.',
} as const;

/** A count as the prototype prints it: `1,234`. */
const count = (n: number): string => n.toLocaleString('en-US');

/**
 * What the sheet check answers: the rows, and every skip the reader
 * reported.
 */
interface SheetRead {
  rows: SheetRow[];
  /** Each a **Log line** once the run exists, by `skipLine`. */
  skips: SheetSkip[];
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

  const skips: SheetSkip[] = [];
  try {
    const rows = await readSheet(bytes, sheetPath, (skip) => {
      skips.push(skip);
    });
    return { rows, skips };
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

/** An episode as the console names it: `Harbor & Vine · S01E03`. */
const episodeLabel = (title: string, { season, episode }: ShowEpisode) =>
  `${title} · ${spellEpisodeTag(season, episode)}`;

/** The reason a show's **Unplaced** videos are filed with: their count. */
const unplacedReason = (n: number): string =>
  n === 1 ? '1 episode needs a number' : `${count(n)} episodes need numbers`;

/** A show's one `failed` row's reason: the count and the first error. */
const failedShowReason = (n: number, first: string): string =>
  `${n === 1 ? '1 episode' : `${count(n)} episodes`} couldn't be copied: ${first}.`;

/** A show's one `failed` row's reason when only its art failed: the first. */
const failedArtReason = (file: string, first: string): string =>
  `Couldn't copy ${basename(file)}: ${first}.`;

/**
 * A **Show folder** as the matcher weighs it: a scan under the show's own
 * name and folder, holding its first episode — or its first **Unplaced**
 * video, so a show whose every video is unplaced still matches its row and
 * files only those — so the **Match rule** a film is held to is the one a
 * show is held to.
 */
const asMatchable = (show: ShowScan): FilmScan => ({
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
  /**
   * The sheet's Episode rows for the show, by its **Folder key**: none for an
   * unnamed show.
   */
  sheetEpisodes: SheetRow[];
  /**
   * The show's one `unplaced` **Problem**, once filed: the run names the
   * series on it when it creates one, so _Resolve_ joins it.
   */
  unplaced: ImportProblem | null;
  /**
   * What the held series' **Sheet fills** took this run, as its `✓ Updated`
   * line names them once its files are taken too.
   */
  filled: string[];
}

/**
 * The **Genre pool** by lower-cased name, and the unknown names already
 * warned of — one per run, shared by the fills and the imports.
 */
interface GenreReader {
  pool: Map<string, string>;
  warned: Set<string>;
}

/**
 * A `differs` **Problem**'s held title and the sheet's side of each of its
 * **Sheet differences**, as `planSheetFields` proposed it — what _Apply
 * choices_ writes from.
 */
interface Differing extends HeldTitle {
  proposed: SheetFill;
}

/**
 * The files a held title takes, as its `✓ Updated` line names them, in
 * order.
 */
const TAKEN_ORDER = [
  'poster',
  'backdrop',
  'season posters',
  'stills',
  'subtitles',
] as const;

/** One of the files a held title takes, as its `✓ Updated` line names it. */
type TakenFile = (typeof TAKEN_ORDER)[number];

/** The fields a fill names on its `✓ Updated` line, in the sheet's order. */
const filledNames = (fill: SheetFill): string[] => [
  ...SHEET_FIELDS.filter((field) => fill[field] !== undefined),
  ...FILL_ONLY_FIELDS.filter((field) => fill[field] !== undefined),
  ...(fill.watched === true ? ['watched'] : []),
  ...(fill.favorite === true ? ['favorite'] : []),
];

/**
 * A film or show a run will import, and the **Library folder** it was found
 * under — where its **Source folder** is recorded relative to.
 */
interface Placed<M> {
  match: M;
  libraryFolder: StoredLibraryFolder;
}

/** What a run's placing step answers: the titles its Import phase takes. */
interface PlacedTitles {
  films: Placed<Match>[];
  shows: Placed<ShowMatch>[];
  foundAgain: Placed<FoundAgain>[];
}

/** The library as a run's placing reads it, taken once per pass. */
interface HeldIndex {
  filmsByKey: Map<string, Movie>;
  missing: Map<string, Movie>;
  held: HeldSeries[];
  seriesByKey: Map<string, HeldSeries>;
}

/**
 * A held film with a **Missing video** that evidence found: the film and the
 * found video it takes, placed in the **Import phase** as a match is.
 */
interface FoundAgain {
  movie: Movie;
  video: string;
}

/** One listed **Library folder** as the walk found it: its films and its shows. */
interface WalkedFolder {
  folder: StoredLibraryFolder;
  films: FilmScan[];
  shows: ShowScan[];
  /** The folder's `Meta/` sheet's path, or `null` when it has none. */
  sheet: string | null;
}

/** What the walk both starts take answers: the folders walked, and read. */
interface ListedWalk {
  /** Each folder walked, with its films and its shows. */
  walked: WalkedFolder[];
  /** The folders read: neither skipped as unreachable nor failed mid-read. */
  read: StoredLibraryFolder[];
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
const guessedRow = (name: string): SheetRow => {
  const key = folderKeyOf(name);
  return {
    type: 'Movie',
    folder: name,
    season: null,
    episode: null,
    title: key?.title ?? titleGuess(name),
    year: key?.year ?? yearInName(name),
    endYear: null,
    genres: [],
    director: null,
    cast: [],
    synopsis: null,
    rating: null,
    watched: false,
    airDate: null,
    runtime: null,
    tmdbScore: null,
    tmdbId: null,
    favorite: false,
    video: null,
    subtitles: [],
    poster: null,
    backdrop: null,
    still: null,
  };
};

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
 * The folders a **Title folder** the walk read holds videos in: a film's
 * own, a series' **Season folders**.
 */
const scansOf = (title: WalkedTitle): FolderScan[] =>
  title.kind === 'film' ? [title] : title.seasons;

/**
 * Add to `folders` every folder a scan went through under its Library folder:
 * a film's **Title folder**, or a **Season folder** and its series' Title
 * folder. The Library folder itself does not count.
 */
function addFoldersUnder(
  folders: Set<string>,
  listed: string,
  scan: FolderScan
): void {
  for (let dir = scan.dir; isUnder(listed, dir); dir = dirname(dir)) {
    folders.add(dir);
  }
}

/** What the import domain is composed over. */
export interface ImporterDeps {
  /** The library a run reads what it holds from and adds to. */
  storage: LibraryStorage;
  /** The media domain a copy-mode import copies and reserves folders through. */
  media: Media;
  /** Playback: a found video's runtime, and whether a held video is there. */
  playback: Playback;
  /**
   * The **Library sheet writer**, told which folders' sheets the **Current
   * run** read: held while the run holds their values, released when it
   * closes.
   */
  librarySheet: Pick<LibrarySheet, 'hold' | 'release'>;
  /**
   * The **Layout fill** a **Folder scan** runs after each title it imports
   * or fills, its lines the run's own.
   */
  layoutFill: LayoutFill;
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
 * **Problem**. On a **Folder scan** it also takes the files its folder holds
 * that it lacks (`fillHeldFiles`), and its one `✓ Updated` line names those
 * and its Sheet fills; a held series that took any is not logged _Already in
 * library_.
 *
 * Both runs log every skip the **Sheet reader** reports (a titleless row, an
 * **Unread cell**, a duplicate row) as one Warning line by `skipLine`. A
 * Folder scan's Meta sheet that doesn't read is scanned without, and left as
 * it is.
 *
 * The **Export round trip** (log 61): an upload into a Library folder never
 * scanned places that folder by its own **Library sheet** first, through the
 * Folder scan's one per-folder step (`placeFolder`), so the uploaded rows
 * meet its titles as held ones and an older Export never erases the newer
 * sheet; still one run, one complete line, one review. A row meets its
 * folder by **Folder key** folded (`sameFolderKey`), so a folder a Mac named
 * in NFD matches a row typed in NFC, and its path cells reach that folder's
 * files under the name on disk. Each **Doubled place** the walk finds is one
 * **Layout warning** line, and the scan imports the file read.
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
  librarySheet,
  layoutFill,
}: ImporterDeps): Importer {
  let run: ImportRun | null = null;
  /** The Library folders whose `Meta/` sheet the **Current run** read, held. */
  const heldSheets = new Set<string>();
  /**
   * Hold a Library folder's sheet until the run closes, so its sheet catches
   * up then, not in review.
   */
  const holdSheet = (folderId: string): void => {
    heldSheets.add(folderId);
    librarySheet.hold(folderId);
  };
  /** Release every folder the run held: the run has closed. */
  const releaseSheets = (): void => {
    for (const folderId of heldSheets) {
      librarySheet.release(folderId);
    }
    heldSheets.clear();
  };
  /** The run's **Library folders**: the only places a found file may be. */
  let listedPaths: string[] = [];
  /** What the run knew when it filed each **Problem**, by the problem's id. */
  const sources = new Map<string, ProblemSource>();
  /**
   * Each `differs` **Problem**'s held title and the sheet's side of each
   * difference — what _Apply choices_ writes from.
   */
  const differing = new Map<string, Differing>();
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
   * The **Layout fill** run over one title a scan imported or filled: each
   * file it writes one `↓` line, a folder it can't write one Warning line.
   */
  const fillTitleFolder = async (
    current: ImportRun,
    titleId: string
  ): Promise<void> => {
    const { lines } = await layoutFill.fill(titleId);
    for (const line of lines) {
      log(current, line.text, line.kind);
    }
  };

  /**
   * A placed title's `success` line, worded by the run's **Import mode** —
   * `✓ Linked` under `link`, `✓ Imported` under `copy` — the name in the
   * same column either way.
   */
  const logPlaced = (current: ImportRun, label: string): void => {
    log(
      current,
      current.mode === 'link'
        ? `✓ Linked     ${label}`
        : `✓ Imported   ${label}`,
      'success'
    );
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
   * it. A film through `updateMovie`, its TMDB rating through `enrichMovie`,
   * its Watched mark through `markWatched`; a series through `enrichSeries`,
   * its rating through `setSeriesRating`; a heart through `setFavorite` or
   * `setSeriesFavorite`. An empty patch is never written.
   */
  const writeSheetFill = ({ kind, id }: HeldTitle, fill: SheetFill): void => {
    if (kind === 'movie') {
      const patch = movieSheetPatch(fill);
      if (Object.keys(patch).length > 0) {
        storage.updateMovie(id, patch);
      }
      if (fill.tmdbScore !== undefined) {
        storage.enrichMovie(id, { tmdbScore: fill.tmdbScore });
      }
      if (fill.watched === true) {
        storage.markWatched(id);
      }
      if (fill.favorite === true) {
        storage.setFavorite(id, true);
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
    if (fill.favorite === true) {
      storage.setSeriesFavorite(id, true);
    }
  };

  /**
   * A held series' Episode rows' **Sheet fills**: each row's Watched marking
   * the held episode it names by season and number, when that one is
   * unwatched. Answers the `SxxEyy` of each episode marked.
   */
  const fillHeldEpisodes = (seriesId: string, rows: SheetRow[]): string[] => {
    const detail = storage.getSeriesDetail(seriesId);
    if (detail === null) {
      return [];
    }
    const marked: string[] = [];
    for (const row of rows) {
      const episode = detail.seasons
        .flatMap((season) => season.episodes)
        .find(
          (each) => each.season === row.season && each.number === row.episode
        );
      if (episode === undefined) {
        continue;
      }
      if (marksWatched(episode.status, row)) {
        storage.setEpisodeWatched(episode.id, true);
        marked.push(
          `${spellEpisodeTag(episode.season, episode.number)} watched`
        );
      }
    }
    return marked;
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
   * A held title's `✓ Updated` line, naming what a write took (its **Sheet
   * fills**, or the `video` a **Found again** film took); nothing written
   * when it took nothing. Answers whether it took any.
   */
  const logUpdated = (
    current: ImportRun,
    { title, year }: Pick<SheetRow, 'title' | 'year'>,
    names: readonly string[]
  ): boolean => {
    if (names.length === 0) {
      return false;
    }
    log(
      current,
      `✓ Updated    ${titleWithYear(title, year)} — ${names.join(', ')}`,
      'success'
    );
    return true;
  };

  /**
   * A held title's **Sheet fills** written during the run, through
   * {@link writeSheetFill} — never a field raised as a difference, which is
   * filed instead, and never its title. Answers the names its `✓ Updated`
   * line gives what it took.
   */
  const writeHeldFill = (
    current: ImportRun,
    held: HeldTitle,
    row: SheetRow,
    genres: GenreReader,
    episodeRows: SheetRow[] = []
  ): string[] => {
    const movie = held.kind === 'movie' ? storage.getMovie(held.id) : null;
    const series = held.kind === 'series' ? storage.getSeries(held.id) : null;
    const values =
      movie !== null
        ? heldValues(movie)
        : series !== null
          ? heldSeriesValues(series)
          : null;
    if (values === null) {
      return [];
    }
    const pooled = pooledRow(row, genres, current);
    const { fill, differences, proposed } = planSheetFields(
      values,
      pooled,
      held.kind
    );
    fileDiffers(current, pooled, { ...held, proposed }, differences);
    writeSheetFill(held, fill);
    const episodes =
      held.kind === 'series' ? fillHeldEpisodes(held.id, episodeRows) : [];
    return [...filledNames(fill), ...episodes];
  };

  /**
   * {@link writeHeldFill}, and its `✓ Updated` line: what took nothing is
   * **Already in library** once the caller knows nothing else was added
   * either. Answers whether it took any.
   */
  const fillHeld = (
    current: ImportRun,
    held: HeldTitle,
    row: SheetRow,
    genres: GenreReader,
    episodeRows: SheetRow[] = []
  ): boolean =>
    logUpdated(
      current,
      row,
      writeHeldFill(current, held, row, genres, episodeRows)
    );

  /**
   * The importer's one decision between link and copy, by the **Placed
   * video** rule: under the **Import mode** `link`, the **Linked video** where
   * it lies in its **Library folder**; under `copy`, the file copied `into`
   * managed storage. Everything a run imports beside the video is copied
   * either way.
   */
  const placeVideo = async (
    current: ImportRun,
    libraryFolder: StoredLibraryFolder,
    file: string,
    into: string,
    signal: AbortSignal
  ): Promise<StoredVideo> =>
    placeFoundVideo([libraryFolder], file, current.mode) ?? {
      videoPath: await media.copyIn(into, file, signal),
      videoFolderId: null,
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
      const video = await placeVideo(
        current,
        libraryFolder,
        scan.videos[0],
        folder,
        signal
      );
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
      // The probe's runtime wins; the sheet's stands in when it answers none.
      const runtime = derivedRuntime(playback, video) ?? row.runtime;
      const genres = knownGenres(row.genres, genreNames, current);

      const movie: NewMovie = {
        title: row.title,
        ...video,
        watched: row.watched,
        ...(row.favorite ? { isFavorite: true } : {}),
        ...(row.year === null ? {} : { year: row.year }),
        ...(row.tmdbId === null ? {} : { tmdbId: row.tmdbId }),
        ...(row.tmdbScore === null ? {} : { tmdbScore: row.tmdbScore }),
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
      const source = filmSourceOf(libraryFolder, scan);
      storage.setSourceFolder(
        added.id,
        source.folderId,
        source.sourceFolder,
        source.sourceFile
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
   * A held film's art copy: a copy that fails is one **Warning line**, never
   * a Problem, and the run goes on; a cancel copies nothing more.
   */
  const heldArtCopy =
    (current: ImportRun, title: string, signal: AbortSignal): ArtCopy =>
    async (into, file) => {
      if (file === null || signal.aborted) {
        return undefined;
      }
      try {
        return await media.copyIn(into, file, signal);
      } catch (error) {
        if (!signal.aborted) {
          const reason = error instanceof Error ? error.message : String(error);
          log(
            current,
            `⚠ ${title}: couldn't copy ${basename(file)}: ${reason}`,
            'warning'
          );
        }
        return undefined;
      }
    };

  /** Each track copied in `into` by `copy`, a failed copy left out. */
  const copyTracks = async (
    into: string,
    tracks: readonly SubtitleFound[],
    copy: ArtCopy
  ): Promise<NewSubtitle[]> => {
    const copied: NewSubtitle[] = [];
    for (const track of tracks) {
      const path = await copy(into, track.path);
      if (path !== undefined) {
        copied.push({ path, language: track.language });
      }
    }
    return copied;
  };

  /**
   * One empty place filled: when the title `has` nothing there, `file` copied
   * `into` by `copy` and, when it copied, its path written. Answers whether
   * it took anything.
   */
  const fillEmpty = async (
    has: string | null,
    into: string,
    file: string | null,
    copy: ArtCopy,
    write: (path: string) => void
  ): Promise<boolean> => {
    if (has !== null) {
      return false;
    }
    const path = await copy(into, file);
    if (path === undefined) {
      return false;
    }
    write(path);
    return true;
  };

  /**
   * The tracks of `found` that `held` lacks (`lackingTracks`), copied `into`
   * by `copy` and, when any copied, written. Answers whether it took any.
   */
  const takeTracks = async (
    held: readonly { language: string }[],
    found: readonly SubtitleFound[],
    into: string,
    copy: ArtCopy,
    write: (tracks: NewSubtitle[]) => void
  ): Promise<boolean> => {
    const tracks = await copyTracks(into, lackingTracks(held, found), copy);
    if (tracks.length === 0) {
      return false;
    }
    write(tracks);
    return true;
  };

  /**
   * A held title's empty places filled from its Title folder's read, never
   * replacing what it has, and filing no **Problem**. A film takes its
   * **Poster** and **Backdrop** (its **Path cells** already read into the
   * places the read left empty); a series its **Poster**, **Backdrop**, each
   * season's **Season poster** and each held episode's **Still**, run after
   * the run's new episodes are in so a season the same run adds is filled on
   * that scan. A film, and each held episode, takes each track of a language
   * it holds none of, so a track the **Layout fill** wrote out is never read
   * back as a second copy.
   *
   * Answers what the title took, as its `✓ Updated` line names it: `poster`,
   * `backdrop`, `season posters`, `stills`, `subtitles`.
   */
  const fillHeldFiles = async (
    held: HeldFiles,
    into: string,
    copyArt: ArtCopy
  ): Promise<TakenFile[]> => {
    const taken = new Set<TakenFile>();
    if (held.kind === 'movie') {
      const movie = storage.getMovie(held.id);
      if (movie === null) {
        return [];
      }
      const { scan } = held;
      if (
        await fillEmpty(movie.posterPath, into, scan.poster, copyArt, (path) =>
          storage.enrichMovie(held.id, { posterPath: path })
        )
      ) {
        taken.add('poster');
      }
      if (
        await fillEmpty(
          movie.backdropPath,
          into,
          scan.backdrop,
          copyArt,
          (path) => storage.enrichMovie(held.id, { backdropPath: path })
        )
      ) {
        taken.add('backdrop');
      }
      if (
        await takeTracks(
          movie.subtitles,
          scan.subtitles,
          into,
          copyArt,
          (tracks) => storage.addMovieSubtitles(held.id, tracks)
        )
      ) {
        taken.add('subtitles');
      }
      return TAKEN_ORDER.filter((name) => taken.has(name));
    }
    const { show } = held;
    const detail = storage.getSeriesDetail(held.id);
    if (detail === null) {
      return [];
    }
    const { series, seasons } = detail;
    if (
      await fillEmpty(series.posterPath, into, show.poster, copyArt, (path) =>
        storage.enrichSeries(series.id, { posterPath: path })
      )
    ) {
      taken.add('poster');
    }
    if (
      await fillEmpty(
        series.backdropPath,
        into,
        show.backdrop,
        copyArt,
        (path) => storage.enrichSeries(series.id, { backdropPath: path })
      )
    ) {
      taken.add('backdrop');
    }
    for (const season of seasons) {
      const seasonFolder = media.seasonFolder(into, season.number);
      if (
        await fillEmpty(
          season.posterPath,
          seasonFolder,
          scannedSeasonPoster(show, season.number),
          copyArt,
          (path) => storage.setSeasonPoster(series.id, season.number, path)
        )
      ) {
        taken.add('season posters');
      }
      for (const episode of season.episodes) {
        if (
          await fillEmpty(
            episode.stillPath,
            seasonFolder,
            scannedStill(show, episode.season, episode.number),
            copyArt,
            (path) =>
              storage.enrichEpisode(episode.id, {
                stillPath: path,
                stillSource: 'picked',
              })
          )
        ) {
          taken.add('stills');
        }
        if (
          await takeTracks(
            episode.subtitles,
            scannedTracks(show, episode.season, episode.number),
            seasonFolder,
            copyArt,
            (tracks) => storage.addEpisodeSubtitles(episode.id, tracks)
          )
        ) {
          taken.add('subtitles');
        }
      }
    }
    return TAKEN_ORDER.filter((name) => taken.has(name));
  };

  /**
   * A held show's `✓ Updated` line, naming its **Sheet fills** and the files
   * it `took`; **Already in library** when it took nothing and the run copies
   * none of its episodes.
   */
  const logHeldShow = (
    current: ImportRun,
    match: ShowMatch,
    took: readonly string[]
  ): void => {
    if (
      !logUpdated(current, match.row, [...match.filled, ...took]) &&
      match.episodes.length === 0
    ) {
      logAlreadyHeld(current, match.row);
    }
  };

  /**
   * Import one matched show as a **Series**: one **Series folder** reserved
   * from the row's title and year, every episode copied under its
   * `season-NN/`, its runtime derived after the copy. Each episode is one item
   * on the bar — the current item and its `success` line read `Show · SnnEnn`
   * — and is written as it lands, so a cancel keeps the episodes already
   * copied, as it keeps the films. The series is written with its first
   * episode, from the row: title, year, genres, synopsis, rating, cast, TMDB
   * id, TMDB rating and heart, its _Director_ the creator. Each episode takes
   * its Episode row's Watched (an `In progress` one starts unwatched). An
   * episode whose copy fails is remembered and the show goes on, and the
   * show's failures are one `failed` Problem titled with it — the count and
   * the first error, its detail the failed episodes, naming the series when
   * one is held; a show that ends with no episode leaves no folder behind,
   * and one with none to import reserves none. Each episode's subtitles are
   * copied in beside its video; a subtitle that begins with no episode's stem
   * is a **Warning line**. The show's art is copied in whatever the **Import
   * mode**: a new series' **Poster** and **Backdrop** with it, each **Season
   * poster** once its season holds an episode, each **Still** on its episode
   * as a picked one. An art copy that fails is filed on the show's one
   * `failed` Problem.
   *
   * A show **Already in library** joins the series it matched: only its
   * `episodes` — those with no held `(season, episode)` — are copied, into
   * the Series folder the held episodes already live in. Once the run's new
   * episodes are in, its empty art is filled from the scan and each held
   * episode takes the tracks of languages it lacks (`fillHeldFiles`), so a
   * season this run adds takes its **Season poster**; nothing is replaced.
   * What it took is named on its `✓ Updated` line; it is _Already in
   * library_ only when it took nothing and copies nothing.
   *
   * Answers the series' id, or `null` when nothing was made or held.
   */
  const importShow = async (
    match: ShowMatch,
    genreNames: GenreReader,
    current: ImportRun,
    signal: AbortSignal,
    libraryFolder: StoredLibraryFolder
  ): Promise<string | null> => {
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
    // Every episode whose copy threw, filed as the show's one `failed` row.
    const failures: { video: string; reason: string }[] = [];
    // Every piece of art whose copy threw, filed on that same row.
    const artFailures: { file: string; reason: string }[] = [];
    // The seasons whose Season poster this run has set.
    const postered = new Set<number>();

    /**
     * One piece of the show's art copied `into` managed storage, or
     * `undefined` when there is none or its copy threw: remembered, and the
     * show goes on. A cancel is no failure, and stops the show.
     */
    const copyArt: ArtCopy = async (into, file) => {
      if (file === null) {
        return undefined;
      }
      try {
        return await media.copyIn(into, file, signal);
      } catch (error) {
        signal.throwIfAborted();
        artFailures.push({
          file,
          reason: error instanceof Error ? error.message : String(error),
        });
        return undefined;
      }
    };

    // A held series with no Series folder takes no files, so with nothing new
    // to copy it takes only what its Sheet fills gave it.
    if (episodes.length === 0 && (held === null || held.folder === null)) {
      if (held !== null) {
        logHeldShow(current, match, []);
      }
      return held?.series.id ?? null;
    }
    const folder = held?.folder ?? media.reserveFolder(row.title, row.year);
    let series: Series | null = held?.series ?? null;

    for (const episode of episodes) {
      // A turn of the loop per episode, as per film: see `importPlaced`.
      await nextTurn();
      const label = episodeLabel(row.title, episode);
      current.currentItem = label;
      try {
        const into = media.seasonFolder(folder, episode.season);
        const video = await placeVideo(
          current,
          libraryFolder,
          episode.video,
          into,
          signal
        );
        const subtitles: NewSubtitle[] = [];
        for (const track of episode.subtitles) {
          subtitles.push({
            path: await media.copyIn(into, track.path, signal),
            language: track.language,
          });
        }
        const stillPath = await copyArt(into, episode.still);
        signal.throwIfAborted();
        const sheetEpisode = match.sheetEpisodes.find(
          (entry) =>
            entry.season === episode.season && entry.episode === episode.episode
        );
        // The probe's runtime wins; the sheet's stands in when it answers none.
        const runtime =
          derivedRuntime(playback, video) ?? sheetEpisode?.runtime ?? null;
        const title =
          sheetEpisode !== undefined && sheetEpisode.title !== ''
            ? sheetEpisode.title
            : episode.title;
        const airDate = sheetEpisode?.airDate ?? null;

        if (series === null) {
          const genres = knownGenres(row.genres, genreNames, current);
          const posterPath = await copyArt(folder, show.poster);
          const backdropPath = await copyArt(folder, show.backdrop);
          const input: NewSeries = {
            title: row.title,
            ...(row.year === null ? {} : { year: row.year }),
            ...(row.tmdbId === null ? {} : { tmdbId: row.tmdbId }),
            ...(row.tmdbScore === null ? {} : { tmdbScore: row.tmdbScore }),
            ...(row.favorite ? { isFavorite: true } : {}),
            ...(row.endYear === null ? {} : { endYear: row.endYear }),
            ...(row.director === null ? {} : { creator: row.director }),
            ...(row.synopsis === null ? {} : { synopsis: row.synopsis }),
            ...(row.rating === null ? {} : { rating: row.rating }),
            ...(row.cast.length === 0 ? {} : { cast: row.cast }),
            ...(genres.length === 0 ? {} : { genres }),
            ...(posterPath === undefined ? {} : { posterPath }),
            ...(backdropPath === undefined ? {} : { backdropPath }),
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
          ...video,
          sourceFile: sourceFileOf(show.dir, episode.video),
          ...(title === null ? {} : { title }),
          ...(airDate === null ? {} : { airDate }),
          ...(runtime === null ? {} : { runtimeMinutes: runtime }),
          ...(sheetEpisode?.watched === true ? { watched: true } : {}),
          ...(subtitles.length === 0 ? {} : { subtitles }),
          ...(stillPath === undefined ? {} : { stillPath }),
        });
        // A new series' Season poster, once its season holds an episode.
        if (held === null && !postered.has(episode.season)) {
          postered.add(episode.season);
          const seasonPoster = await copyArt(
            into,
            scannedSeasonPoster(show, episode.season)
          );
          if (seasonPoster !== undefined) {
            storage.setSeasonPoster(series.id, episode.season, seasonPoster);
          }
        }
        logPlaced(current, label);
      } catch (error) {
        if (signal.aborted) {
          break;
        }
        failures.push({
          video: episode.video,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      if (signal.aborted) {
        break;
      }
      current.done += 1;
    }

    // A held series' files are taken once the run's new episodes are in, so
    // a season this run adds takes its Season poster on this scan.
    if (held !== null && held.folder !== null && !signal.aborted) {
      let taken: TakenFile[] = [];
      try {
        taken = await fillHeldFiles(
          { kind: 'series', id: held.series.id, show },
          held.folder,
          copyArt
        );
      } catch (error) {
        if (!signal.aborted) {
          throw error;
        }
      }
      if (!signal.aborted) {
        logHeldShow(current, match, taken);
      }
    }

    if (failures.length > 0 || artFailures.length > 0) {
      file(
        current,
        problemOf(
          'failed',
          row.title,
          failures.length > 0
            ? failedShowReason(failures.length, failures[0].reason)
            : failedArtReason(artFailures[0].file, artFailures[0].reason),
          series === null ? undefined : { seriesId: series.id }
        ),
        {
          row,
          folder: {
            ...asMatchable(show),
            videos: inNameOrder(failures.map(({ video }) => video)),
          },
          candidates: [],
        }
      );
    }
    if (series === null) {
      media.removeFolder(folder);
    }
    return series?.id ?? null;
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
   * The folder a held title's files live in (its recorded **Media folder**,
   * opened; a series' **Series folder**), or `null` when none is recorded or
   * it is not there.
   */
  const heldFolder = (kind: HeldTitle['kind'], id: string): string | null => {
    const recorded = storage.mediaFolderOf(kind, id);
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
    held: HeldSeries | null,
    sheetEpisodes: SheetRow[] = []
  ): ShowMatch => {
    return {
      row,
      show,
      held,
      sheetEpisodes,
      episodes:
        held === null
          ? show.episodes
          : show.episodes.filter(
              (episode) =>
                !held.sourceFiles.has(sourceFileOf(show.dir, episode.video)) &&
                !held.tags.has(spellEpisodeTag(episode.season, episode.episode))
            ),
      unplaced: null,
      filled: [],
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
        folder: heldFolder('series', series.id),
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
   * Every film the library holds, by key and year, read once per run.
   */
  const heldFilmsByKey = (): Map<string, Movie> =>
    new Map(
      storage
        .listMovies({ sort: 'a-z' })
        .map((movie: Movie) => [filmKey(movie.title, movie.year), movie])
    );

  /**
   * Every held film whose video is a **Missing video**, by id, read once per
   * run as `heldFilmsByKey` is. A film **Found again** comes off, so it is
   * found again at most once per run.
   */
  const missingFilms = (filmsByKey: Map<string, Movie>): Map<string, Movie> =>
    new Map(
      [...filmsByKey.values()]
        .filter((movie) => playback.videoFile(movie).kind === 'missing')
        .map((movie) => [movie.id, movie])
    );

  /**
   * The **Missing video** rule: the held film whose Missing video has the file
   * name of one of these found videos, when exactly one missing film has it;
   * `null` for none, and for two or more.
   */
  const heldByMissingVideo = (
    missing: Map<string, Movie>,
    videos: readonly string[]
  ): string | null => {
    for (const video of videos) {
      const name = basename(video);
      const named = [...missing.values()].filter(
        (movie) => basename(movie.videoPath) === name
      );
      if (named.length === 1) {
        return named[0].id;
      }
    }
    return null;
  };

  /**
   * A held film's **Found again** check: when its video is a **Missing
   * video**, the found video it takes (the one with its file's name, else the
   * folder's only one), and the film comes off `missing`. `null` for a film
   * whose video is there, or a folder that gives no one video.
   */
  const foundAgainOf = (
    missing: Map<string, Movie>,
    heldId: string,
    scan: FilmScan
  ): FoundAgain | null => {
    const movie = missing.get(heldId);
    if (movie === undefined) {
      return null;
    }
    const video =
      scan.videos.find(
        (found) => basename(found) === basename(movie.videoPath)
      ) ?? (scan.videos.length === 1 ? scan.videos[0] : undefined);
    if (video === undefined) {
      return null;
    }
    missing.delete(heldId);
    return { movie, video };
  };

  /**
   * The film the **Title key** holds where a found video is at stake: one
   * still in the run's `missing` map is passed over, so the found video is
   * imported; an `unreachable` one still holds, and so does one **Found
   * again** earlier in the run, which has come off the map.
   */
  const heldByKey = (
    filmsByKey: Map<string, Movie>,
    missing: Map<string, Movie>,
    row: SheetRow
  ): string | null => {
    const movie = filmsByKey.get(filmKey(row.title, row.year));
    if (movie === undefined || missing.has(movie.id)) {
      return null;
    }
    return movie.id;
  };

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
    scan: FilmScan,
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
      // Its new problem, under an id of its own, as a failed copy's is.
      return redraw(
        problemOf(
          'no-video',
          row.title,
          scan.videos.length === 0
            ? MATCH_REASON.noVideo
            : MATCH_REASON.manyVideos
        ),
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
   * The **Import phase** both runs end in: the placed titles imported by
   * {@link importTitles}, and the completion line — `✓ Import complete` for
   * a sheet, `✓ Scan complete` for a **Folder scan**. `earlier` counts the
   * titles a sheet run already imported from its unscanned folders' own
   * sheets. A cancel stops it where it is, and the run never reaches review.
   * Reaching review marks every folder the walk `read` as scanned, in the
   * same step.
   */
  const importPlaced = async (
    current: ImportRun,
    placed: PlacedTitles,
    read: StoredLibraryFolder[],
    verb: 'Import' | 'Scan',
    signal: AbortSignal,
    genres: GenreReader,
    earlier = 0
  ): Promise<void> => {
    const imported = await importTitles(current, placed, verb, signal, genres);
    if (imported === null) {
      return;
    }

    current.currentItem = '';
    log(
      current,
      `✓ ${verb} complete: ${count(earlier + imported)} imported, ${count(current.problems.length)} need attention.`,
      'success'
    );
    storage.markScanned(
      read.map((folder) => folder.id),
      new Date().toISOString()
    );
    current.phase = 'review';
  };

  /**
   * Each placed film, then each placed show, imported against the folder it
   * was found under, on the run's progress bar. A sheet's films are named by
   * its rows (`Import`); a scan's by their folders (`Scan`). Answers how many
   * titles were imported, or `null` once the run was cancelled.
   */
  const importTitles = async (
    current: ImportRun,
    { films, shows, foundAgain }: PlacedTitles,
    verb: 'Import' | 'Scan',
    signal: AbortSignal,
    genres: GenreReader
  ): Promise<number | null> => {
    // Only new imports count: a held show taking episodes is not one, nor a
    // film found again.
    current.matched +=
      films.length + shows.filter(({ match }) => match.held === null).length;
    // Each episode is one item on the bar, as each film is.
    current.total +=
      films.length +
      foundAgain.length +
      shows.reduce((sum, { match }) => sum + match.episodes.length, 0);
    current.phase = 'importing';

    for (const { match, libraryFolder } of foundAgain) {
      await nextTurn();
      current.currentItem = match.movie.title;
      await placeFoundAgain(current, match, libraryFolder, signal);
      if (signal.aborted) {
        return null;
      }
      current.done += 1;
    }

    let imported = 0;
    for (const { match, libraryFolder } of films) {
      // A turn of the loop before each title. A Link run awaits nothing for a
      // title with no art or subtitles, and its runtime is a synchronous
      // probe, so without it no poll is answered until the run is in review:
      // the Running step would sit frozen on an empty Activity log.
      await nextTurn();
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
        return null;
      }
      if (added !== null) {
        imported += 1;
        logPlaced(current, match.row.title);
        warnOfMissingFiles(current, match);
        if (verb === 'Scan') {
          await fillTitleFolder(current, added.id);
        }
      }
      current.done += 1;
    }

    for (const { match, libraryFolder } of shows) {
      const seriesId = await importShow(
        match,
        genres,
        current,
        signal,
        libraryFolder
      );
      if (signal.aborted) {
        return null;
      }
      // A new series is one title imported; a held one gaining episodes none.
      if (seriesId !== null && match.held === null) {
        imported += 1;
      }
      if (seriesId !== null && verb === 'Scan') {
        await fillTitleFolder(current, seriesId);
      }
    }

    return imported;
  };

  /**
   * The walk both starts take: one `Scanning   <path>` line per listed
   * **Library folder**, in the order given, then each folder walked — one that
   * cannot be reached skipped with a **Warning line**, the run going on over
   * the others — and the found line. Each folder answers its films and its
   * shows, so every title is placed against the folder
   * it was found under. Beside them, the folders it `read`. `null` once the
   * run was cancelled mid-walk.
   */
  const walkListed = async (
    current: ImportRun,
    folders: StoredLibraryFolder[],
    signal: AbortSignal
  ): Promise<ListedWalk | null> => {
    for (const folder of folders) {
      log(current, `Scanning   ${folder.path}`, 'scan');
    }
    const walked: WalkedFolder[] = [];
    const read: StoredLibraryFolder[] = [];
    let found = 0;
    let leftOut = 0;
    const sheets = new Map<StoredLibraryFolder, string>();
    // Every folder the walk went through, by the found line's rule, before
    // left-out videos come off: `run.found` follows it as the walk goes.
    const walkedFolders = new Set<string>();
    for (const folder of folders) {
      if ((await readableFolder(folder.path)) !== 'readable') {
        log(current, `⚠ Can't reach ${folder.path}, skipped`, 'warning');
        continue;
      }
      let titles: WalkedTitle[] = [];
      try {
        const walk = await walkLibraryFolder(
          folder.path,
          (title) => {
            for (const scan of scansOf(title)) {
              addFoldersUnder(walkedFolders, folder.path, scan);
            }
            current.found = walkedFolders.size;
            current.currentItem = title.dir;
          },
          (dir) => {
            log(current, `⚠ Could not read ${dir}, skipped`, 'warning');
          }
        );
        for (const warning of walk.warnings) {
          log(current, warning, 'warning');
        }
        titles = walk.titles;
        if (walk.sheet !== null) {
          sheets.set(folder, walk.sheet);
        }
        read.push(folder);
        holdSheet(folder.id);
      } catch {
        // A folder that stopped being readable mid-walk: what was found is
        // what there is, and the run still reaches review.
      }
      if (signal.aborted) {
        return null;
      }
      for (const scan of titles.flatMap(scansOf)) {
        addFoldersUnder(walkedFolders, folder.path, scan);
      }
      current.found = walkedFolders.size;
      const out = storage.leftOut(folder.id);
      const films: FilmScan[] = [];
      const shows: ShowScan[] = [];
      for (const title of titles) {
        if (title.kind === 'film') {
          const kept = withoutLeftOut(folder, out, [title]);
          leftOut += kept.skipped;
          films.push(...kept.scans);
          continue;
        }
        const kept = withoutLeftOut(folder, out, title.seasons);
        leftOut += kept.skipped;
        if (kept.scans.length > 0) {
          shows.push(numberShow({ ...title, seasons: kept.scans }));
        }
      }
      // Titles, not folders: every film and every show, held or new.
      found += films.length + shows.length;
      walked.push({
        folder,
        films,
        shows,
        sheet: sheets.get(folder) ?? null,
      });
    }

    log(
      current,
      `✓ Found ${count(found)} titles across ${count(walkedFolders.size)} folders. Starting import…`,
      'success'
    );
    if (leftOut > 0) {
      log(
        current,
        `· Left out ${leftOut} ${leftOut === 1 ? 'video' : 'videos'} you deleted earlier`,
        'info'
      );
    }
    return { walked, read };
  };

  /**
   * One walked folder's scans with every **Left-out video** taken out before
   * any match or held check: a folder left with no video goes whole, so a
   * Show folder all left out makes no series. Answers how many were skipped.
   */
  const withoutLeftOut = <T extends FolderScan>(
    folder: StoredLibraryFolder,
    out: ReadonlySet<string>,
    scans: T[]
  ): { scans: T[]; skipped: number } => {
    if (out.size === 0) {
      return { scans, skipped: 0 };
    }
    let skipped = 0;
    const kept: T[] = [];
    for (const scan of scans) {
      const videos = scan.videos.filter(
        (video) => !out.has(spellLinkedVideo(folder.path, video))
      );
      skipped += scan.videos.length - videos.length;
      if (videos.length === scan.videos.length) {
        kept.push(scan);
      } else if (videos.length > 0) {
        kept.push({ ...scan, videos });
      }
    }
    return { scans: kept, skipped };
  };

  /**
   * The film the library already holds for a **Source folder**, by the
   * **Already in library** rules in order: the folder on record first,
   * whatever its title now says (a **Collection folder** film by its Source
   * file), then `heldByVideo`, then `heldByMissingVideo`, then `heldByKey`,
   * the title key and year the row or the folder gives, passing over a
   * **Missing video**.
   */
  const heldFilm = (
    filmsByKey: Map<string, Movie>,
    missing: Map<string, Movie>,
    folder: StoredLibraryFolder,
    scan: FilmScan,
    row: SheetRow
  ): string | null => {
    const source = filmSourceOf(folder, scan);
    return (
      storage.titleAt(
        source.folderId,
        source.sourceFolder,
        source.sourceFile
      ) ??
      heldByVideo(storage.titleHolding, folder, scan.videos, 'movie') ??
      heldByMissingVideo(missing, scan.videos) ??
      heldByKey(filmsByKey, missing, row)
    );
  };

  /**
   * Place one film **Found again** by the run's **Import mode** (in Copy,
   * into its **Media folder**, one reserved and recorded when that is gone),
   * derive its runtime again, and write only its video columns, then the
   * `✓ Updated` line naming `video`. A copy that throws leaves no reserved
   * folder behind and is a **Warning line**; a cancel, nothing.
   */
  const placeFoundAgain = async (
    current: ImportRun,
    { movie, video: found }: FoundAgain,
    libraryFolder: StoredLibraryFolder,
    signal: AbortSignal
  ): Promise<void> => {
    let reserved: string | null = null;
    try {
      let video = placeFoundVideo([libraryFolder], found, current.mode);
      if (video === null) {
        const into =
          heldFolder('movie', movie.id) ??
          (reserved = media.reserveFolder(movie.title, movie.year));
        video = {
          videoPath: await media.copyIn(into, found, signal),
          videoFolderId: null,
        };
      }
      signal.throwIfAborted();
      const runtime = derivedRuntime(playback, video);
      storage.updateMovie(movie.id, {
        ...video,
        ...(runtime === null ? {} : { runtimeMinutes: runtime }),
        ...(reserved === null ? {} : { mediaFolder: basename(reserved) }),
      });
      logUpdated(current, movie, ['video']);
    } catch (error) {
      if (reserved !== null) {
        media.removeFolder(reserved);
      }
      if (!signal.aborted) {
        const reason = error instanceof Error ? error.message : String(error);
        log(
          current,
          `⚠ ${titleWithYear(movie.title, movie.year)}: couldn't copy the video file: ${reason}`,
          'warning'
        );
      }
    }
  };

  /**
   * The same rules for a **Show folder**, over the held series: the folder
   * on record, then `heldByVideo` over its episode videos, found in their
   * list; then the key and year in their map. A series has no Missing video
   * rule.
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
    const holder = heldByVideo(
      storage.titleHolding,
      folder,
      show.episodes.map((episode) => episode.video),
      'series'
    );
    return (
      held.find((entry) => entry.series.id === atFolder) ??
      held.find((entry) => entry.series.id === holder) ??
      seriesByKey.get(filmKey(row.title, row.year)) ??
      null
    );
  };

  /**
   * A Resolve's Found video in a Link run → the **Linked video** it records,
   * relative to its listed **Library folder** with forward slashes; `null` in
   * a Copy run, for a picked file, or for a path under no listed folder.
   */
  const linkedVideo = (
    current: ImportRun,
    slot: ResolveFile
  ): StoredVideo | null => {
    if (!('found' in slot)) {
      return null;
    }
    return placeFoundVideo(storage.libraryFolders(), slot.found, current.mode);
  };

  /** A held film linked to where it was found. */
  const linkHeld = (
    heldId: string,
    folder: StoredLibraryFolder,
    scan: FilmScan
  ): void => {
    const source = filmSourceOf(folder, scan);
    storage.setSourceFolder(
      heldId,
      source.folderId,
      source.sourceFolder,
      source.sourceFile
    );
  };

  /**
   * A sheet run: every listed folder walked, each **Sheet row** naming its
   * folder through `matchRows`, in whichever listed folder it lies. A folder
   * never scanned that holds a **Library sheet** other than the upload is
   * first placed and imported by its own sheet, as a **Folder scan** would,
   * so the uploaded rows meet its titles as held ones: a **Sheet fill** for a
   * cell a title lacks, a **Sheet difference** for one the two sheets
   * disagree on (the **Export round trip**).
   */
  const execute = async (
    current: ImportRun,
    { rows, skips }: SheetRead,
    sheetPath: string,
    folders: StoredLibraryFolder[],
    signal: AbortSignal
  ): Promise<void> => {
    const genres = genreReader();

    const walk = await walkListed(current, folders, signal);
    if (walk === null) {
      return;
    }
    const { walked, read } = walk;
    for (const skip of skips) {
      log(current, skipLine(skip), 'warning');
    }

    let earlier = 0;
    // The uploaded sheet is read once: a folder whose own sheet it is was
    // read by the upload already.
    const unscanned = walked.filter(
      ({ folder, sheet }) =>
        folder.scannedAt === null &&
        sheet !== null &&
        resolve(sheet) !== resolve(sheetPath)
    );
    if (unscanned.length > 0) {
      const placed = await placeFolders(
        current,
        unscanned,
        heldIndex(),
        genres,
        signal
      );
      if (placed === null) {
        return;
      }
      const imported = await importTitles(
        current,
        placed,
        'Scan',
        signal,
        genres
      );
      if (imported === null) {
        return;
      }
      earlier = imported;
    }

    const filmsByKey = heldFilmsByKey();
    const missing = missingFilms(filmsByKey);
    const held = heldSeriesList();
    const seriesByKey = heldSeriesByKey(held);

    // A show is matched by the film's own rule, over a scan standing for it —
    // and told apart again once matched. Every scan remembers its folder.
    const folderOf = new Map<FilmScan, StoredLibraryFolder>();
    const showOf = new Map<FilmScan, ShowScan>();
    const films: FilmScan[] = [];
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

    // A Movie or Series row names a Title folder; a Season or Episode row is
    // read with the series its Folder key names, never matched on its own.
    const titleRows = rows.filter(isTitleRow);
    const verdicts = matchRows(titleRows, [...films, ...showOf.keys()]);
    const matched: Placed<Match>[] = [];
    const matchedShows: Placed<ShowMatch>[] = [];
    const foundAgain: Placed<FoundAgain>[] = [];
    for (const match of verdicts.matched) {
      const libraryFolder = folderOf.get(match.folder);
      if (libraryFolder === undefined) {
        continue;
      }
      const show = showOf.get(match.folder);
      if (show !== undefined) {
        const joined = showMatch(
          match.row,
          await showWithCells(
            show,
            match.row,
            partRowsOf(rows, match.row.folder)
          ),
          heldShow(held, seriesByKey, libraryFolder, show, match.row),
          episodeRowsOf(rows, match.row.folder)
        );
        if (joined.held !== null) {
          joined.filled = writeHeldFill(
            current,
            { kind: 'series', id: joined.held.series.id },
            match.row,
            genres,
            joined.sheetEpisodes
          );
        }
        matchedShows.push({ match: joined, libraryFolder });
        continue;
      }
      const heldId = heldFilm(
        filmsByKey,
        missing,
        libraryFolder,
        match.folder,
        match.row
      );
      if (heldId !== null) {
        // Already in library: nothing is added, but where it came from is
        // remembered — the backfill for a library imported before this was —
        // and its empty fields take the row's **Sheet fills**. A film whose
        // video is missing is **Found again**, in the Import phase.
        linkHeld(heldId, libraryFolder, match.folder);
        const again = foundAgainOf(missing, heldId, match.folder);
        if (again !== null) {
          foundAgain.push({ match: again, libraryFolder });
        }
        if (
          !fillHeld(
            current,
            { kind: 'movie', id: heldId },
            match.row,
            genres
          ) &&
          again === null
        ) {
          logAlreadyHeld(current, match.row);
        }
        continue;
      }
      matched.push({
        match: {
          ...match,
          folder: await filmWithCells(match.folder, match.row),
        },
        libraryFolder,
      });
    }
    // Every match-time problem is on the snapshot before the first byte is
    // copied: the rows the matcher could not settle, and then the folders no
    // row claimed.
    for (const { kind, reason, row, candidates } of verdicts.problems) {
      // A row for a title held with no folder found is reached by its key and
      // year, and filled.
      const key = filmKey(row.title, row.year);
      const heldId = filmsByKey.get(key)?.id;
      const heldSeries = seriesByKey.get(key);
      const heldTitle: HeldTitle | null =
        heldId !== undefined
          ? { kind: 'movie', id: heldId }
          : heldSeries !== undefined
            ? { kind: 'series', id: heldSeries.series.id }
            : null;
      if (heldTitle !== null) {
        // No folder found, so nothing else is added to say it took nothing.
        if (
          !fillHeld(
            current,
            heldTitle,
            row,
            genres,
            episodeRowsOf(rows, row.folder)
          )
        ) {
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
            ? { ...problem, candidates: candidateFolders(candidates) }
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
      { films: matched, shows: matchedShows, foundAgain },
      read,
      'Import',
      signal,
      genres,
      earlier
    );
  };

  /**
   * A Library folder's `Meta/` sheet, read for a **Folder scan**. The walk
   * already held the folder, so the **Library sheet** keeps the values the run
   * reads until it closes. Each skip the reader reports is a **Warning line**
   * by `skipLine`, as an upload logs it; a sheet that cannot be read is one
   * too: the folder is scanned by its layout alone and the sheet left as it is.
   */
  const readMetaSheet = async (
    current: ImportRun,
    sheetPath: string
  ): Promise<SheetRow[]> => {
    try {
      return await readSheet(await readFile(sheetPath), sheetPath, (skip) => {
        log(current, skipLine(skip), 'warning');
      });
    } catch {
      log(
        current,
        `⚠ Could not read ${sheetPath}, scanned without it and left as it is`,
        'warning'
      );
      return [];
    }
  };

  /**
   * A **Folder scan**: each listed folder walked in the order given, every
   * film and show named by its folder's `Meta/` sheet, through `matchRows`,
   * else off its own folder. **Already in library** is the sheet run's rules
   * in order; a held title a row names takes its **Sheet fills** and files
   * its **Sheet differences**. A held show still gains the episodes it lacks.
   *
   * Every column of a row is read back onto the title it names (its TMDB
   * match and score, its heart, each episode's Watched) and its **Path
   * cells** resolved inside its Title folder, so a library written to its
   * sheet, Factory reset and scanned back is the same library, and the sheet
   * rewritten on close the same sheet: the **Round trip**. A row whose Folder
   * key no Title folder holds is an **Orphaned row**: one Warning line, never
   * a Problem, and the sheet written on close drops it.
   */
  const executeScan = async (
    current: ImportRun,
    folders: StoredLibraryFolder[],
    signal: AbortSignal
  ): Promise<void> => {
    const index = heldIndex();
    const genres = genreReader();

    const walk = await walkListed(current, folders, signal);
    if (walk === null) {
      return;
    }
    const { walked, read } = walk;

    const placed = await placeFolders(current, walked, index, genres, signal);
    if (placed === null) {
      return;
    }

    await importPlaced(current, placed, read, 'Scan', signal, genres);
  };

  /** The library's held films and series, as a placing pass reads them. */
  const heldIndex = (): HeldIndex => {
    const filmsByKey = heldFilmsByKey();
    const held = heldSeriesList();
    return {
      filmsByKey,
      missing: missingFilms(filmsByKey),
      held,
      seriesByKey: heldSeriesByKey(held),
    };
  };

  /**
   * Each walked folder placed in order (`placeFolder`), their titles gathered
   * into one for the Import phase: the Folder scan's whole walk, the sheet
   * run's unscanned folders. `null` once the run was cancelled.
   */
  const placeFolders = async (
    current: ImportRun,
    walked: readonly WalkedFolder[],
    index: HeldIndex,
    genres: GenreReader,
    signal: AbortSignal
  ): Promise<PlacedTitles | null> => {
    const placed: PlacedTitles = { films: [], shows: [], foundAgain: [] };
    for (const walkedFolder of walked) {
      const titles = await placeFolder(
        current,
        walkedFolder,
        index,
        genres,
        signal
      );
      if (titles === null) {
        return null;
      }
      placed.films.push(...titles.films);
      placed.shows.push(...titles.shows);
      placed.foundAgain.push(...titles.foundAgain);
    }
    return placed;
  };

  /**
   * One walked folder placed as a **Folder scan** places it: every film and
   * show named by the folder's own `Meta/` sheet, through `matchRows`, else
   * off its own folder. A held title is linked, takes its **Sheet fills** and
   * files its **Sheet differences** here; the rest are answered for the
   * Import phase. `null` once the run was cancelled.
   */
  const placeFolder = async (
    current: ImportRun,
    { folder, films: foundFilms, shows: foundShows, sheet }: WalkedFolder,
    { filmsByKey, missing, held, seriesByKey }: HeldIndex,
    genres: GenreReader,
    signal: AbortSignal
  ): Promise<PlacedTitles | null> => {
    const films: Placed<Match>[] = [];
    const shows: Placed<ShowMatch>[] = [];
    const foundAgain: Placed<FoundAgain>[] = [];
    const rows = sheet === null ? [] : await readMetaSheet(current, sheet);
    if (signal.aborted) {
      return null;
    }
    // A show is matched by the film's own rule, over a scan standing for it.
    const showOf = new Map<FilmScan, ShowScan>();
    for (const show of foundShows) {
      showOf.set(asMatchable(show), show);
    }
    // Each folder a row names, with that row, its path cells resolved.
    const named = new Map<FilmScan, SheetRow>();
    const titleRows = rows.filter(isTitleRow);
    if (titleRows.length > 0) {
      const verdicts = matchRows(titleRows, [...foundFilms, ...showOf.keys()]);
      for (const match of verdicts.matched) {
        named.set(match.folder, match.row);
      }
      // An **Orphaned row**: a Folder key no Title folder holds is one
      // **Warning line**, never a Problem, its Season and Episode rows with
      // it; the sheet written on close no longer holds it.
      for (const { kind, row } of verdicts.problems) {
        if (kind === 'no-folder') {
          log(
            current,
            `⚠ ${row.folder} is in the sheet but has no folder, left out`,
            'warning'
          );
        }
      }
    }

    for (const scan of foundFilms) {
      const sheetRow = named.get(scan);
      const row = sheetRow ?? guessedRow(scan.name);
      const heldId = heldFilm(filmsByKey, missing, folder, scan, row);
      if (heldId !== null) {
        // Held: linked to where it was found, and nothing is added; a film
        // whose video is missing is **Found again**, in the Import phase.
        // A row naming it fills its empty fields.
        const again = foundAgainOf(missing, heldId, scan);
        linkHeld(heldId, folder, scan);
        if (again !== null) {
          foundAgain.push({ match: again, libraryFolder: folder });
        }
        const into = heldFolder('movie', heldId);
        let taken: TakenFile[] = [];
        if (into !== null) {
          taken = await fillHeldFiles(
            {
              kind: 'movie',
              id: heldId,
              scan: await filmWithCells(scan, row),
            },
            into,
            heldArtCopy(current, row.title, signal)
          );
          if (signal.aborted) {
            return null;
          }
        }
        const filled =
          sheetRow === undefined
            ? []
            : writeHeldFill(
                current,
                { kind: 'movie', id: heldId },
                sheetRow,
                genres
              );
        const updated = logUpdated(current, row, [...filled, ...taken]);
        if (!updated && again === null) {
          logAlreadyHeld(current, row);
        }
        // The Layout fill runs after Sheet fills only: every file
        // `fillHeldFiles` took was read out of this Title folder already.
        if (filled.length > 0) {
          await fillTitleFolder(current, heldId);
        }
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
      films.push({
        match: { row, folder: await filmWithCells(scan, row) },
        libraryFolder: folder,
      });
    }
    for (const [matchable, show] of showOf) {
      const sheetRow = named.get(matchable);
      const row = sheetRow ?? guessedRow(show.name);
      const match = showMatch(
        row,
        sheetRow === undefined
          ? show
          : await showWithCells(
              show,
              sheetRow,
              partRowsOf(rows, sheetRow.folder)
            ),
        heldShow(held, seriesByKey, folder, show, row),
        sheetRow === undefined ? [] : episodeRowsOf(rows, sheetRow.folder)
      );
      if (sheetRow !== undefined && match.held !== null) {
        match.filled = writeHeldFill(
          current,
          { kind: 'series', id: match.held.series.id },
          sheetRow,
          genres,
          match.sheetEpisodes
        );
      }
      fileUnplaced(current, match);
      shows.push({ match, libraryFolder: folder });
    }
    return { films, shows, foundAgain };
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

    // A run in review let go is closed: its sheets are written again.
    releaseSheets();
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
      running = execute(current, sheet, sheetPath, folders, stop.signal);

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

    readShowFolder: (path) =>
      readShowFolder(path, {
        folders: storage.libraryFolders(),
        // `heldShow`'s question: the folder on record, kept only for a series.
        heldSeriesAt: (folderId, sourceFolder) => {
          const atFolder = storage.titleAt(folderId, sourceFolder);
          return atFolder !== null && storage.getSeries(atFolder) !== null
            ? atFolder
            : null;
        },
        titleHolding: storage.titleHolding,
      }),

    cancel: async () => {
      // Gone from the first line: a `current` read while the rollback is
      // still going must not show a run that is being discarded.
      run = null;
      stop.abort();
      await running;
      releaseSheets();
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
      const libraryFolder = listedFolderOf(
        storage.libraryFolders(),
        candidate.dir
      );
      if (libraryFolder === null) {
        return { kind: 'refused', error: REFUSAL.unlisted };
      }
      return importFromReview(current, id, row, true, candidate, libraryFolder);
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
      const libraryFolder = listedFolderOf(
        storage.libraryFolders(),
        folder.dir
      );
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
        // A folder no row claimed has only its name to offer as a title: its
        // **Folder key**'s title, else that name with the tail forms dropped,
        // so the title is already typed, as "Harbor Lights". The snapshot's
        // row keeps naming the folder as it is.
        row:
          source.row === null
            ? { title: guessedRow(listed.title).title, genres: [] }
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
        (stored === undefined ? null : media.storedFolder(stored.stored)) ??
        media.reserveFolder(form.title, form.year);

      /** A stored file as it is; a found one copied in beside it. */
      const place = (slot: ResolveFile): Promise<string> =>
        'stored' in slot
          ? Promise.resolve(slot.stored)
          : media.copyIn(folder, slot.found);

      try {
        // A Found video in a Link run is linked where it lies; a picked one,
        // already stored, and everything else are placed as before.
        const video: StoredVideo = linkedVideo(current, form.video) ?? {
          videoPath: await place(form.video),
          videoFolderId: null,
        };
        const posterPath =
          form.poster === null ? undefined : await place(form.poster);
        const subtitles: NewSubtitle[] = [];
        for (const track of form.subtitles) {
          subtitles.push({
            path: await place(track.file),
            language: track.language,
          });
        }
        const runtime = derivedRuntime(playback, video);

        // The form's fields, not the sheet's: the row only prefilled them.
        // What the sheet alone knows — whether the family has seen it — is
        // carried, because the form has no field to contradict it with.
        const added = storage.addMovie({
          title: form.title,
          ...video,
          mediaFolder: basename(folder),
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
      const ownFolder =
        heldSeries === null ? null : heldFolder('series', heldSeries.id);
      const folder =
        ownFolder ??
        (stored === undefined ? null : media.storedFolder(stored.stored)) ??
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
          const video: StoredVideo = linkedVideo(current, episode.video) ?? {
            videoPath: await place(episode.video, episode.season),
            videoFolderId: null,
          };
          const subtitles: NewSubtitle[] = [];
          for (const track of episode.subtitles) {
            subtitles.push({
              path: await place(track.file, episode.season),
              language: track.language,
            });
          }
          const runtime = derivedRuntime(playback, video);
          const found = sourceFile(episode.video);
          episodes.push({
            season: episode.season,
            number: episode.number,
            ...video,
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
            mediaFolder: basename(folder),
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
