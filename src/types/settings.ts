/**
 * The household's settings — what the Settings hub keeps, on the wire and in
 * the `settings` table of the library's database, so a preference travels with
 * the backup beside the movies. See `docs/PRDs/15-settings-hub.md` and
 * `docs/design-logs/15-settings-hub.md`.
 */

/**
 * The **Language pool** a subtitle may be filed under, in the order the
 * prototype's dropdown draws it. Spelled once, here, and read by three places
 * that must not drift: the **Movie form**'s Subtitle row, the scanner's
 * language tags, and the Settings hub's _Preferred language_ pill. The
 * `MOVIE_SORTS` precedent: an `as const` list its own union is derived from.
 *
 * A display vocabulary, not a constraint — a stored language is any string,
 * and neither the repository nor the route checks membership.
 */
export const SUBTITLE_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Italian',
  'Dutch',
] as const;

/** One of the names in {@link SUBTITLE_LANGUAGES}. */
export type SubtitleLanguage = (typeof SUBTITLE_LANGUAGES)[number];

/**
 * The language a fresh library prefers, and the one an untagged subtitle is
 * filed under. Applied by the server when the row is absent, so no client has
 * to know what it is.
 */
export const DEFAULT_SUBTITLE_LANGUAGE: SubtitleLanguage = 'English';

/**
 * What `GET /api/settings` answers: every preference the household keeps, the
 * default already applied. `subtitleLanguage` is a string rather than a
 * {@link SubtitleLanguage} because the pool is a vocabulary, not a constraint.
 */
export interface Settings {
  /** Which track the player uses whenever subtitles are shown. */
  subtitleLanguage: string;
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
