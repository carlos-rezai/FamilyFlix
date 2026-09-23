/**
 * The series' page, as a route — `/series/<id>`, `moviePath`'s precedent: a
 * Series tab poster opens it, and the season page will sit beneath it. The id
 * is encoded, so a `/` in one can never read as a second path segment.
 *
 * Pure, so the same id always yields the same route.
 */
export function seriesPath(id: string): string {
  return `/series/${encodeURIComponent(id)}`;
}
