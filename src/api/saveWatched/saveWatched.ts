import { postValue, type PostOptions } from '../postValue/postValue';

/** Where one movie's watched flag is saved. */
const watchedEndpoint = (id: string) =>
  `/api/movies/${encodeURIComponent(id)}/watched`;

/** What the watched route accepts as an echo of what it stored. */
function isWatchedEcho(echoed: unknown): echoed is boolean {
  return typeof echoed === 'boolean';
}

/**
 * Saves one movie's watched flag and answers with the value that was stored —
 * the wire contract in `postValue`, with a flag as its echo. Rejects if the
 * save did not succeed, which is the detail page's cue to revert rather than
 * leave the circle filled over nothing.
 *
 * It moved up here from `features/movie-detail/api/` when the player gave it a
 * second caller: crossing the **Finish threshold** marks a film watched through
 * this same route, and neither feature should be importing the other's wire.
 * That is the rule that put `saveFavorite` at this rung and left this call
 * behind until now.
 *
 * The `keepalive` option is the player's alone. Finishing a film can be the
 * last thing that happens before the screen goes away, and a mark that did not
 * survive the teardown would leave a film the family watched to the end sitting
 * in Continue Watching.
 */
export function saveWatched(
  id: string,
  watched: boolean,
  options?: PostOptions
): Promise<boolean> {
  return postValue(watchedEndpoint(id), watched, isWatchedEcho, options);
}
