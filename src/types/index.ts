/**
 * Shared library-core types — the one model the frontend and the `library/`
 * repository agree on. The repository imports these rather than redefining its
 * own. See `docs/PRDs/01-library-core.md` and `docs/design-logs/01-library-core.md`.
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
}

/** A subtitle track as supplied when adding a movie (ids/positions are assigned). */
export interface NewSubtitle {
  path: string;
  language: string;
}

/**
 * Input to `addMovie`. `title` and `videoPath` are the only required fields;
 * everything else is optional and reads back as `null`/empty when omitted.
 * `genres` are genre names (resolved to ids); their order is preserved
 * (`genres[0]` = primary tag).
 */
export interface NewMovie {
  title: string;
  videoPath: string;
  tmdbId?: number;
  year?: number;
  runtimeMinutes?: number;
  synopsis?: string;
  director?: string;
  cast?: string[];
  rating?: number;
  isFavorite?: boolean;
  watched?: boolean;
  resumePositionSeconds?: number;
  posterPath?: string;
  backdropPath?: string;
  genres?: string[];
  subtitles?: NewSubtitle[];
}
