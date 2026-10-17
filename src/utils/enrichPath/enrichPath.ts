/** The **Enrichment flow**'s entry, as the query that names it. */
export interface EnrichQuery {
  /** Setup opened on _Everything_ — Import's _Finish_ handing off. */
  scope?: 'all';
  /** _Just this movie_: the single-title **Sync** from the ⋯ menu. */
  movie?: string;
  /** _Just this series_: the single-title **Sync** from the series' ⋯ menu. */
  series?: string;
  /** **Started on arrival**: the flow presses its own Start, once. */
  start?: boolean;
}

/**
 * The **Enrichment flow**, as a route — `/enrich`, `/enrich?scope=all`,
 * `/enrich?movie=<id>` or `/enrich?series=<id>`. Four features name it:
 * Settings' _Sync metadata & posters_, Import's _Finish_, and the movie and
 * series pages' _⟳ Fetch from TMDB_.
 *
 * The id travels through `URLSearchParams`, `movieFormPath`'s precedent, so it
 * reads back whole whatever it holds.
 *
 * Pure, so the same query always yields the same route.
 */
export function enrichPath({
  scope,
  movie,
  series,
  start,
}: EnrichQuery = {}): string {
  const params = new URLSearchParams();
  if (scope !== undefined) params.set('scope', scope);
  if (movie !== undefined) params.set('movie', movie);
  if (series !== undefined) params.set('series', series);
  if (start === true) params.set('start', '1');
  const query = params.toString();
  return query === '' ? '/enrich' : `/enrich?${query}`;
}
