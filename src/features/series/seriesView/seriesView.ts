import type { Episode, SeriesDetail, SeriesDetailModel } from '@/types';
import { gradientFromId, toRatingPercent } from '@/utils';

/** Path prefix for the Express route that streams managed artwork. */
const IMAGE_ROUTE = '/api/images/';

/** What a credit reads as when it is missing but its sibling survives. */
const MISSING_CREDIT = '—';

/** `1 season` / `2 seasons`. */
const plural = (count: number, word: string) =>
  `${count} ${count === 1 ? word : `${word}s`}`;

/** Two digits at least: `S02E04`, `S12E12`. */
const pad = (value: number) => String(value).padStart(2, '0');

/**
 * The **Year range**: `2022` for a run inside one year, `2019–2023` for a
 * finished one, `2021–` for one still open, and no segment without a year.
 */
function toYearLabel(
  year: number | null,
  endYear: number | null
): string | null {
  if (year === null) {
    return null;
  }
  if (endYear === null) {
    return `${year}–`;
  }
  return endYear === year ? String(year) : `${year}–${endYear}`;
}

/**
 * The one button, naming the **Next episode** the server answered: a Resume
 * when it is part-watched, a Play otherwise, and a bare Play with no episodes.
 */
function toPlayLabel(next: Episode | null): string {
  if (next === null) {
    return 'Play';
  }
  const verb = next.status === 'in-progress' ? 'Resume' : 'Play';
  return `${verb} S${pad(next.season)}E${pad(next.number)}`;
}

/** `Not started` / `5 of 22 episodes watched` / `All 22 episodes watched`. */
function toProgressLabel(watched: number, total: number): string {
  if (watched === 0) {
    return 'Not started';
  }
  return watched === total
    ? `All ${total} episodes watched`
    : `${watched} of ${total} episodes watched`;
}

/**
 * The uppercase caption over the gradient poster — the first genre and the
 * year range, `detailView`'s shape — and none over real artwork. The halves
 * are joined only where both survive.
 */
function toTopTag(
  detail: SeriesDetail,
  yearLabel: string | null,
  hasArtwork: boolean
): string | null {
  if (hasArtwork) {
    return null;
  }
  const [primaryGenre] = detail.series.genres;
  const parts = [primaryGenre?.name ?? null, yearLabel].filter(
    (part): part is string => part !== null
  );
  return parts.length === 0 ? null : parts.join(' · ');
}

/**
 * Maps a `SeriesDetail` to what the series page draws — `detailView`'s
 * precedent, so the hero is left with nothing to decide. Watched counts are
 * whole episodes: a part-watched one is not a watched one.
 */
export function seriesView(detail: SeriesDetail): SeriesDetailModel {
  const { series, seasons, next } = detail;
  const { g1, g2 } = gradientFromId(series.id);
  const episodes = seasons.flatMap((season) => season.episodes);
  const watched = episodes.filter((episode) => episode.watched).length;
  const hasCreator = series.creator !== null;
  const hasCast = series.cast.length > 0;
  const hasArtwork = series.posterPath !== null || series.backdropPath !== null;
  const yearLabel = toYearLabel(series.year, series.endYear);

  return {
    id: series.id,
    title: series.title,
    yearLabel,
    countLabel: `${plural(seasons.length, 'season')} · ${plural(
      episodes.length,
      'episode'
    )}`,
    ratingPercent: toRatingPercent(series.rating),
    genres: series.genres.map((genre) => genre.name),
    playLabel: toPlayLabel(next),
    progressLabel: toProgressLabel(watched, episodes.length),
    synopsis: series.synopsis,
    hasCredits: hasCreator || hasCast,
    creator: series.creator ?? MISSING_CREDIT,
    castText: hasCast ? series.cast.join(', ') : MISSING_CREDIT,
    posterUrl: series.posterPath ? `${IMAGE_ROUTE}${series.posterPath}` : null,
    backdropUrl: series.backdropPath
      ? `${IMAGE_ROUTE}${series.backdropPath}`
      : null,
    hasArtwork,
    g1,
    g2,
    topTag: toTopTag(detail, yearLabel, hasArtwork),
    isFavorite: series.isFavorite,
    seasons: seasons.map((season) => ({
      number: season.number,
      episodeCount: season.episodes.length,
      watchedCount: season.episodes.filter((episode) => episode.watched).length,
      g1,
      g2,
    })),
  };
}
