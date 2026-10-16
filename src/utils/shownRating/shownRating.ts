import type { RatingSource } from '@/types';

/** A **Shown rating**: half-star units (0–10) and whose rating it is. */
export interface ShownRating {
  units: number;
  source: RatingSource;
}

/**
 * The **TMDB rating**: the 0–10 score rounded to whole half-star units, a half
 * rounding up, or `null` when no score is held. TMDB's own scale is already
 * the stars' units out of ten, so nothing but the rounding stands between them.
 */
export function tmdbRating(tmdbScore: number | null): number | null {
  return tmdbScore === null ? null : Math.round(tmdbScore);
}

/**
 * The one client reading of the **Shown rating**. The household Rating when
 * one is stored — a stored `0` included, which is an opinion and never falls
 * through — else, while _Fill in ratings from TMDB_ is on and a score is held,
 * the **TMDB rating**. Otherwise nothing, which the stars draw as unrated.
 */
export function shownRating(
  rating: number | null,
  tmdbScore: number | null,
  tmdbRatings: boolean
): ShownRating | null {
  if (rating !== null) return { units: rating, source: 'household' };
  const tmdb = tmdbRatings ? tmdbRating(tmdbScore) : null;
  return tmdb === null ? null : { units: tmdb, source: 'tmdb' };
}
