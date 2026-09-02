import type { Movie } from '@/types';

/** Where one movie is loaded from, by the id in the URL. */
const movieEndpoint = (id: string) => `/api/movies/${encodeURIComponent(id)}`;

/**
 * Loads one movie by id — the whole record, synopsis, credits, genres and
 * subtitles included.
 *
 * Resolves `null` when the route answers 404: a movie that is gone is an
 * outcome its callers have a screen for, not a failure, and keeping it separate
 * from a rejection is what makes the detail page's `not-found` reachable and
 * the player's missing-film case tellable from a server hiccup. Every other
 * unsuccessful response, and a request that could not be made at all, rejects —
 * those earn a Retry rather than a way back to the library.
 *
 * It lives on this rung rather than with the movie detail feature because two
 * features call it: the detail page loads the record it renders, and the player
 * loads the same record for the film's title and its artwork. That is
 * CLAUDE.md's rule for `api/` — a wire call moves up the moment a second
 * feature asks for it — and the alternative was the player importing the detail
 * feature's `api/`, which is precisely the import this rung exists to prevent.
 */
export async function fetchMovie(id: string): Promise<Movie | null> {
  const endpoint = movieEndpoint(id);
  const response = await fetch(endpoint);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GET ${endpoint} failed: ${response.status}`);
  }

  return (await response.json()) as Movie;
}
