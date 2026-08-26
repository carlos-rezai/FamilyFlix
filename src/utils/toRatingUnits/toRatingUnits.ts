/**
 * Maps a 0–100 percent — the scale the component layer speaks — down to the
 * 0–10 units the `rating` column stores, and `null` to `null`.
 *
 * The pure inverse of `toRatingPercent`, and the one place the two scales meet:
 * a molecule that knows nothing about the domain must not start emitting stored
 * units, and the column must not start storing percentages. The `null` case is
 * the one conversion that must not round — it is the difference between erasing
 * a rating and scoring the movie nothing.
 */
export function toRatingUnits(percent: number | null): number | null {
  if (percent === null) return null;
  return percent / 10;
}
