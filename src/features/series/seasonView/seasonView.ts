import type {
  Episode,
  SeasonEpisodeModel,
  SeasonPageModel,
  SeasonSummary,
  SeriesDetail,
} from '@/types';
import {
  formatClock,
  formatEpisodeTag,
  gradientFromId,
  toProgressPercent,
  toRuntimeSeconds,
} from '@/utils';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const seasonLabelOf = (number: number) => `Season ${number}`;

/**
 * `2019-03-04` → `Mar 4, 2019`, read off the string itself so no time zone
 * can move the day. Anything else is drawn as it was stored.
 */
function toAirDateLabel(airDate: string | null): string | null {
  if (airDate === null) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(airDate);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  if (!match || month === undefined) {
    return airDate;
  }
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

/** The episode the play button plays: the season's **Next episode**, else E01. */
function playEpisodeOf(season: SeasonSummary): Episode | null {
  return season.next ?? season.episodes[0] ?? null;
}

/** The play button off the season's **Next episode**. */
function toPlayLabel(season: SeasonSummary): string {
  const next = playEpisodeOf(season);
  if (next === null) {
    return 'Play';
  }
  const verb = next.status === 'in-progress' ? 'Resume' : 'Play';
  return `${verb} ${formatEpisodeTag({ number: next.number })}`;
}

/** One row: progress and the **Resume label** only while part watched. */
function toEpisodeModel(
  episode: Episode,
  g1: string,
  g2: string
): SeasonEpisodeModel {
  const inProgress = !episode.watched && episode.resumePositionSeconds > 0;
  const totalSeconds = toRuntimeSeconds(episode.runtimeMinutes);
  const elapsed = formatClock(episode.resumePositionSeconds);

  return {
    id: episode.id,
    season: episode.season,
    number: episode.number,
    title: episode.title,
    airDate: toAirDateLabel(episode.airDate),
    watched: episode.watched,
    progress: inProgress
      ? toProgressPercent(episode.resumePositionSeconds, episode.runtimeMinutes)
      : 0,
    resumeLabel: inProgress
      ? totalSeconds === null
        ? `Resume · ${elapsed}`
        : `Resume · ${elapsed} of ${formatClock(totalSeconds)}`
      : null,
    g1,
    g2,
  };
}

/**
 * Maps a `SeriesDetail` to what the season page draws for season `number` —
 * `seriesView`'s sibling over the same read — or `null` for a season the
 * series does not have, the not-found face. Watched counts are whole
 * episodes: a part-watched one is not a watched one.
 */
export function seasonView(
  detail: SeriesDetail,
  number: number
): SeasonPageModel | null {
  const season = detail.seasons.find(
    (candidate) => candidate.number === number
  );
  if (season === undefined) {
    return null;
  }
  const { series } = detail;
  const { g1, g2 } = gradientFromId(series.id);
  const total = season.episodes.length;
  const watched = season.episodes.filter((episode) => episode.watched).length;
  const allWatched = total > 0 && watched === total;

  return {
    seriesId: series.id,
    seriesTitle: series.title,
    seasonNumber: season.number,
    seasonLabel: seasonLabelOf(season.number),
    playLabel: toPlayLabel(season),
    playEpisodeId: playEpisodeOf(season)?.id ?? null,
    countLabel: `${total} ${total === 1 ? 'episode' : 'episodes'}`,
    watchedLabel: `${watched} watched`,
    allWatched,
    toggleAllLabel: allWatched
      ? 'Mark season unwatched'
      : 'Mark season watched',
    episodes: season.episodes.map((episode) => toEpisodeModel(episode, g1, g2)),
    otherSeasons: detail.seasons
      .filter((candidate) => candidate.number !== season.number)
      .map((candidate) => ({
        number: candidate.number,
        label: seasonLabelOf(candidate.number),
      })),
  };
}
