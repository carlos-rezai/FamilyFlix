import { openDatabase } from '../db';

/**
 * The repository seam every consumer (routes, importer, player) reads and writes
 * the library through; nothing else in the app talks to SQLite.
 *
 * This is the Phase 1 shell: it opens and migrates the database. The movie
 * lifecycle, read, watch, and curation methods land in later slices (issues
 * for Phases 2–4).
 */
export interface LibraryStorage {
  /** Close the underlying database connection. */
  close(): void;
}

/**
 * Build a {@link LibraryStorage} backed by a SQLite database at `dbPath`. Opening
 * runs pending migrations, so a fresh database is created and seeded on first use.
 */
export function createSqliteStorage(dbPath: string): LibraryStorage {
  const db = openDatabase(dbPath);

  return {
    close() {
      db.close();
    },
  };
}
