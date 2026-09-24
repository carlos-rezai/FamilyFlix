/**
 * The **Bulk import** contracts both build targets read: the **Current run**'s
 * snapshot as `GET /api/import/current` answers it, and the **Problems** the
 * **Review step** lists. See `docs/PRDs/13-bulk-import.md` and
 * `docs/design-logs/13-bulk-import.md`.
 */

/**
 * The two fields the **Setup step** has, and the one a refusal names: a start
 * the route refuses before any run exists answers `400 { error, field }`, and
 * the screen draws the reason under that field.
 */
export type ImportField = 'sheet' | 'root';

/** Where a run is: walking the root, copying matches in, or waiting on review. */
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
 * The six kinds of **Problem**: five hard — the film is not in the library —
 * and `missing-meta`, the one soft kind, imported already and carrying its
 * `movieId`.
 */
export type ProblemKind =
  | 'no-folder'
  | 'ambiguous'
  | 'no-video'
  | 'no-row'
  | 'failed'
  | 'unplaced'
  | 'missing-meta';

/** A row or folder the run could not settle on its own, for the **Review step**. */
export interface ImportProblem {
  id: string;
  kind: ProblemKind;
  title: string;
  reason: string;
  /** Set for the soft kind: the movie already in the library. */
  movieId?: string;
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
    poster?: string;
    backdrop?: string;
    subtitles: { path: string; language: string }[];
  };
}
