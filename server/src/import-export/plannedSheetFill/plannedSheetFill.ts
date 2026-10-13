import type { MoviePatch, SheetChoices } from '@/types';
import type { SeriesEnrichment } from '../../library';
import type { SheetFill } from '../planSheetFields/planSheetFields';

/**
 * Pure: a **Sheet fill** → the patch `updateMovie` writes on a held film —
 * `plannedEnrichment`'s `movieEnrichment` on the import's side. Its rating is
 * a column like any other; Watched is not here, since it is a mark rather
 * than a field, and the writer routes it through `markWatched`.
 */
export function movieSheetPatch(fill: SheetFill): MoviePatch {
  const patch: MoviePatch = {};
  if (fill.synopsis !== undefined) patch.synopsis = fill.synopsis;
  if (fill.year !== undefined) patch.year = fill.year;
  if (fill.genres !== undefined) patch.genres = fill.genres;
  if (fill.director !== undefined) patch.director = fill.director;
  if (fill.cast !== undefined) patch.cast = fill.cast;
  if (fill.rating !== undefined) patch.rating = fill.rating;
  return patch;
}

/**
 * Pure: a **Sheet fill** → the columns `enrichSeries` writes on a held series:
 * its _Created by_ where a film's director stands, its **Year range** whole.
 * The rating is not here — `enrichSeries` writes none, so the writer routes
 * it through `setSeriesRating`.
 */
export function seriesSheetPatch(fill: SheetFill): SeriesEnrichment {
  const patch: SeriesEnrichment = {};
  if (fill.synopsis !== undefined) patch.synopsis = fill.synopsis;
  if (fill.year !== undefined) patch.year = fill.year;
  if (fill.endYear !== undefined) patch.endYear = fill.endYear;
  if (fill.genres !== undefined) patch.genres = fill.genres;
  if (fill.director !== undefined) patch.creator = fill.director;
  if (fill.cast !== undefined) patch.cast = fill.cast;
  return patch;
}

/**
 * Pure: _Apply choices_ → the **Sheet fill** it writes — the sheet's side of
 * every field chosen `sheet`, as `planSheetFields` proposed it, a series'
 * end year with its year; nothing for a field chosen `mine`, nor for one the
 * choices do not name.
 */
export function chosenSheetFill(
  proposed: SheetFill,
  choices: SheetChoices
): SheetFill {
  const chosen = (field: keyof SheetChoices): boolean =>
    choices[field] === 'sheet';
  const fill: SheetFill = {};
  if (chosen('synopsis') && proposed.synopsis !== undefined) {
    fill.synopsis = proposed.synopsis;
  }
  if (chosen('year') && proposed.year !== undefined) {
    fill.year = proposed.year;
    if (proposed.endYear !== undefined) fill.endYear = proposed.endYear;
  }
  if (chosen('genres') && proposed.genres !== undefined) {
    fill.genres = proposed.genres;
  }
  if (chosen('director') && proposed.director !== undefined) {
    fill.director = proposed.director;
  }
  if (chosen('cast') && proposed.cast !== undefined) {
    fill.cast = proposed.cast;
  }
  if (chosen('rating') && proposed.rating !== undefined) {
    fill.rating = proposed.rating;
  }
  return fill;
}
