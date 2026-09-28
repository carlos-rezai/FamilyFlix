/** The **Enrichment flow**'s entry, as the query that names it. */
export interface EnrichQuery {
  /** Setup opened on _Everything_ — Import's _Finish_ handing off. */
  scope?: 'all';
  /** _Just this movie_: the single-title **Sync** from the ⋯ menu. */
  movie?: string;
}

/**
 * The **Enrichment flow**, as a route — `/enrich`, `/enrich?scope=all` or
 * `/enrich?movie=<id>`. Three features name it: Settings' _Sync metadata &
 * posters_, Import's _Finish_ and the movie page's _⟳ Fetch from TMDB_.
 *
 * The id travels through `URLSearchParams`, `movieFormPath`'s precedent, so it
 * reads back whole whatever it holds.
 *
 * Pure, so the same query always yields the same route.
 */
export function enrichPath({ scope, movie }: EnrichQuery = {}): string {
  const params = new URLSearchParams();
  if (scope !== undefined) params.set('scope', scope);
  if (movie !== undefined) params.set('movie', movie);
  const query = params.toString();
  return query === '' ? '/enrich' : `/enrich?${query}`;
}
