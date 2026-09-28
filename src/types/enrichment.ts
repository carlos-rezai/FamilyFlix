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

/** The **Enrichment scopes**: the library's gaps, all of it, or one film. */
export const ENRICH_SCOPES = ['missing', 'all', 'single'] as const;

/** One of the scopes in {@link ENRICH_SCOPES}. */
export type EnrichScope = (typeof ENRICH_SCOPES)[number];

/** The setup's read: the library's counts, the key, the connection, the root. */
export interface EnrichmentSummary {
  total: number;
  /** Titles holding both a synopsis and a poster. */
  complete: number;
  lastSyncedAt: string | null;
  keySet: boolean;
  online: boolean;
  libraryRoot: string | null;
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
  /** The Library root joined to the title's Source folder; `null` when unknown. */
  path: string | null;
  /** What TMDB was last asked for this title — the search box's prefill. */
  query: string;
} & (
  | { kind: 'ambiguous'; candidates: Candidate[] }
  | { kind: 'missing' }
  | { kind: 'conflict'; fields: FieldConflict[] }
);

/** Where a Sync is: fetching, or waiting on review. */
export type EnrichmentPhase = 'running' | 'review';

/** The **Current enrichment run**'s snapshot. */
export interface EnrichmentRun {
  id: string;
  phase: EnrichmentPhase;
  scope: EnrichScope;
  startedAt: string;
  /** Known up front: the titles in scope, snapshotted at start. */
  total: number;
  done: number;
  enriched: number;
  currentItem: string | null;
  log: LogLine[];
  decisions: Decision[];
  written: { sheet: boolean; posters: boolean };
}

/** What `POST /api/enrichment` is sent. */
export interface StartEnrichment {
  scope: EnrichScope;
  movieId?: string;
  fields: EnrichField[];
  writeSheet: boolean;
  writePosters: boolean;
}
