import { useCallback, useMemo } from 'react';

import type { Episode, SeasonPageModel } from '@/types';
import { saveEpisodeWatched } from '@/api/saveEpisodeWatched/saveEpisodeWatched';
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
 * `not-found` for a series or season the library does not hold. Its two writes are optimistic: the raw
 * episodes are marked on screen at once and put back from a snapshot if the
 * save is refused.
 */
export function useSeasonEpisodes(
  seriesId: string,
  number: number
): UseSeasonEpisodesResult {
  const read = useSeriesRead(seriesId);
  const { retry, editSeries } = read;

  /** Apply a patch to the episodes on screen, if a series is still held. */
  const applyPatch = useCallback(
    (patch: (episode: Episode) => Episode) =>
      editSeries((held) => patchEpisodes(held, patch)),
    [editSeries]
  );

  /** Put the snapshotted episodes back exactly as they were. */
  const restore = useCallback(
    (snapshot: Episode[]) => {
      const byId = new Map(snapshot.map((episode) => [episode.id, episode]));
      applyPatch((episode) => byId.get(episode.id) ?? episode);
    },
    [applyPatch]
  );

  const detail = read.detail;
  const seasonEpisodes = useMemo(
    () =>
      detail?.seasons.find((season) => season.number === number)?.episodes ??
      [],
    [detail, number]
  );

  const toggleEpisode = useCallback(
    (episodeId: string) => {
      const episode = seasonEpisodes.find(
        (candidate) => candidate.id === episodeId
      );
      if (episode === undefined) {
        return;
      }
      const next = !episode.watched;
      applyPatch((candidate) =>
        candidate.id === episodeId ? marked(candidate, next) : candidate
      );
      saveEpisodeWatched(episodeId, next).catch(() => restore([episode]));
    },
    [seasonEpisodes, applyPatch, restore]
  );

  const toggleSeason = useCallback(() => {
    if (detail === null || seasonEpisodes.length === 0) {
      return;
    }
    const next = !seasonEpisodes.every((episode) => episode.watched);
    const ids = new Set(seasonEpisodes.map((episode) => episode.id));
    applyPatch((candidate) =>
      ids.has(candidate.id) ? marked(candidate, next) : candidate
    );
    saveSeasonWatched(detail.series.id, number, next).catch(() =>
      restore(seasonEpisodes)
    );
  }, [detail, seasonEpisodes, number, applyPatch, restore]);

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
