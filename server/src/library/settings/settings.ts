import type { SqliteDatabase } from '../../db';
import {
  DEFAULT_SUBTITLE_LANGUAGE,
  DEFAULT_ULTRAWIDE_MARGINS,
  type Settings,
} from '@/types';

/** The household's preferred subtitle language. */
const SUBTITLE_LANGUAGE_KEY = 'subtitle-language';
/** Whether the household keeps the Content frame on — `'1'` / `'0'`. */
const ULTRAWIDE_MARGINS_KEY = 'ultrawide-margins';
/** The maintainer's TMDB key — beside the preferences, never one of them. */
const TMDB_KEY = 'tmdb-api-key';
/** When a Sync last reached review — the library's, not a preference. */
const LAST_SYNCED_KEY = 'enrichment-last-synced-at';
/** The Library root the last import was handed — the maintainer's own typing. */
const LIBRARY_ROOT_KEY = 'library-root';

/**
 * The settings slice: the household's preferences, read as one `Settings` with
 * the default applied, and written one key at a time — the same one-signal
 * shape as the curation mutators.
 */
export interface SettingsRepository {
  settings(): Settings;
  setSubtitleLanguage(language: string): void;
  setUltrawideMargins(on: boolean): void;
  tmdbKey(): string | null;
  setTmdbKey(key: string): void;
  enrichmentLastSyncedAt(): string | null;
  setEnrichmentLastSyncedAt(at: string): void;
  libraryRoot(): string | null;
  setLibraryRoot(root: string): void;
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

  function settings(): Settings {
    // Reading applies the default; it does not write it down as if chosen.
    return {
      subtitleLanguage:
        valueOf(SUBTITLE_LANGUAGE_KEY) ?? DEFAULT_SUBTITLE_LANGUAGE,
      ultrawideMargins: ultrawideMargins(),
    };
  }

  function ultrawideMargins(): boolean {
    const stored = valueOf(ULTRAWIDE_MARGINS_KEY);
    return stored === null ? DEFAULT_ULTRAWIDE_MARGINS : stored === '1';
  }

  function setUltrawideMargins(on: boolean): void {
    upsertValue.run(ULTRAWIDE_MARGINS_KEY, on ? '1' : '0');
  }

  function setSubtitleLanguage(language: string): void {
    upsertValue.run(SUBTITLE_LANGUAGE_KEY, language);
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

  function libraryRoot(): string | null {
    return valueOf(LIBRARY_ROOT_KEY);
  }

  function setLibraryRoot(root: string): void {
    upsertValue.run(LIBRARY_ROOT_KEY, root);
  }

  return {
    settings,
    setSubtitleLanguage,
    setUltrawideMargins,
    tmdbKey,
    setTmdbKey,
    enrichmentLastSyncedAt,
    setEnrichmentLastSyncedAt,
    libraryRoot,
    setLibraryRoot,
  };
}
