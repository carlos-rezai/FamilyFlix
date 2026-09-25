import { useCallback, useMemo } from 'react';

import type { Episode, SeasonPageModel } from '@/types';
import { saveEpisodeWatched } from '@/api/saveEpisodeWatched/saveEpisodeWatched';
import { useOptimisticEdit } from '@/hooks/useOptimisticEdit/useOptimisticEdit';
import { saveSeasonWatched } from '../api/api';
import { seasonView } from '../seasonView/seasonView';
import { useSeriesRead, type HeldSeries } from '../useSeriesRead/useSeriesRead';

type SeasonState =
  | { status: 'loading'; season: null }
  | { status: 'error'; season: null }
  | { status: 'not-found'; season: null; seriesFound: boolean }
  | { status: 'ready'; season: SeasonPageModel };

export type UseSeasonEpisodesResult = SeasonState & {
  /** Re-run the read after a failure. */
  retry: () => void;
  /** Flip one episode's box: shown at once, put back if the save is refused. */
  toggleEpisode: (episodeId: string) => void;
  /** Mark the whole season: shown at once, put back if the save is refused. */
  toggleSeason: () => void;
};

/**
 * One episode as the page shows it after a mark — the movie's rule: watched
 * forgets the resume position, unwatched keeps it.
 */
function marked(episode: Episode, watched: boolean): Episode {
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

/** The held read with each episode `patch` answers for replaced. */
function patchEpisodes(
  detail: HeldSeries,
  patch: (episode: Episode) => Episode
): HeldSeries {
  return {
    ...detail,
    seasons: detail.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map(patch),
    })),
  };
}

/**
 * The series named by the URL through `useSeriesRead` — the series page's own
 * load — and season `number` picked from it per render by `seasonView`, or
 * `not-found` for a series or season the library does not hold. Its two
 * writes, the episode box and the season mark, keep the heart's bargain
 * through `useOptimisticEdit`.
 */
export function useSeasonEpisodes(
  seriesId: string,
  number: number
): UseSeasonEpisodesResult {
  const read = useSeriesRead(seriesId);
  const { retry, editSeries } = read;

  const detail = read.detail;
  const edit = useOptimisticEdit(detail, editSeries);
  const seasonEpisodes = useMemo(
    () =>
      detail?.seasons.find((season) => season.number === number)?.episodes ??
      [],
    [detail, number]
  );

  /**
   * One mark over `touched`, on the movie page's bargain: the episodes it
   * touches are captured, marked on screen at once by the movie's watched
   * rule, marked again by the route's echo if it differs, and put back from
   * the capture if the save is refused.
   */
  const mark = useCallback(
    (
      touched: Episode[],
      next: boolean,
      save: (seriesId: string, value: boolean) => Promise<boolean>
    ) => {
      const ids = new Set(touched.map((episode) => episode.id));
      edit({
        next,
        capture: () => touched,
        apply: (held, value) =>
          patchEpisodes(held, (episode) =>
            ids.has(episode.id) ? marked(episode, value) : episode
          ),
        restore: (held, snapshot) => {
          const byId = new Map(
            snapshot.map((episode) => [episode.id, episode])
          );
          return patchEpisodes(
            held,
            (episode) => byId.get(episode.id) ?? episode
          );
        },
        save,
      });
    },
    [edit]
  );

  const toggleEpisode = useCallback(
    (episodeId: string) => {
      const episode = seasonEpisodes.find(
        (candidate) => candidate.id === episodeId
      );
      if (episode === undefined) {
        return;
      }
      mark([episode], !episode.watched, (_seriesId, value) =>
        saveEpisodeWatched(episodeId, value)
      );
    },
    [seasonEpisodes, mark]
  );

  const toggleSeason = useCallback(() => {
    if (seasonEpisodes.length === 0) {
      return;
    }
    mark(
      seasonEpisodes,
      !seasonEpisodes.every((episode) => episode.watched),
      (seriesId, value) => saveSeasonWatched(seriesId, number, value)
    );
  }, [seasonEpisodes, number, mark]);

  const handlers = { retry, toggleEpisode, toggleSeason };

  if (read.status === 'loading') {
    return { status: 'loading', season: null, ...handlers };
  }
  if (read.status === 'error') {
    return { status: 'error', season: null, ...handlers };
  }
  if (read.status === 'not-found') {
    return {
      status: 'not-found',
      season: null,
      seriesFound: false,
      ...handlers,
    };
  }
  const season = seasonView(read.detail, number);
  if (season === null) {
    return {
      status: 'not-found',
      season: null,
      seriesFound: true,
      ...handlers,
    };
  }
  return { status: 'ready', season, ...handlers };
}
