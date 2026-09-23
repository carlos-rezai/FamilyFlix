import { postValue, type PostOptions } from '../postValue/postValue';

/** Where one episode's watched flag is saved. */
const episodeWatchedEndpoint = (id: string) =>
  `/api/episodes/${encodeURIComponent(id)}/watched`;

/** What the watched route accepts as an echo of what it stored. */
function isWatchedEcho(echoed: unknown): echoed is boolean {
  return typeof echoed === 'boolean';
}

/**
 * Saves one episode's watched flag and answers with the value that was stored
 * — `saveWatched`'s shape over the episode's route. Rejects if the save did
 * not succeed, the season page's cue to put the box back.
 *
 * It sits in `api/` because two features save it: the season page's watched
 * box and the player's _Play now_.
 */
export function saveEpisodeWatched(
  id: string,
  watched: boolean,
  options?: PostOptions
): Promise<boolean> {
  return postValue(episodeWatchedEndpoint(id), watched, isWatchedEcho, options);
}
