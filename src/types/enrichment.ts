/**
 * The **Enrichment** contracts both build targets read: what a **Sync** is
 * asked to do, the **Current enrichment run**'s snapshot as
 * `GET /api/enrichment/current` answers it, and the setup's summary. See
 * `docs/PRDs/23-enrichment.md` and `docs/design-logs/23-enrichment.md`.
 */
import type { LogLine } from './import';

/** The ten **Enrichment field** chips: what a Sync may fill. */
export type EnrichField =
  | 'synopsis'
  | 'poster'
  | 'backdrop'
  | 'runtime'
  | 'year'
  | 'genres'
  | 'director'
  | 'cast'
  | 'originalTitle'
  | 'tmdbScore';

/** The **Enrichment scope**: the library's gaps, all of it, or one film. */
export type EnrichScope = 'missing' | 'all' | 'single';

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

/** A title the run could not settle on its own, for the review. */
export type Decision = {
  id: string;
  title: string;
  reason: string;
  path: string;
} & (
  | { kind: 'ambiguous'; query: string; candidates: Candidate[] }
  | { kind: 'missing'; query: string }
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
