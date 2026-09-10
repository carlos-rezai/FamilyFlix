import { isRatingValue } from '../isRatingValue/isRatingValue';

/** What {@link optionalRating} answers with for a value the column has no room for. */
export const INVALID_RATING = Symbol('invalid rating');

/**
 * The **rating** a form field carries, in the 0–10 units the column stores —
 * `undefined` for a movie nobody has scored, and {@link INVALID_RATING} for a
 * value this route cannot store.
 *
 * `optionalYear`'s case over the one column where getting it wrong *scores* the
 * film rather than losing a word of it. An empty field is a movie left
 * **Unrated**, or one whose rating was removed — and `Number('')` is `0`, which
 * is a real point on the half-star scale: unreachable from the picker, but not
 * from this API, and it must survive as itself rather than be swept into the
 * absence beside it.
 *
 * Anything else off the scale is refused rather than quietly read as unrated,
 * following the unknown genre's reasoning: silence over this column erases a
 * rating instead of dropping a word.
 */
export function optionalRating(
  value: string | undefined
): number | undefined | typeof INVALID_RATING {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const rating = Number(value);
  return isRatingValue(rating) && rating !== null ? rating : INVALID_RATING;
}
