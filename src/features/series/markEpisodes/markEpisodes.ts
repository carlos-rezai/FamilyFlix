import type { Episode } from '@/types';
import type { HeldSeries } from '../useSeriesRead/useSeriesRead';

/**
 * One episode as a page shows it after a mark — the movie's rule: watched
 * forgets the resume position, unwatched keeps it.
 */
export function marked(episode: Episode, watched: boolean): Episode {
  if (watched) {
    return {
      ...episode,
      watched: true,
      resumePositionSeconds: 0,
      status: 'watched',
    };
  }
  return {
    ...episode,
    watched: false,
    status: episode.resumePositionSeconds > 0 ? 'in-progress' : 'unwatched',
  };
}

/**
 * The **Next episode** over a list in season, then episode order — the
 * server's `nextEpisodeOf` mirrored, so a mark redraws _Resume_ / _Play_ at
 * once rather than naming an episode it has just marked watched: the first
 * part-watched, else the first unwatched, else the first.
 */
export function nextOf(episodes: readonly Episode[]): Episode | null {
  return (
    episodes.find((episode) => episode.status === 'in-progress') ??
    episodes.find((episode) => episode.status === 'unwatched') ??
    episodes[0] ??
    null
  );
}

/**
 * The held read with each episode `patch` answers for replaced, and each
 * season's Next episode and the series' derived again over the result.
 */
export function patchEpisodes(
  detail: HeldSeries,
  patch: (episode: Episode) => Episode
): HeldSeries {
  const seasons = detail.seasons.map((season) => {
    const episodes = season.episodes.map(patch);
    return { ...season, episodes, next: nextOf(episodes) };
  });
  return {
    ...detail,
    seasons,
    next: nextOf(seasons.flatMap((season) => season.episodes)),
  };
}
