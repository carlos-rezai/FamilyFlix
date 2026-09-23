/**
 * The **Series** and its **Episodes** — the second kind of thing on the
 * shelves, beside the {@link ./movie.ts Movie}. A series stores no watch
 * state of its own — its `watched` is derived from its episodes; each episode carries the movie's watch trio exactly, so
 * its `status` is the movie's derivation. A season is not a record: it is the
 * `season` number on its episodes.
 */
import type { Genre, Subtitle, WatchStatus } from './movie';

/** The fully-assembled series model returned by repository reads. */
export interface Series {
  id: string;
  tmdbId: number | null;
  title: string;
  /** The first year it aired, or `null`. */
  year: number | null;
  /** The last year it aired; `null` for a run still open (or unknown). */
  endYear: number | null;
  synopsis: string | null;
  creator: string | null;
  cast: string[];
  rating: number | null;
  isFavorite: boolean;
  posterPath: string | null;
  backdropPath: string | null;
  genres: Genre[];
  /** True only when every episode is watched; derived, never stored. */
  watched: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One episode of a series, numbered within its season. */
export interface Episode {
  id: string;
  seriesId: string;
  season: number;
  number: number;
  title: string | null;
  /** An ISO date, or `null`. */
  airDate: string | null;
  runtimeMinutes: number | null;
  watched: boolean;
  resumePositionSeconds: number;
  /** Derived from `watched` + `resumePositionSeconds`; never stored. */
  status: WatchStatus;
  videoPath: string;
  subtitles: Subtitle[];
  lastWatchedAt: string | null;
}

/** The Series tab in one call: every series, and the episode total. */
export interface SeriesHomePayload {
  series: Series[];
  /** Episodes across every series — the tab's `N series · M episodes`. */
  episodeCount: number;
}

/** One season of a series: its episodes in order, and its own next episode. */
export interface SeasonSummary {
  number: number;
  episodes: Episode[];
  /** The season's **Next episode**, derived on the server. */
  next: Episode | null;
}

/** The series page in one read: the series, its seasons, its next episode. */
export interface SeriesDetail {
  series: Series;
  seasons: SeasonSummary[];
  /** The series' **Next episode** across every season; `null` for none. */
  next: Episode | null;
}

/** A series as the library is given it; everything but the title optional. */
export interface NewSeries {
  title: string;
  tmdbId?: number;
  year?: number;
  endYear?: number;
  synopsis?: string;
  creator?: string;
  cast?: string[];
  rating?: number;
  posterPath?: string;
  backdropPath?: string;
  genres?: string[];
}

/** An episode as the library is given it, under a series it already holds. */
export interface NewEpisode {
  season: number;
  number: number;
  videoPath: string;
  title?: string;
  airDate?: string;
  runtimeMinutes?: number;
}
