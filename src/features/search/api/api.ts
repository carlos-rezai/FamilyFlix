import type { GenreListPayload } from '@/types';

/** The list the Genre dropdown is built from — its own endpoint, not the home's. */
const GENRES_ENDPOINT = '/api/genres';

/**
 * Loads the genre list: every populated genre with its count, plus the
 * library's movie total for the "All Genres" row.
 *
 * Asked with no query string, deliberately — the counts describe the whole
 * library rather than the settled query, so the list cannot reshuffle under a
 * finger already reaching for it. Rejects if the route answers with anything
 * but a 2xx; swallowing that is the hook's job, not this one's.
 */
export async function fetchGenreList(): Promise<GenreListPayload> {
  const response = await fetch(GENRES_ENDPOINT);
  if (!response.ok) {
    throw new Error(`GET ${GENRES_ENDPOINT} failed: ${response.status}`);
  }
  return (await response.json()) as GenreListPayload;
}

/** The Series tab's list: the same shape, counted in series. */
const SERIES_GENRES_ENDPOINT = '/api/series/genres';

/**
 * Loads the Series tab's genre list: every genre series carry, counted in
 * series, and the series total for the "All Genres" row — `fetchGenreList`'s
 * contract over the other shelf. Rejects if the route answers with anything
 * but a 2xx.
 */
export async function fetchSeriesGenreList(): Promise<GenreListPayload> {
  const response = await fetch(SERIES_GENRES_ENDPOINT);
  if (!response.ok) {
    throw new Error(`GET ${SERIES_GENRES_ENDPOINT} failed: ${response.status}`);
  }
  return (await response.json()) as GenreListPayload;
}
