import Database from 'better-sqlite3';

import { migrations } from './migrations';

export type SqliteDatabase = Database.Database;

/** How long a blocked writer waits on a locked database before erroring. */
const BUSY_TIMEOUT_MS = 5000;

/**
 * Open a SQLite database at `dbPath`, apply the connection pragmas, run any
 * pending `PRAGMA user_version` migrations, and return the ready raw handle.
 *
 * This is the single seam over `better-sqlite3`; the `library/` repository and
 * (eventually) every other backend domain go through it. Verbose SQL tracing is
 * the one sanctioned `console.*` in the codebase, gated on `DEBUG_SQL === '1'`.
 */
export function openDatabase(dbPath: string): SqliteDatabase {
  const verbose = process.env.DEBUG_SQL === '1' ? console.info : undefined;
  const db = new Database(dbPath, { verbose });

  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);

  runMigrations(db);

  return db;
}

/**
 * Hand-rolled migration runner. Reads the database's `user_version`, then applies
 * every migration above it in order, each inside its own transaction so a failed
 * migration leaves the version untouched. Re-running on a current database is a
 * no-op.
 */
function runMigrations(db: SqliteDatabase): void {
  let current = Number(db.pragma('user_version', { simple: true }));

  for (const migration of migrations) {
    if (migration.version <= current) {
      continue;
    }

    const apply = db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    });
    apply();

    current = migration.version;
  }
}
