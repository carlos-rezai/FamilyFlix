import type { SqliteDatabase } from '../../db';
import {
  DEFAULT_AUDIO_LANGUAGE,
  DEFAULT_START_TAB,
  DEFAULT_SUBTITLE_LANGUAGE,
  DEFAULT_TMDB_RATINGS,
  DEFAULT_ULTRAWIDE_MARGINS,
  LIBRARY_TABS,
  type LibraryTab,
  type Settings,
} from '@/types';

/** The household's preferred subtitle language. */
const SUBTITLE_LANGUAGE_KEY = 'subtitle-language';
/** The household's **Preferred audio language**. */
const AUDIO_LANGUAGE_KEY = 'audio-language';
/** Whether the household keeps the Content frame on — `'1'` / `'0'`. */
const ULTRAWIDE_MARGINS_KEY = 'ultrawide-margins';
/** Whether an unrated title draws its TMDB score — `'1'` / `'0'`. */
const TMDB_RATINGS_KEY = 'tmdb-ratings';
/** The **Start tab**, stored as the tab's own name. */
const START_TAB_KEY = 'start-tab';
/** The maintainer's TMDB key — beside the preferences, never one of them. */
const TMDB_KEY = 'tmdb-api-key';
/** When a Sync last reached review — the library's, not a preference. */
const LAST_SYNCED_KEY = 'enrichment-last-synced-at';

/**
 * The settings slice: the household's preferences, read as one `Settings` with
 * the default applied, and written one key at a time — the same one-signal
 * shape as the curation mutators.
 */
export interface SettingsRepository {
  settings(): Settings;
  setSubtitleLanguage(language: string): void;
  setAudioLanguage(language: string): void;
  setUltrawideMargins(on: boolean): void;
  setTmdbRatings(on: boolean): void;
  setStartTab(tab: LibraryTab): void;
  tmdbKey(): string | null;
  setTmdbKey(key: string): void;
  enrichmentLastSyncedAt(): string | null;
  setEnrichmentLastSyncedAt(at: string): void;
}

export function createSettings(db: SqliteDatabase): SettingsRepository {
  const selectValue = db.prepare('SELECT value FROM settings WHERE key = ?');
  // An upsert on the primary key: the second write replaces the first rather
  // than failing on the key, and writing the value already held is harmless.
  const upsertValue = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  /** The value stored under `key`, or `null` when none is. */
  function valueOf(key: string): string | null {
    const row = selectValue.get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  /** The flag stored under `key` — `'1'` is on — or `fallback` when none is. */
  function flagOf(key: string, fallback: boolean): boolean {
    const stored = valueOf(key);
    return stored === null ? fallback : stored === '1';
  }

  /**
   * The choice stored under `key` when it is one of `choices`, else
   * `fallback`: a stored value no longer on the list reads as the default.
   */
  function choiceOf<T extends string>(
    key: string,
    choices: readonly T[],
    fallback: T
  ): T {
    const stored = valueOf(key);
    return choices.find((choice) => choice === stored) ?? fallback;
  }

  /** The flag under `key` written as `'1'` / `'0'`. */
  function setFlag(key: string, on: boolean): void {
    upsertValue.run(key, on ? '1' : '0');
  }

  function settings(): Settings {
    // Reading applies the default; it does not write it down as if chosen.
    return {
      subtitleLanguage:
        valueOf(SUBTITLE_LANGUAGE_KEY) ?? DEFAULT_SUBTITLE_LANGUAGE,
      audioLanguage: valueOf(AUDIO_LANGUAGE_KEY) ?? DEFAULT_AUDIO_LANGUAGE,
      ultrawideMargins: flagOf(
        ULTRAWIDE_MARGINS_KEY,
        DEFAULT_ULTRAWIDE_MARGINS
      ),
      tmdbRatings: flagOf(TMDB_RATINGS_KEY, DEFAULT_TMDB_RATINGS),
      startTab: choiceOf(START_TAB_KEY, LIBRARY_TABS, DEFAULT_START_TAB),
    };
  }

  function setUltrawideMargins(on: boolean): void {
    setFlag(ULTRAWIDE_MARGINS_KEY, on);
  }

  function setTmdbRatings(on: boolean): void {
    setFlag(TMDB_RATINGS_KEY, on);
  }

  function setStartTab(tab: LibraryTab): void {
    upsertValue.run(START_TAB_KEY, tab);
  }

  function setSubtitleLanguage(language: string): void {
    upsertValue.run(SUBTITLE_LANGUAGE_KEY, language);
  }

  function setAudioLanguage(language: string): void {
    upsertValue.run(AUDIO_LANGUAGE_KEY, language);
  }

  function tmdbKey(): string | null {
    return valueOf(TMDB_KEY);
  }

  function setTmdbKey(key: string): void {
    upsertValue.run(TMDB_KEY, key);
  }

  function enrichmentLastSyncedAt(): string | null {
    return valueOf(LAST_SYNCED_KEY);
  }

  function setEnrichmentLastSyncedAt(at: string): void {
    upsertValue.run(LAST_SYNCED_KEY, at);
  }

  return {
    settings,
    setSubtitleLanguage,
    setAudioLanguage,
    setUltrawideMargins,
    setTmdbRatings,
    setStartTab,
    tmdbKey,
    setTmdbKey,
    enrichmentLastSyncedAt,
    setEnrichmentLastSyncedAt,
  };
}
