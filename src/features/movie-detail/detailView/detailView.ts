import type { Movie, MovieDetailModel } from '@/types';
import { formatClock, gradientFromId, toRatingPercent } from '@/utils';

/** Path prefix for the Express route that streams managed artwork. */
const IMAGE_ROUTE = '/api/images/';

/** What a credit reads as when it is missing but its sibling survives. */
const MISSING_CREDIT = '—';

/** Between the two halves of the poster's overlay caption. */
const TAG_SEPARATOR = ' · ';

/**
 * The human runtime. Zero units are dropped rather than written, so 42 minutes
 * is "42m" and two hours flat is "2h" — never "0h 42m" or "2h 0m", which is what
 * a naive `${h}h ${m}m` yields and which reads as a deliberate label to anyone
 * downstream. A runtime that survives no unit at all says nothing worth a
 * segment, so it drops out with the unknown case.
 */
function toRuntimeLabel(minutes: number | null): string | null {
  if (minutes === null) {
    return null;
  }

  const units: string[] = [];
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours > 0) {
    units.push(`${hours}h`);
  }
  if (remainder > 0) {
    units.push(`${remainder}m`);
  }

  return units.length === 0 ? null : units.join(' ');
}

/**
 * The primary button's text. A movie left part-way in names the position it
 * resumes from, so a parent clicking it is never surprised about where it
 * starts. The in-progress test is the record's own derived **Status** rather
 * than a second reading of `watched` + `resumePositionSeconds` — the repository
 * owns that rule, and the frontend should not keep a private copy of it.
 */
function toPlayLabel(movie: Movie): string {
  return movie.status === 'in-progress'
    ? `Resume · ${formatClock(movie.resumePositionSeconds)}`
    : 'Play';
}

/**
 * The small uppercase line drawn on the poster. It exists to caption the
 * gradient placeholder, so over real artwork it is not composed at all — it
 * would be text laid on top of the picture it describes. Like the meta line, its
 * separator is generated *between* the halves that survive, so a lone "· 1994"
 * is unrepresentable.
 */
function toTopTag(movie: Movie, hasArtwork: boolean): string | null {
  if (hasArtwork) {
    return null;
  }

  const parts: string[] = [];
  const [primaryGenre] = movie.genres;

  if (primaryGenre) {
    parts.push(primaryGenre.name);
  }
  if (movie.year !== null) {
    parts.push(String(movie.year));
  }

  return parts.length === 0 ? null : parts.join(TAG_SEPARATOR);
}

/**
 * Maps a canonical `Movie` record to the `MovieDetailModel` the movie detail
 * page renders — the detail-screen sibling of `view()` and `continueView()`.
 *
 * It owns **every** absent-field decision, so the component is left with no
 * display conditional worth arguing about: a missing meta segment arrives as
 * `null` and takes its separator with it, a missing synopsis means no
 * `ExpandableText` exists at all, and a missing credit becomes "—" so the
 * surviving one keeps its place on the page instead of jumping across it. The
 * credits row disappears only when there is nothing at all to put in it.
 *
 * Two distinctions the mapper exists to preserve. **Unrated is not zero**: a
 * `null` rating stays `null` all the way to the picker, which labels it
 * `Not rated` rather than printing the "0.0" a movie scored nought prints. The
 * segment itself is permanent — the mapper decides the scale here, not whether
 * the stars exist. And **artwork is not decorated**: the overlays follow
 * `PosterCard`'s rule and caption the deterministic gradient only.
 */
export function detailView(movie: Movie): MovieDetailModel {
  const { g1, g2 } = gradientFromId(movie.id);
  const hasArtwork = movie.posterPath !== null || movie.backdropPath !== null;
  const hasDirector = movie.director !== null;
  const hasCast = movie.cast.length > 0;

  return {
    id: movie.id,
    title: movie.title,
    year: movie.year,
    runtimeLabel: toRuntimeLabel(movie.runtimeMinutes),
    ratingPercent: toRatingPercent(movie.rating),
    isWatched: movie.watched,
    isFavorite: movie.isFavorite,
    playLabel: toPlayLabel(movie),
    genres: movie.genres.map((genre) => genre.name),
    synopsis: movie.synopsis,
    hasCredits: hasDirector || hasCast,
    director: movie.director ?? MISSING_CREDIT,
    castText: hasCast ? movie.cast.join(', ') : MISSING_CREDIT,
    posterUrl: movie.posterPath ? `${IMAGE_ROUTE}${movie.posterPath}` : null,
    backdropUrl: movie.backdropPath
      ? `${IMAGE_ROUTE}${movie.backdropPath}`
      : null,
    hasArtwork,
    g1,
    g2,
    topTag: toTopTag(movie, hasArtwork),
  };
}
