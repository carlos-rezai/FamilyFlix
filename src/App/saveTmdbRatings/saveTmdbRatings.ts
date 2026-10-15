import { postValue } from '@/api/postValue/postValue';

/** Where _Fill in ratings from TMDB_ is written. */
const TMDB_RATINGS_ENDPOINT = '/api/settings/tmdb-ratings';

/** What the tmdb-ratings route accepts as an echo of what it stored. */
function isTmdbRatingsEcho(echoed: unknown): echoed is boolean {
  return typeof echoed === 'boolean';
}

/**
 * Saves the household's _Fill in ratings from TMDB_ and answers with the value that
 * was stored — the wire contract in `postValue`, with a flag as its echo.
 * Rejects if the save did not succeed, which is the provider's cue to put the
 * previous value back.
 *
 * One caller, `DisplayPreferenceProvider`, so it stays beside it in `App/`; the
 * read it pairs with, `fetchSettings`, lives in `src/api/` because the player
 * asks for it too.
 */
export function saveTmdbRatings(on: boolean): Promise<boolean> {
  return postValue(TMDB_RATINGS_ENDPOINT, on, isTmdbRatingsEcho);
}
