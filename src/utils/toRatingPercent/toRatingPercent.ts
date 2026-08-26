/**
 * Maps a stored rating (0–10 units, half-star granularity, or `null` when
 * unrated) to the 0–100 percent the `StarRating` primitive fills against.
 *
 * `null` passes straight through. It used to become 0, which printed
 * `★★★★★ 0.0` for a movie nobody had rated — character-for-character what a
 * movie rated nought prints. Carrying the absence is what lets every caller
 * below tell the two apart; the pure inverse of `toRatingUnits`.
 */
export function toRatingPercent(rating: number | null): number | null {
  if (rating === null) return null;
  return rating * 10;
}
