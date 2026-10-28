/**
 * The **Enrichment** contracts both build targets read: what a **Sync** is
 * asked to do, the **Current enrichment run**'s snapshot as
 * `GET /api/enrichment/current` answers it, and the setup's summary. See
 * `docs/PRDs/23-enrichment.md` and `docs/design-logs/23-enrichment.md`.
 */
import type { LogLine } from './import';

/**
 * The ten **Enrichment field** chips — what a Sync may fill — in the
 * prototype's chip order. An `as const` list its union is derived from, on
 * `EXPORT_COLUMNS`' precedent: the server validates a start against it and
 * the setup draws its chips off it.
 */
export const ENRICH_FIELDS = [
  'synopsis',
  'poster',
  'backdrop',
  'runtime',
  'year',
  'genres',
  'director',
  'cast',
  'originalTitle',
  'tmdbScore',
] as const;

/** One of the fields in {@link ENRICH_FIELDS}. */
export type EnrichField = (typeof ENRICH_FIELDS)[number];

/** Each field's label: the chip's, and a **Field conflict**'s row. */
export const ENRICH_FIELD_LABELS: Readonly<Record<EnrichField, string>> = {
  synopsis: 'Synopsis',
  poster: 'Poster',
  backdrop: 'Backdrop',
  runtime: 'Runtime',
  year: 'Year',
  genres: 'Genres',
  director: 'Director',
  cast: 'Cast',
  originalTitle: 'Original title',
  tmdbScore: 'TMDB score',
};

/**
 * The **Enrichment scopes**: the library's gaps, all of it, one film, or just
 * what was added since a moment.
 */
export const ENRICH_SCOPES = ['missing', 'all', 'single', 'added'] as const;

/** One of the scopes in {@link ENRICH_SCOPES}. */
export type EnrichScope = (typeof ENRICH_SCOPES)[number];

/**
 * The setup's read: the library's counts, the key, the connection, the
 * folders.
 */
export interface EnrichmentSummary {
  total: number;
  /** Titles holding both a synopsis and a poster. */
  complete: number;
  /** Titles with a **Sync gap** — what _Only what's missing_ will sync. */
  gaps: number;
  lastSyncedAt: string | null;
  keySet: boolean;
  online: boolean;
  /** The reachable **Library folders**' paths, in the order added. */
  libraryFolders: string[];
  /**
   * The titles created at or after the summary's `since`: what _Just what was
   * added_ will sync. Absent when no `since` was asked.
   */
  added?: number;
}

/** One TMDB answer an `ambiguous` **Decision** offers. */
export interface Candidate {
  tmdbId: number;
  title: string;
  year: number | null;
  genre: string | null;
  language: string | null;
  posterUrl: string | null;
  /** 0–100. */
  score: number;
}

/** The five fields a filled value can disagree with TMDB on. */
export type ConflictField =
  | 'synopsis'
  | 'year'
  | 'genres'
  | 'director'
  | 'cast';

/** One field of a `conflict` **Decision**: ours beside TMDB's. */
export interface FieldConflict {
  field: ConflictField;
  label: string;
  mine: string;
  tmdb: string;
}

/** Which side of a **Field conflict** _Apply choices_ keeps. */
export type FieldChoice = 'mine' | 'tmdb';

/** _Apply choices_' body: the side chosen for each conflicting field. */
export type ConflictChoices = Partial<Record<ConflictField, FieldChoice>>;

/** A title the run could not settle on its own, for the review. */
export type Decision = {
  id: string;
  title: string;
  reason: string;
  /**
   * The title's Library folder joined to its Source folder; `null` when
   * unknown.
   */
  path: string | null;
  /** What TMDB was last asked for this title — the search box's prefill. */
  query: string;
} & (
  | { kind: 'ambiguous'; candidates: Candidate[] }
  | { kind: 'missing' }
  | { kind: 'conflict'; fields: FieldConflict[] }
);

/** The kind of a **Decision**: `ambiguous`, `missing` or `conflict`. */
export type DecisionKind = Decision['kind'];

/** Where a Sync is: fetching, or waiting on review. */
export type EnrichmentPhase = 'running' | 'review';

/** The **Current enrichment run**'s snapshot. */
export interface EnrichmentRun {
  id: string;
  phase: EnrichmentPhase;
  scope: EnrichScope;
  /** The film a `single` run belongs to; absent on a library run. */
  movieId?: string;
  /** The series a `single` run belongs to; absent on a library run. */
  seriesId?: string;
  startedAt: string;
  /** Known up front: the titles in scope, snapshotted at start. */
  total: number;
  done: number;
  enriched: number;
  currentItem: string | null;
  log: LogLine[];
  decisions: Decision[];
  written: { sheet: boolean; posters: boolean };
  /**
   * A single-series run's **Season choices**, one per Season on disk the Sync
   * read, in season order; absent on any other run.
   */
  seasons?: SeasonChoice[];
}

/** One TMDB poster a Season may take: the season's own, or the series'. */
export interface SeasonPosterChoice {
  /** TMDB's `file_path` — what the route is posted. */
  path: string;
  /** The image on `image.tmdb.org`, for the card. */
  url: string;
  source: 'season' | 'series';
}

/**
 * A **Season choice**: a Season's held **Season poster** through the image
 * route (`null` with none) and at most ten TMDB posters it may take instead —
 * the season's own first, then the series'.
 */
export interface SeasonChoice {
  season: number;
  posterUrl: string | null;
  choices: SeasonPosterChoice[];
}

/**
 * The **Title reference**: which title a thing is about, its kind and its id.
 * The server keys each **Decision** with one, and the Enrichment flow reads its
 * single title as one. Never on the wire: `Decision` carries no kind of title,
 * and `StartEnrichment` names a `movieId` or a `seriesId`.
 */
export interface TitleReference {
  kind: 'movie' | 'series';
  id: string;
}

/** What `POST /api/enrichment` is sent. */
export interface StartEnrichment {
  scope: EnrichScope;
  movieId?: string;
  /** A `single` Sync names exactly one of `movieId` and `seriesId`. */
  seriesId?: string;
  /** An `added` Sync names the moment its window opens, and only it does. */
  since?: string;
  fields: EnrichField[];
  writeSheet: boolean;
  writePosters: boolean;
}
