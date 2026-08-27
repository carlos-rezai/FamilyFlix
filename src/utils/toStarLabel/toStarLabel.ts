/** What one star is worth on the 0–100 percent scale the star strips fill against. */
const PERCENT_PER_STAR = 20;

/**
 * Names a 0–100 rating percent as the out-of-five number a parent reads —
 * rounded to the nearest half star and always printed to one decimal, so
 * three and a half stars reads `3.5` and four reads `4.0` rather than `4`.
 *
 * Both star strips print this number and neither owns it: the display
 * `StarRating` renders it bare, the interactive `RatingPicker` appends
 * ` / 5`. Rounding it in two places is how the same 70% ends up called two
 * different things on one page.
 *
 * `null` never reaches here. An unrated movie has no number at all, and what
 * each strip prints in its place — nothing, or "Not rated" — is that strip's
 * own copy rather than shared arithmetic.
 */
export function toStarLabel(percent: number): string {
  const stars = Math.round((percent / PERCENT_PER_STAR) * 2) / 2;
  return stars.toFixed(1);
}
