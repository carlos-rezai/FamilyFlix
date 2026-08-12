import type { Movie } from '@/types';

/** Where one movie is loaded from, by the id in the page's URL. */
const movieEndpoint = (id: string) => `/api/movies/${encodeURIComponent(id)}`;

/**
 * Loads one movie by id — the whole record the detail page renders, synopsis,
 * credits, genres and subtitles included.
 *
 * Resolves `null` when the route answers 404: a movie that is gone is an
 * outcome the page has a screen for, not a failure, and keeping it separate
 * from a rejection is what makes `not-found` reachable. Every other
 * unsuccessful response, and a request that could not be made at all, rejects
 * — those earn a Retry rather than a way back to the library.
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
