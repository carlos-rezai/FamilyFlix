/**
 * Maps a stored rating (0–10 units, half-star granularity, or `null` when
 * unrated) to the 0–100 percent the `StarRating` primitive fills against.
 * Unrated (`null`) becomes 0 — empty stars, never a crash or blank.
 */
export function toRatingPercent(rating: number | null): number {
  if (rating === null) return 0;
  return rating * 10;
}
