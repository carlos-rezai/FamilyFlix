/**
 * The repository's write contracts — what a caller hands in to create or amend
 * a `Movie`, as distinct from the assembled record that reads hand back.
 */

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
  /** An ISO watch stamp carried in with the record — what lets bulk import
   *  bring watch history over rather than flattening it. Omitted, the movie
   *  reads back as never watched. */
  lastWatchedAt?: string;
  posterPath?: string;
  backdropPath?: string;
  genres?: string[];
  subtitles?: NewSubtitle[];
}

/**
 * A general edit applied by `updateMovie` — the single entry point that can patch
 * any column. Every field is optional: a supplied key overwrites its column, an
 * omitted key leaves it untouched.
 *
 * It applies NO side-effect conventions — it writes exactly what it's given.
 * Unlike `markWatched`, setting `watched` does not auto-zero the resume position;
 * unlike `setResumePosition` (a hot single-column write), any edit here bumps
 * `updated_at`. The dedicated mutators (`markWatched`, `setResumePosition`,
 * `setFavorite`, `setRating`) still own those hot-path and side-effect behaviors.
 *
 * Supplying `genres` or `subtitles` REPLACES the whole collection (ids/positions
 * are reassigned); nullable scalars accept `null` to clear them (`rating: null`
 * is unrated, distinct from `0`). All paths stay relative, exactly as stored.
 */
export interface MoviePatch {
  title?: string;
  tmdbId?: number | null;
  year?: number | null;
  runtimeMinutes?: number | null;
  synopsis?: string | null;
  director?: string | null;
  cast?: string[];
  rating?: number | null;
  isFavorite?: boolean;
  watched?: boolean;
  resumePositionSeconds?: number;
  videoPath?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  genres?: string[];
  subtitles?: NewSubtitle[];
}
