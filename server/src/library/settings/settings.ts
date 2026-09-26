import type { SqliteDatabase } from '../../db';
import { DEFAULT_SUBTITLE_LANGUAGE, type Settings } from '@/types';

/** The household's preferred subtitle language. */
const SUBTITLE_LANGUAGE_KEY = 'subtitle-language';
/** The maintainer's TMDB key — beside the preferences, never one of them. */
const TMDB_KEY = 'tmdb-api-key';

/**
 * The settings slice: the household's preferences, read as one `Settings` with
 * the default applied, and written one key at a time — the same one-signal
 * shape as the curation mutators.
 */
export interface SettingsRepository {
  settings(): Settings;
  setSubtitleLanguage(language: string): void;
  tmdbKey(): string | null;
  setTmdbKey(key: string): void;
}

export function createSettings(db: SqliteDatabase): SettingsRepository {
  const selectValue = db.prepare('SELECT value FROM settings WHERE key = ?');
  // An upsert on the primary key: the second write replaces the first rather
  // than failing on the key, and writing the value already held is harmless.
  const upsertValue = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  function settings(): Settings {
    const row = selectValue.get(SUBTITLE_LANGUAGE_KEY) as
      | { value: string }
      | undefined;
    // Reading applies the default; it does not write it down as if chosen.
    return { subtitleLanguage: row?.value ?? DEFAULT_SUBTITLE_LANGUAGE };
  }

  function setSubtitleLanguage(language: string): void {
    upsertValue.run(SUBTITLE_LANGUAGE_KEY, language);
  }

  function tmdbKey(): string | null {
    const row = selectValue.get(TMDB_KEY) as { value: string } | undefined;
    return row?.value ?? null;
  }

  function setTmdbKey(key: string): void {
    upsertValue.run(TMDB_KEY, key);
  }

  return { settings, setSubtitleLanguage, tmdbKey, setTmdbKey };
}
