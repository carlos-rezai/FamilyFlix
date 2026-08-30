/**
 * The canonical domain record and its parts — the one **Movie** the frontend
 * and the `library/` repository agree on. Everything else in `types/` is a
 * contract *about* this record: how it is queried, how it is written, and how
 * it is narrowed for display.
 */

/** Three-way watch state, derived from `watched` + `resumePositionSeconds`. */
export type WatchStatus = 'unwatched' | 'in-progress' | 'watched';

/** A genre tag from the seeded 12-genre pool. */
export interface Genre {
  id: string;
  name: string;
}

/** A subtitle track attached to a movie, in player track order. */
export interface Subtitle {
  id: string;
  path: string;
  language: string;
  position: number;
}

/** The fully-assembled movie model returned by repository reads. */
export interface Movie {
  id: string;
  tmdbId: number | null;
  title: string;
  year: number | null;
  runtimeMinutes: number | null;
  synopsis: string | null;
  director: string | null;
  cast: string[];
  rating: number | null;
  isFavorite: boolean;
  watched: boolean;
  resumePositionSeconds: number;
  /** Derived from `watched` + `resumePositionSeconds`; never stored. */
  status: WatchStatus;
  videoPath: string;
  posterPath: string | null;
  backdropPath: string | null;
  genres: Genre[];
  subtitles: Subtitle[];
  createdAt: string;
  updatedAt: string;
  /** When the movie was last watched, or `null` if it never was. Written only
   *  by the watch mutators (`setResumePosition`, `markWatched`); never by an
   *  ordinary edit. */
  lastWatchedAt: string | null;
}
