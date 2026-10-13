/**
 * The **Bulk import** contracts both build targets read: the **Current run**'s
 * snapshot as `GET /api/import/current` answers it, and the **Problems** the
 * **Review step** lists. See `docs/PRDs/13-bulk-import.md` and
 * `docs/design-logs/13-bulk-import.md`.
 */

/**
 * The two things the **Setup step** draws a refusal under — the sheet field
 * and the **Library folders** group: a start the route refuses before any run
 * exists answers `400 { error, field }`, and the screen draws the reason under
 * that one. An `as const` list its union
 * is derived from, on `EXPORT_FORMATS`' precedent, so a refusal's field can be
 * checked against the declaration that names it.
 */
export const IMPORT_FIELDS = ['sheet', 'folders'] as const;

/** One of the fields in {@link IMPORT_FIELDS}. */
export type ImportField = (typeof IMPORT_FIELDS)[number];

/**
 * The fields a **Sheet row** may fill on a title the library already holds,
 * or raise as a **Sheet difference** — an `as const` list on `ENRICH_FIELDS`'
 * precedent, in the order a log line and a review row name them. Title is
 * never in play; Watched only ever marks, so it is not a field here.
 */
export const SHEET_FIELDS = [
  'synopsis',
  'year',
  'genres',
  'director',
  'cast',
  'rating',
] as const;

/** One of the fields in {@link SHEET_FIELDS}. */
export type SheetField = (typeof SHEET_FIELDS)[number];

/**
 * A **Sheet difference**: a field filled on both sides that differs —
 * `FieldConflict`'s shape with `sheet` in `tmdb`'s place, both sides spelled
 * for display. `director` is labelled _Created by_ on a series.
 */
export interface SheetDifference {
  field: SheetField;
  label: string;
  mine: string;
  sheet: string;
}

/**
 * _Apply choices_' body on a `differs` Problem: each field to the side kept —
 * `sheet` writes the spreadsheet's value, `mine` keeps the library's.
 */
export type SheetChoices = Partial<Record<SheetField, 'mine' | 'sheet'>>;

/** A run over a spreadsheet, or a **Folder scan** over the Library folders. */
export type ImportSource = 'sheet' | 'folders';

/** Where a run is: walking the Library folders, copying matches in, or waiting on review. */
export type ImportPhase = 'scanning' | 'importing' | 'review';

/** How a line of the **Activity log** is drawn. */
export type LogKind =
  | 'info'
  | 'scan'
  | 'path'
  | 'success'
  | 'warning'
  | 'error';

/** One line of the **Activity log**, capped on the snapshot. */
export interface LogLine {
  text: string;
  kind: LogKind;
}

/**
 * The kinds of **Problem**: the hard ones — the title is not in the library —
 * and the two soft kinds, `missing-meta` and `differs`, each about a title the
 * library holds and carrying its `movieId` or `seriesId`.
 */
export type ProblemKind =
  | 'no-folder'
  | 'ambiguous'
  | 'no-video'
  | 'no-row'
  | 'failed'
  | 'unplaced'
  | 'missing-meta'
  | 'differs';

/** A row or folder the run could not settle on its own, for the **Review step**. */
export interface ImportProblem {
  id: string;
  kind: ProblemKind;
  title: string;
  reason: string;
  /** Set for the soft kind: the movie already in the library. */
  movieId?: string;
  /**
   * Set on an `unplaced` Problem whose show the library holds: the series a
   * _Resolve_ joins.
   */
  seriesId?: string;
  /** Set on a `differs` Problem: its **Sheet differences**, in field order. */
  differences?: SheetDifference[];
}

/**
 * The **Current run**'s snapshot. Elapsed, percent and the ETA are not on it —
 * they are derived client-side from `startedAt`, `done` and `total`, because a
 * snapshot carrying them would be a clock on the wire. `log` and `problems`
 * are always present, empty until their phases.
 */
export interface ImportRun {
  id: string;
  phase: ImportPhase;
  /** An ISO stamp, as every date in the app is. */
  startedAt: string;
  /** **Source folders** found so far by the walk. */
  found: number;
  /** Matches to import, known once the scan completes. */
  total: number;
  /** Matches imported so far. */
  done: number;
  /** Rows matched confidently. */
  matched: number;
  /** The folder or file being worked on, for the running step's own line. */
  currentItem: string;
  log: LogLine[];
  problems: ImportProblem[];
  /**
   * Whether _Finish_ hands off to an **Enrichment run** — the Setup step's
   * _Also fetch metadata and posters from TMDB_, carried on the run so a
   * re-attached screen still knows it. The import itself asks TMDB nothing.
   */
  enrich: boolean;
  /**
   * What the run reads: a spreadsheet and its root, or the listed **Library
   * folders** — a **Folder scan**. The screen reads it for its heading alone.
   */
  source: ImportSource;
}

/** What Resolve prefills the **Movie form** from. */
export interface ImportProblemDetail extends ImportProblem {
  row: {
    title: string;
    year?: number;
    genres: string[];
    director?: string;
    cast?: string[];
    synopsis?: string;
    rating?: number;
  };
  /** The **Source folder** the problem is about, when there is one. */
  folder?: string;
  /** The key-equal folders of an `ambiguous` problem; the first prefills. */
  candidates: string[];
  /** The **Found files** under the folder, as absolute paths under the root. */
  files: {
    video?: string;
    /**
     * Every video, in name order: a film's **Found-file choice**, a show's
     * Unplaced videos. Empty when there is no folder.
     */
    videos: string[];
    poster?: string;
    backdrop?: string;
    subtitles: { path: string; language: string }[];
  };
}
