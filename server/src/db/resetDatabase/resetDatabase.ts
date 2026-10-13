import type { SqliteDatabase } from '..';

/**
 * Every table **Factory reset** erases, child-first so no foreign key is left
 * pointing at a row already gone: the joins, subtitles and Season posters
 * before the titles they hang off, the episodes before their series, and the
 * titles before the **Library folders** they were found in.
 */
export const ERASED_TABLES = [
  'movie_genres',
  'subtitles',
  'series_genres',
  'season_posters',
  'episode_subtitles',
  'episodes',
  'movies',
  'series',
  'library_folders',
  'settings',
] as const;

/**
 * Every table it keeps: the **Genre pool**, its ids untouched, so nothing is
 * re-seeded. A table a migration adds belongs in one list or the other — the
 * suite's guard refuses one in neither.
 */
export const KEPT_TABLES = ['genres'] as const;

/**
 * Erase every row of every {@link ERASED_TABLES} table in one transaction —
 * all of them or, on any refusal, none. `user_version` is left where the
 * migrations put it, and there is no `VACUUM`: the freed pages stay on the
 * free list for the library that fills them again.
 */
export function resetDatabase(db: SqliteDatabase): void {
  const statements = ERASED_TABLES.map((table) =>
    db.prepare(`DELETE FROM ${table}`)
  );
  db.transaction(() => {
    for (const statement of statements) {
      statement.run();
    }
  })();
}
