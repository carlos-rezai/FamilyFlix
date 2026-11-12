import type { Episode } from '@/types';

/**
 * The **Next episode** over a list already in season, then episode order: the
 * first part-watched episode of any season, else the first unwatched outside
 * Season 0, else the first outside Season 0 (specials last, issue #588). A
 * list of only Season 0 episodes keeps the plain rule: the first part-watched,
 * else the first unwatched, else the first. What _Resume_ / _Play_ plays.
 * `null` for an empty list.
 */
export function nextEpisodeOf(episodes: readonly Episode[]): Episode | null {
  const regular = episodes.filter((episode) => episode.season !== 0);
  const candidates = regular.length > 0 ? regular : episodes;
  return (
    episodes.find((episode) => episode.status === 'in-progress') ??
    candidates.find((episode) => episode.status === 'unwatched') ??
    candidates[0] ??
    null
  );
}
