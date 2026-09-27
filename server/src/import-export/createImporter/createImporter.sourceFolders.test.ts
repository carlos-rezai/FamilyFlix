// @vitest-environment node
//
// 23 — Enrichment, Phase 7: "remember the library root and source folders"
// (issue #210).
//
// A **Sync** writing back into the collection needs to know where each title
// came from, and the app used to forget it the moment the copy finished. So
// the importer now remembers:
//
// - `library-root` in the `settings` table, on Start — the one absolute path
//   the library keeps, the maintainer's own typing;
// - `source_folder` on every **Movie** and **Series** it adds **or** finds
//   **Already in library** — **relative to that root**, so no absolute path
//   from the source machine lands on a row (CLAUDE.md's rule). Finding one
//   already there is what lets a re-run backfill a library imported before
//   this shipped, and a re-run still adds nothing else.
//
// `sourceFolder` stays server-side — no shared type carries it — so what is
// asserted is the row itself, read straight off an on-disk database the real
// library writes to. The runs are real: the fixture trees copied under a
// sandbox **Library root**, a real `Media` over a sandbox managed directory,
// the absent **Playback component**.

import { mkdirSync, readdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { openDatabase, type SqliteDatabase } from '../../db';
import { createSqliteStorage, type LibraryStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

/**
 * A library on disk under one sandbox, a raw connection to the same file for
 * reading rows the library never hands out, a managed directory, the fixture
 * (films or series) copied in as the **Library root**, and the importer.
 */
function sandbox(fixture: 'films' | 'series' = 'films'): {
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  media: string;
  root: string;
  sheet: string;
} {
  const dir = sandboxRoot('familyflix-import-source-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } =
    fixture === 'films'
      ? libraryFixture(dir, 'library.csv')
      : seriesFixture(dir, 'library.csv');

  const dbPath = join(dir, 'familyflix.db');
  const storage = track(createSqliteStorage(dbPath));
  const db = track(openDatabase(dbPath));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null)),
  });
  return { storage, db, importer, media, root, sheet };
}

/** The snapshot once the run has reached review — or a failure if it never does. */
async function untilReview(importer: Importer): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const run = importer.current();
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** One whole run, then the run let go, so another may start. */
async function runOnce(
  importer: Importer,
  sheet: string,
  root: string
): Promise<ImportRun> {
  await importer.start(sheet, root);
  const run = await untilReview(importer);
  await importer.cancel();
  return run;
}

/** Each title's `source_folder` in one table, by title. */
function sourceFolders(
  db: SqliteDatabase,
  table: 'movies' | 'series'
): Record<string, string | null> {
  const rows = db
    .prepare(`SELECT title, source_folder FROM ${table}`)
    .all() as Array<{ title: string; source_folder: string | null }>;
  return Object.fromEntries(rows.map((row) => [row.title, row.source_folder]));
}

/** A stored `source_folder`, checked relative, and resolved under `root`. */
function resolvedUnder(root: string, folder: string | null): string {
  expect(folder).not.toBeNull();
  expect(isAbsolute(folder ?? '')).toBe(false);
  return join(root, folder ?? '');
}

/** Every file under a tree, by relative path. */
function treeOf(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? treeOf(join(dir, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`]
    )
    .sort();
}

/** Every row of every library table but `settings`, as it stands. */
function libraryRows(db: SqliteDatabase): Record<string, unknown[]> {
  const tables = (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'settings' ORDER BY name"
      )
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
  return Object.fromEntries(
    tables.map((table) => [table, db.prepare(`SELECT * FROM ${table}`).all()])
  );
}

describe('createImporter — the Library root is remembered on Start', () => {
  it('stores library-root as the run starts', async () => {
    const { storage, importer, root, sheet } = sandbox();

    await importer.start(sheet, root);

    expect(storage.libraryRoot()).toBe(root);
    await untilReview(importer);
  });

  it('keeps it in the settings table under library-root', async () => {
    const { db, importer, root, sheet } = sandbox();

    await runOnce(importer, sheet, root);

    expect(
      db.prepare("SELECT value FROM settings WHERE key = 'library-root'").get()
    ).toEqual({ value: root });
  });

  it('replaces the root a previous import remembered', async () => {
    const { storage, importer, root, sheet } = sandbox();
    storage.setLibraryRoot('E:\\Somewhere else');

    await runOnce(importer, sheet, root);

    expect(storage.libraryRoot()).toBe(root);
  });
});

describe('createImporter — an added title carries its Source folder', () => {
  it('records each added film’s folder relative to the root', async () => {
    const { db, importer, root, sheet } = sandbox();

    await runOnce(importer, sheet, root);

    const folders = sourceFolders(db, 'movies');
    expect(resolvedUnder(root, folders['Die Hard'])).toBe(
      join(root, 'Die.Hard.1988.1080p')
    );
    // A folder the walk had to descend to reach keeps the part in between.
    expect(resolvedUnder(root, folders['Amélie'])).toBe(
      join(root, 'Drama', 'Amelie (2001)')
    );
  });

  it('records each added series’ Show folder relative to the root', async () => {
    const { db, importer, root, sheet } = sandbox('series');

    await runOnce(importer, sheet, root);

    const folders = sourceFolders(db, 'series');
    expect(resolvedUnder(root, folders['Harbor & Vine'])).toBe(
      join(root, 'Harbor & Vine (2021)')
    );
    expect(resolvedUnder(root, folders['Tidewater'])).toBe(
      join(root, 'Tidewater (2018)')
    );
  });

  it.each([['films' as const], ['series' as const]])(
    'lands no absolute path and no piece of the root on any library row (%s)',
    async (fixture) => {
      const { db, importer, root, sheet } = sandbox(fixture);

      await runOnce(importer, sheet, root);

      const values = Object.values(libraryRows(db))
        .flat()
        .flatMap((row) => Object.values(row as Record<string, unknown>))
        .filter((value): value is string => typeof value === 'string');
      expect(values.length).toBeGreaterThan(0);
      for (const value of values) {
        expect(isAbsolute(value), value).toBe(false);
        expect(value.includes(root), value).toBe(false);
      }
    }
  );
});

describe('createImporter — an Already-in-library title carries its Source folder', () => {
  it('records the folder on a film the library already held', async () => {
    const { storage, db, importer, root, sheet } = sandbox();
    const held = storage.addMovie({
      title: 'Die Hard',
      year: 1988,
      videoPath: 'die-hard-1988/video.mp4',
    });

    await runOnce(importer, sheet, root);

    const row = db
      .prepare('SELECT source_folder FROM movies WHERE id = ?')
      .get(held.id) as { source_folder: string | null };
    expect(resolvedUnder(root, row.source_folder)).toBe(
      join(root, 'Die.Hard.1988.1080p')
    );
    expect(
      storage.listMovies({ sort: 'a-z' }).filter((m) => m.title === 'Die Hard')
    ).toHaveLength(1);
  });

  it('records the folder on a series the library already held', async () => {
    const { storage, db, importer, root, sheet } = sandbox('series');
    const held = storage.addSeries({ title: 'Tidewater', year: 2018 });

    await runOnce(importer, sheet, root);

    const row = db
      .prepare('SELECT source_folder FROM series WHERE id = ?')
      .get(held.id) as { source_folder: string | null };
    expect(resolvedUnder(root, row.source_folder)).toBe(
      join(root, 'Tidewater (2018)')
    );
  });
});

describe('createImporter — a re-run backfills a library imported before', () => {
  it.each([['films' as const], ['series' as const]])(
    'restores every source_folder and adds nothing else (%s)',
    async (fixture) => {
      const { db, importer, media, root, sheet } = sandbox(fixture);
      await runOnce(importer, sheet, root);
      const table = fixture === 'films' ? 'movies' : 'series';
      const recorded = sourceFolders(db, table);
      // The library as an import from before this shipped left it.
      db.prepare(`UPDATE ${table} SET source_folder = NULL`).run();
      const before = libraryRows(db);
      const tree = treeOf(media);

      const run = await runOnce(importer, sheet, root);

      expect(sourceFolders(db, table)).toEqual(recorded);
      expect(Object.values(recorded).every((folder) => folder !== null)).toBe(
        true
      );
      // Everything but the backfilled column — and the stamp that says the
      // row was touched — reads exactly as it did.
      const strip = (rows: Record<string, unknown[]>) =>
        Object.fromEntries(
          Object.entries(rows).map(([name, list]) => [
            name,
            list.map((row) => {
              const {
                source_folder: _folder,
                updated_at: _updated,
                ...rest
              } = row as Record<string, unknown>;
              return rest;
            }),
          ])
        );
      expect(strip(libraryRows(db))).toEqual(strip(before));
      expect(treeOf(media)).toEqual(tree);
      expect(run).toMatchObject({ total: 0, done: 0, problems: [] });
    }
  );
});
