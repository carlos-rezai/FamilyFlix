import type { Episode } from '@/types';

/**
 * The **Next episode** over a list already in season, then episode order: the
 * first part-watched episode, else the first unwatched, else the first — what
 * _Resume_ / _Play_ plays. `null` for an empty list.
 */
export function nextEpisodeOf(episodes: readonly Episode[]): Episode | null {
  return (
    episodes.find((episode) => episode.status === 'in-progress') ??
    episodes.find((episode) => episode.status === 'unwatched') ??
    episodes[0] ??
    null
  );
}
