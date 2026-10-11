/**
 * The Series tab, as a route — `/?tab=series`, `moviePath`'s precedent: the
 * library home with its **Library tabs** on Series. Three screens name it: the
 * series page's **Landing**, a series delete's, and the series kind's **Fresh
 * home** after an add.
 *
 * Pure, so it always yields the same route.
 */
export function seriesTabPath(): string {
  return '/?tab=series';
}
