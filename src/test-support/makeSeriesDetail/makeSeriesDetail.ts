import type { Episode, Series, SeriesDetail, WatchStatus } from '@/types';

/**
 * Build a complete `Series` record for a test — _Harbor & Vine_, 2019–2023,
 * unrated by nobody, not a favorite — overriding only what the test cares
 * about. `makeMovie`'s rule: the shape lives here, the specimen at the call.
 */
export function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'harbor',
    tmdbId: null,
    title: 'Harbor & Vine',
    year: 2019,
    endYear: 2023,
    synopsis: null,
    creator: null,
    cast: [],
    rating: null,
    isFavorite: false,
    posterPath: null,
    backdropPath: null,
    genres: [],
    watched: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** One episode of _Harbor & Vine_, its id `s<season>e<number>`. */
export function makeEpisode(
  season: number,
  number: number,
  status: WatchStatus = 'unwatched'
): Episode {
  return {
    id: `s${season}e${number}`,
    seriesId: 'harbor',
    season,
    number,
    title: null,
    airDate: null,
    runtimeMinutes: null,
    watched: status === 'watched',
    resumePositionSeconds: status === 'in-progress' ? 600 : 0,
    status,
    videoPath: `harbor-vine-2019/season-0${season}/e${number}.mp4`,
    subtitles: [],
    lastWatchedAt: null,
  };
}

/**
 * The series page's read for a test: one season per entry of `seasons`, each
 * a list of its episodes' statuses in order. Each season's **Next episode**,
 * and the series', are the first not watched — the rule the server's
 * `nextEpisodeOf` answers for these shapes — or the first, when all are.
 */
export function makeSeriesDetail(
  seasons: WatchStatus[][] = [['unwatched', 'unwatched']],
  series: Partial<Series> = {}
): SeriesDetail {
  const summaries = seasons.map((statuses, index) => {
    const episodes = statuses.map((status, n) =>
      makeEpisode(index + 1, n + 1, status)
    );
    return { number: index + 1, episodes, next: nextOf(episodes) };
  });
  return {
    series: makeSeries(series),
    seasons: summaries,
    next: nextOf(summaries.flatMap((season) => season.episodes)),
  };
}

function nextOf(episodes: Episode[]): Episode | null {
  return (
    episodes.find((episode) => episode.status === 'in-progress') ??
    episodes.find((episode) => !episode.watched) ??
    episodes[0] ??
    null
  );
}
