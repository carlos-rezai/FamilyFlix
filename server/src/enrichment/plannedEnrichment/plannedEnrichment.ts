import type {
  ConflictChoices,
  ConflictField,
  EnrichField,
  FieldConflict,
  Series,
} from '@/types';
import type { MovieEnrichment, SeriesEnrichment } from '../../library';
import type {
  FetchedFields,
  FetchedTvFields,
} from '../fetchedFields/fetchedFields';
import type { FieldPlan } from '../planFields/planFields';

/**
 * Pure: a film's plan → the columns a **Sync** writes on it, with its
 * `tmdb_id`. Images are not here: the run adds `posterPath` and
 * `backdropPath` once it has stored them.
 */
export function movieEnrichment(
  tmdbId: number,
  fill: FieldPlan['fill']
): MovieEnrichment {
  const enrichment: MovieEnrichment = { tmdbId };
  if (fill.synopsis) enrichment.synopsis = fill.synopsis;
  if (fill.runtime) enrichment.runtimeMinutes = fill.runtime;
  if (fill.year) enrichment.year = fill.year;
  if (fill.genres) enrichment.genres = fill.genres;
  if (fill.director) enrichment.director = fill.director;
  if (fill.cast) enrichment.cast = fill.cast;
  if (fill.originalTitle) enrichment.originalTitle = fill.originalTitle;
  if (fill.tmdbScore !== undefined && fill.tmdbScore !== null) {
    enrichment.tmdbScore = fill.tmdbScore;
  }
  return enrichment;
}

/**
 * Pure: a series' plan → its show-level columns. The creator stands where a
 * film's director does, a series has no runtime, and the end of its **Year
 * range** is written only when the Year chip is on and none is held.
 */
export function seriesEnrichment(
  tmdbId: number,
  fill: FieldPlan['fill'],
  series: Series,
  fetched: FetchedTvFields,
  fields: readonly EnrichField[]
): SeriesEnrichment {
  const enrichment: SeriesEnrichment = { tmdbId };
  if (fill.synopsis) enrichment.synopsis = fill.synopsis;
  if (fill.year) enrichment.year = fill.year;
  if (
    fields.includes('year') &&
    series.endYear === null &&
    fetched.endYear !== null
  ) {
    enrichment.endYear = fetched.endYear;
  }
  if (fill.genres) enrichment.genres = fill.genres;
  if (fill.director) enrichment.creator = fill.director;
  if (fill.cast) enrichment.cast = fill.cast;
  if (fill.originalTitle) enrichment.originalTitle = fill.originalTitle;
  if (fill.tmdbScore !== undefined && fill.tmdbScore !== null) {
    enrichment.tmdbScore = fill.tmdbScore;
  }
  return enrichment;
}

/** TMDB's side of one **Field conflict**, as the column it writes. */
function tmdbSide(
  field: ConflictField,
  fetched: FetchedFields
): MovieEnrichment {
  switch (field) {
    case 'synopsis':
      return fetched.synopsis === null ? {} : { synopsis: fetched.synopsis };
    case 'year':
      return fetched.year === null ? {} : { year: fetched.year };
    case 'genres':
      return { genres: fetched.genres };
    case 'director':
      return fetched.director === null ? {} : { director: fetched.director };
    case 'cast':
      return { cast: fetched.cast };
  }
}

/**
 * Pure: _Apply choices_ → the columns it writes. TMDB's side of each conflict
 * chosen as `tmdb`; ours — nothing written — for the rest, and for any field
 * the choices do not name.
 */
export function chosenEnrichment(
  conflicts: readonly FieldConflict[],
  choices: ConflictChoices,
  fetched: FetchedFields
): MovieEnrichment {
  let enrichment: MovieEnrichment = {};
  for (const { field } of conflicts) {
    if (choices[field] === 'tmdb') {
      enrichment = { ...enrichment, ...tmdbSide(field, fetched) };
    }
  }
  return enrichment;
}
