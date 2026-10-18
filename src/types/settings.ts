/**
 * The household's settings — what the Settings hub keeps, on the wire and in
 * the `settings` table of the library's database, so a preference travels with
 * the backup beside the movies. See `docs/PRDs/15-settings-hub.md` and
 * `docs/design-logs/15-settings-hub.md`.
 */

/**
 * The **Language pool**: what a subtitle may be filed under, and what both the
 * **Preferred subtitle language** and the **Preferred audio language** are
 * chosen from, in the order the prototype's dropdowns draw it. Spelled once,
 * here, and read by the places that must not drift: the **Movie form**'s
 * Subtitle row, the scanner's language tags, and the Playback card's two
 * pills, _Preferred subtitle language_ and _Preferred audio language_. The
 * `MOVIE_SORTS` precedent: an `as const` list its own union is derived from.
 *
 * A display vocabulary, not a constraint — a stored language is any string,
 * and neither the repository nor the route checks membership.
 */
export const LANGUAGE_POOL = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Italian',
  'Dutch',
] as const;

/** One of the names in {@link LANGUAGE_POOL}. */
export type PoolLanguage = (typeof LANGUAGE_POOL)[number];

/**
 * The language a fresh library prefers, and the one an untagged subtitle is
 * filed under. Applied by the server when the row is absent, so no client has
 * to know what it is.
 */
export const DEFAULT_SUBTITLE_LANGUAGE: PoolLanguage = 'English';

/** The **Preferred audio language** a fresh library opens a title on. */
export const DEFAULT_AUDIO_LANGUAGE: PoolLanguage = 'English';

/** **Ultrawide margins** until the household turns it on: off. */
export const DEFAULT_ULTRAWIDE_MARGINS = false;

/** _Fill in ratings from TMDB_ until the household turns it off: on. */
export const DEFAULT_TMDB_RATINGS = true;

/**
 * What `GET /api/settings` answers: every preference the household keeps, the
 * default already applied. `subtitleLanguage` and `audioLanguage` are strings
 * rather than {@link PoolLanguage}s because the pool is a vocabulary, not a
 * constraint.
 */
export interface Settings {
  /** Which track the player uses whenever subtitles are shown. */
  subtitleLanguage: string;
  /** Which audio track the player opens a title on, when it has several. */
  audioLanguage: string;
  /** Whether every screen but the player sits in the centred **Content frame**. */
  ultrawideMargins: boolean;
  /** Whether an unrated title draws its TMDB score as its stars. */
  tmdbRatings: boolean;
}

/**
 * What the Storage group reads: where the managed media lives, how much of the
 * disk it takes, and how many movies that is.
 */
export interface StorageReport {
  /** The managed media directory, as the server resolved it. */
  mediaPath: string;
  /** The bytes under it, summed. */
  bytesUsed: number;
  /** How many movies the library holds. */
  movieCount: number;
}
