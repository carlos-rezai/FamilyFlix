/**
 * The minimums the rating dropdown can ask for, strongest first. Ratings are
 * stored in 0–10 half-star units, so "4+ stars" is an 8 — the numbers never
 * reach the screen, only the stars do.
 *
 * Deliberately the control's whole vocabulary rather than the stored scale's:
 * the route is a general API over 0–10, but a client-side minimum the dropdown
 * has no row for would narrow the library behind a pill still saying "All
 * ratings".
 */
export const RATING_CUTOFFS: readonly number[] = [8, 6, 4];

/**
 * Reads a URL's `?rating=` as the minimum the browse home is filtered by, or
 * `undefined` for no minimum at all.
 *
 * A util rather than a feature-local helper for the same reason as
 * `isMovieSort`: the minimum arrives from the URL, and two features read it
 * from there independently — the search feature parses the settled query and
 * draws the pill, the library feature builds the home request. They must agree
 * exactly, or the screen contradicts itself.
 *
 * Only a cut-off the control can produce reads as a minimum, which is one rule
 * covering every way a URL can be wrong: absent, empty, nought, negative, off
 * the top of the scale, fractional, not a number, or simply a value with no row
 * behind it. `0` in particular is "All ratings" and not a floor of nought — a
 * literal minimum of zero would exclude every unrated movie, the opposite of
 * what the row promises.
 */
export function parseMinRating(value: string | null): number | undefined {
  if (value === null || value.trim() === '') {
    return undefined;
  }

  const minimum = Number(value);
  return RATING_CUTOFFS.includes(minimum) ? minimum : undefined;
}
