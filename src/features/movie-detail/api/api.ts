import type { Movie } from '@/types';

/** Where one movie is loaded from, by the id in the page's URL. */
const movieEndpoint = (id: string) => `/api/movies/${encodeURIComponent(id)}`;

/** Where one movie's watched flag is saved. */
const watchedEndpoint = (id: string) => `${movieEndpoint(id)}/watched`;

/** Where one movie's rating is saved. */
const ratingEndpoint = (id: string) => `${movieEndpoint(id)}/rating`;

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

/**
 * Saves one movie's watched flag and answers with the value that was stored.
 * The same contract `saveFavorite` keeps — the route echoes what it wrote, and
 * that echo is the truth; `watched` is only the fallback for a route that
 * answers without one. Rejects if the save did not succeed, which is the
 * toggle's cue to revert rather than leave the circle filled over nothing.
 */
export async function saveWatched(
  id: string,
  watched: boolean
): Promise<boolean> {
  const response = await fetch(watchedEndpoint(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: watched }),
  });

  if (!response.ok) {
    throw new Error(`Saving watched failed: ${response.status}`);
  }

  const saved = (await response.json()) as { value?: unknown };
  return typeof saved.value === 'boolean' ? saved.value : watched;
}

/**
 * Saves one movie's rating in stored units — 0–10, or `null` to clear it — and
 * answers with the value that was stored. The third call keeping the contract
 * `saveWatched` and `saveFavorite` keep: the route echoes what it wrote, and
 * that echo is the truth.
 *
 * One thing here is its own. `null` is a value this route can legitimately
 * store, so a `null` echo is the route saying it cleared the rating, not a
 * route answering with nothing usable — only a missing `value` key falls back
 * to what was sent. Confusing the two would let a failed clear read as a
 * successful one. Rejects if the save did not succeed, which is the picker's
 * cue to put the old stars back.
 */
export async function saveRating(
  id: string,
  units: number | null
): Promise<number | null> {
  const response = await fetch(ratingEndpoint(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: units }),
  });

  if (!response.ok) {
    throw new Error(`Saving rating failed: ${response.status}`);
  }

  const saved = (await response.json()) as { value?: unknown };
  if (typeof saved.value === 'number' || saved.value === null) {
    return saved.value;
  }
  return units;
}
