/** The top of the stored rating scale — 10 half-star units, five whole stars. */
export const MAX_RATING = 10;

/**
 * Whether a posted rating is a value this API stores: exactly `null`, or an
 * integer on the 0–10 half-star scale.
 *
 * Stated as an allow-list rather than as a `typeof value !== 'number'`
 * rejection, because that test alone lets every non-numeric value through as a
 * clear — and a clear is the one write that erases a rating.
 *
 * It has its own unit rather than living with `optionalRating`, which is its
 * largest caller, because it is the scale itself: `/movies/:id/rating` reads a
 * JSON body through it and `parseMinRating` bounds a query parameter by the
 * same top. One statement of what a rating is, at the three doors it can be
 * lied to at.
 */
export function isRatingValue(value: unknown): value is number | null {
  if (value === null) {
    return true;
  }
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_RATING
  );
}
