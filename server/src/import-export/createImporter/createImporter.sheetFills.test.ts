// @vitest-environment node
//
// 40 — Import review, Phase 2: "Sheet fills on a held title" (issue #332).
//
// A **Sheet row** for a title the library already holds — at its matched
// Source folder, else by title key and year, with a folder or without — fills
// that title's empty fields during the run, as **Sheet fills**:
//
// - a film through `updateMovie`, its Watched mark through `markWatched`;
// - a series through `enrichSeries`, its rating through `setSeriesRating`,
//   and a held show still gains any new episode found on disk;
// - each title that took fills logs `✓ Updated    <title> — <fields>` as
//   `success`;
// - a field filled on both sides that differs is never filled;
// - Watched only marks an unwatched film; the title is never changed.
//
// The runs are real, `createImporter.sheetFolders.test.ts`' sandbox: the two
// fixtures copied into two sandboxed Library folders, one sheet naming all
// four titles, a real `Media`, the absent Playback component, and a raw
// handle on the same database to empty what a test means the sheet to fill.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

interface Sandbox {
  dir: string;
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  films: string;
  shows: string;
  /** One sheet naming the two films and the two shows. */
  sheet: string;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-sheet-fills-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  mkdirSync(join(dir, 'shows'));
  const { root: films, sheet: filmSheet } = libraryFixture(
    join(dir, 'films'),
    'library.csv'
  );
  const { root: shows, sheet: showSheet } = seriesFixture(
    join(dir, 'shows'),
    'library.csv'
  );

  const sheet = join(dir, 'both.csv');
  const showRows = readFileSync(showSheet, 'utf8').split(/\r?\n/).slice(1);
  writeFileSync(
    sheet,
    `${readFileSync(filmSheet, 'utf8').trimEnd()}\n${showRows.join('\n')}`
  );

  const dbPath = join(dir, 'familyflix.db');
  const storage = track(createSqliteStorage(dbPath));
  const db = track(openDatabase(dbPath));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null)),
  });
  return { dir, storage, db, importer, films, shows, sheet };
}

/** A copy of the sandbox's sheet with one replacement made. */
function sheetWith(box: Sandbox, from: string, to: string): string {
  const text = readFileSync(box.sheet, 'utf8');
  expect(text).toContain(from);
  const path = join(box.dir, `edited-${Date.now()}-${Math.random()}.csv`);
  writeFileSync(path, text.replace(from, to));
  return path;
}

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

async function runOnce(importer: Importer, sheet: string): Promise<ImportRun> {
  await importer.start(sheet);
  const run = await untilReview(importer);
  await importer.cancel();
  return run;
}

const idOf = (
  db: SqliteDatabase,
  table: 'movies' | 'series',
  title: string
): string =>
  (
    db.prepare(`SELECT id FROM ${table} WHERE title = ?`).get(title) as {
      id: string;
    }
  ).id;

/** Every sheet field of a held film emptied, its watch state left alone. */
function emptyFilm(db: SqliteDatabase, id: string): void {
  db.prepare(
    'UPDATE movies SET synopsis = NULL, director = NULL, cast = NULL, rating = NULL WHERE id = ?'
  ).run(id);
  db.prepare('DELETE FROM movie_genres WHERE movie_id = ?').run(id);
}

/** Every sheet field of a held series emptied. */
function emptySeries(db: SqliteDatabase, id: string): void {
  db.prepare(
    'UPDATE series SET synopsis = NULL, year = NULL, end_year = NULL, creator = NULL, cast = NULL, rating = NULL WHERE id = ?'
  ).run(id);
  db.prepare('DELETE FROM series_genres WHERE series_id = ?').run(id);
}

const genreNames = (genres: { name: string }[]): string[] =>
  genres.map((genre) => genre.name).sort();

const DIE_HARD = {
  synopsis: 'A New York cop takes on a tower full of thieves on Christmas Eve.',
  director: 'John McTiernan',
  cast: ['Bruce Willis', 'Alan Rickman'],
  rating: 8,
};

describe('createImporter.start — a held film with a folder takes the sheet’s fills', () => {
  it('fills every empty field from its row', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.films);
    await runOnce(box.importer, box.sheet);
    const id = idOf(box.db, 'movies', 'Die Hard');
    emptyFilm(box.db, id);

    await runOnce(box.importer, box.sheet);

    const movie = box.storage.getMovie(id);
    expect(movie).toMatchObject(DIE_HARD);
    expect(genreNames(movie?.genres ?? [])).toEqual(['Action', 'Thriller']);
  });

  it('logs ✓ Updated naming the fields it filled', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.films);
    await runOnce(box.importer, box.sheet);
    emptyFilm(box.db, idOf(box.db, 'movies', 'Die Hard'));

    const run = await runOnce(box.importer, box.sheet);

    expect(run.log).toContainEqual({
      text: '✓ Updated    Die Hard (1988) — synopsis, genres, director, cast, rating',
      kind: 'success',
    });
  });

  it('still logs Already in library for a held title with nothing to fill', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.films);
    await runOnce(box.importer, box.sheet);

    const run = await runOnce(box.importer, box.sheet);

    const texts = run.log.map((line) => line.text);
    expect(texts).toContain('· Already in library Die Hard (1988)');
    expect(texts.some((text) => text.startsWith('✓ Updated'))).toBe(false);
  });
});

describe('createImporter.start — a held film with no folder takes the sheet’s fills', () => {
  it('is reached by its title key and year and filled', async () => {
    const box = sandbox();
    // Only the shows are listed: no folder on disk names Die Hard.
    box.storage.addLibraryFolder(box.shows);
    const held = box.storage.addMovie({
      title: 'Die Hard',
      year: 1988,
      videoPath: 'die-hard-1988/video.mp4',
    });

    const run = await runOnce(box.importer, box.sheet);

    const movie = box.storage.getMovie(held.id);
    expect(movie).toMatchObject(DIE_HARD);
    expect(genreNames(movie?.genres ?? [])).toEqual(['Action', 'Thriller']);
    expect(run.log).toContainEqual({
      text: expect.stringMatching(
        /^✓ Updated {4}Die Hard \(1988\) — synopsis, genres, director, cast, rating/
      ) as unknown as string,
      kind: 'success',
    });
  });

  it('is not raised as a Problem', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.shows);
    box.storage.addMovie({
      title: 'Die Hard',
      year: 1988,
      videoPath: 'die-hard-1988/video.mp4',
    });

    const run = await runOnce(box.importer, box.sheet);

    expect(run.problems.map((problem) => problem.title)).not.toContain(
      'Die Hard'
    );
  });
});

describe('createImporter.start — a difference is never filled', () => {
  it('leaves a field filled on both sides that differs as it was, and fills the rest', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.films);
    await runOnce(box.importer, box.sheet);
    const id = idOf(box.db, 'movies', 'Die Hard');
    box.db
      .prepare(
        "UPDATE movies SET director = 'Renny Harlin', rating = 5, synopsis = NULL WHERE id = ?"
      )
      .run(id);

    const run = await runOnce(box.importer, box.sheet);

    expect(box.storage.getMovie(id)).toMatchObject({
      director: 'Renny Harlin',
      rating: 5,
      synopsis: DIE_HARD.synopsis,
    });
    expect(run.log).toContainEqual({
      text: '✓ Updated    Die Hard (1988) — synopsis',
      kind: 'success',
    });
  });
});

describe('createImporter.start — Watched only marks', () => {
  /** Die Hard held with no folder; the sheet's row says Watched. */
  function heldDieHard(box: Sandbox): string {
    box.storage.addLibraryFolder(box.shows);
    return box.storage.addMovie({
      title: 'Die Hard',
      year: 1988,
      videoPath: 'die-hard-1988/video.mp4',
    }).id;
  }

  it('marks an unwatched film watched', async () => {
    const box = sandbox();
    const id = heldDieHard(box);

    await runOnce(box.importer, box.sheet);

    expect(box.storage.getMovie(id)).toMatchObject({
      watched: true,
      status: 'watched',
    });
  });

  it('leaves a watched film as it was', async () => {
    const box = sandbox();
    const id = heldDieHard(box);
    box.storage.markWatched(id);
    const before = box.storage.getMovie(id);

    await runOnce(box.importer, box.sheet);

    const after = box.storage.getMovie(id);
    expect(after).toMatchObject({ watched: true, status: 'watched' });
    expect(after?.lastWatchedAt).toBe(before?.lastWatchedAt);
  });

  it('leaves a film in progress as it was', async () => {
    const box = sandbox();
    const id = heldDieHard(box);
    box.storage.setResumePosition(id, 600);

    await runOnce(box.importer, box.sheet);

    expect(box.storage.getMovie(id)).toMatchObject({
      watched: false,
      status: 'in-progress',
      resumePositionSeconds: 600,
    });
  });
});

describe('createImporter.start — a held series takes the sheet’s fills', () => {
  it('takes synopsis, Year range, genres, Created by, cast and rating', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.shows);
    await runOnce(box.importer, box.sheet);
    const id = idOf(box.db, 'series', 'Harbor & Vine');
    emptySeries(box.db, id);
    const ranged = sheetWith(
      box,
      'Harbor & Vine,2021,',
      'Harbor & Vine,2021-2023,'
    );

    const run = await runOnce(box.importer, ranged);

    const series = box.storage.getSeriesDetail(id)?.series;
    expect(series).toMatchObject({
      synopsis: 'Three generations keep a harbourside restaurant afloat.',
      year: 2021,
      endYear: 2023,
      creator: 'Mara Quinn',
      cast: ['Lena Ortiz', 'Tom Adeyemi'],
      rating: 8,
    });
    expect(genreNames(series?.genres ?? [])).toEqual(['Drama', 'Family']);
    expect(run.log).toContainEqual({
      text: '✓ Updated    Harbor & Vine (2021) — synopsis, year, genres, director, cast, rating',
      kind: 'success',
    });
  });

  it('still gains a new episode found on disk', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.shows);
    await runOnce(box.importer, box.sheet);
    const id = idOf(box.db, 'series', 'Harbor & Vine');
    emptySeries(box.db, id);
    const season = join(box.shows, 'Harbor & Vine (2021)', 'Season 01');
    writeFileSync(
      join(season, 'Harbor.and.Vine.S01E03.Closing.Time.mp4'),
      readFileSync(join(season, 'Harbor.and.Vine.S01E01.Pilot.mp4'))
    );

    await runOnce(box.importer, box.sheet);

    const detail = box.storage.getSeriesDetail(id);
    expect(
      detail?.seasons[0]?.episodes.map((episode) => episode.number)
    ).toEqual([1, 2, 3]);
    expect(detail?.series.synopsis).toBe(
      'Three generations keep a harbourside restaurant afloat.'
    );
  });
});

describe('createImporter.start — the title is never changed', () => {
  it('fills a held film whose title the row spells differently, and keeps its title', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.shows);
    const held = box.storage.addMovie({
      title: 'DIE HARD',
      year: 1988,
      videoPath: 'die-hard-1988/video.mp4',
    });

    await runOnce(box.importer, box.sheet);

    expect(box.storage.getMovie(held.id)).toMatchObject({
      title: 'DIE HARD',
      director: 'John McTiernan',
    });
  });

  it('keeps a held series’ title while filling it', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.shows);
    await runOnce(box.importer, box.sheet);
    const id = idOf(box.db, 'series', 'Tidewater');
    emptySeries(box.db, id);
    box.db
      .prepare("UPDATE series SET title = 'The Ferry' WHERE id = ?")
      .run(id);

    await runOnce(box.importer, box.sheet);

    expect(box.storage.getSeriesDetail(id)?.series).toMatchObject({
      title: 'The Ferry',
      creator: 'Ines Duarte',
    });
  });
});
