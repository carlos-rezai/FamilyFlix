/** The **Enrichment flow**'s entry, as the query that names it. */
export interface EnrichQuery {
  /**
   * _Just what was added_ since this moment, the run's `startedAt`: Import's
   * _Finish_ handing off.
   */
  added?: string;
  /** _Just this movie_: the single-title **Sync** from the ⋯ menu. */
  movie?: string;
  /** _Just this series_: the single-title **Sync** from the series' ⋯ menu. */
  series?: string;
  /** **Started on arrival**: the flow presses its own Start, once. */
  start?: boolean;
}

/**
 * The **Enrichment flow**, as a route — `/enrich`, `/enrich?added=<ISO>`,
 * `/enrich?movie=<id>` or `/enrich?series=<id>`, the last two with `&start=1`
 * when it is **Started on arrival**. Five callers name it: Settings' _Sync
 * metadata & posters_, Import's _Finish_, the movie and series pages' _⟳ Fetch
 * from TMDB_, and the Movie form's **Add and sync**. {@link parseEnrichQuery}
 * reads it back.
 *
 * The id travels through `URLSearchParams`, `movieFormPath`'s precedent, so it
 * reads back whole whatever it holds.
 *
 * Pure, so the same query always yields the same route.
 */
export function enrichPath({
  added,
  movie,
  series,
  start,
}: EnrichQuery = {}): string {
  const params = new URLSearchParams();
  if (added !== undefined) params.set('added', added);
  if (movie !== undefined) params.set('movie', movie);
  if (series !== undefined) params.set('series', series);
  if (start === true) params.set('start', '1');
  const query = params.toString();
  return query === '' ? '/enrich' : `/enrich?${query}`;
}

/**
 * The **Enrichment flow**'s query read back — {@link enrichPath}'s mirror, in
 * its unit as `opensSeriesResolve` sits beside `movieFormPath`: `added`,
 * `movie` and `series` as given, `start` only when it is `1`, and anything
 * else ignored.
 *
 * An empty `?movie=` stays an id, as the flow has always read it: a cleared
 * search box is `parseLibraryQuery`'s case, not an id's.
 */
export function parseEnrichQuery(params: URLSearchParams): EnrichQuery {
  const query: EnrichQuery = {};
  const added = params.get('added');
  if (added !== null) query.added = added;
  const movie = params.get('movie');
  if (movie !== null) query.movie = movie;
  const series = params.get('series');
  if (series !== null) query.series = series;
  if (params.get('start') === '1') query.start = true;
  return query;
}
