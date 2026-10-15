import type { RatingSource } from '@/types';

/** A **Shown rating**: half-star units (0–10) and whose rating it is. */
export interface ShownRating {
  units: number;
  source: RatingSource;
}

/**
 * The one client reading of the **Shown rating**. The household Rating when
 * one is stored — a stored `0` included, which is an opinion and never falls
 * through — else, while _Fill in ratings from TMDB_ is on and a score is held,
 * the **TMDB rating**: the 0–10 score rounded to whole half-star units, a half
 * rounding up. Otherwise nothing, which the stars draw as unrated.
 */
export function shownRating(
  rating: number | null,
  tmdbScore: number | null,
  tmdbRatings: boolean
): ShownRating | null {
  if (rating !== null) return { units: rating, source: 'household' };
  if (tmdbRatings && tmdbScore !== null) {
    return { units: Math.round(tmdbScore), source: 'tmdb' };
  }
  return null;
}
