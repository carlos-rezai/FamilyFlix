import { seriesPath } from '../seriesPath/seriesPath';

/**
 * The **Season page**, as a route — `/series/<id>/season/<n>`, beneath the
 * series' own page (`seriesPath`). A Season card opens it. The number is
 * written bare, and the id is encoded by `seriesPath`.
 *
 * Pure, so the same series and season always yield the same route.
 */
export function seasonPath(seriesId: string, season: number): string {
  return `${seriesPath(seriesId)}/season/${season}`;
}
