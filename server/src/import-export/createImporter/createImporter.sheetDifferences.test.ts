// @vitest-environment node
//
// 40 — Import review, Phase 3: "Sheet differences" (issue #333).
//
// A **Sheet row** for a title the library already holds, with fields filled
// on both sides that differ, ends the run as one `differs` **Problem** — the
// second soft kind, carrying `movieId` or `seriesId` and its **Sheet
// differences**, both sides spelled for reading — and the title's fields are
// left as they were. `apply(id, choices)` writes the sheet's side of each
// field chosen `sheet`, a series' rating among them, and takes the Problem
// off; `false` for an id not there. _Keep all mine_ is the row's Skip — a
// `dismiss` — and writes nothing, so a second run over the same sheet raises
// the kept difference again. The review's first tile, `matched`, counts only
// new imports: a held title is never one.
//
// The runs are real, `createImporter.sheetFills.test.ts`' sandbox: the two
// fixtures copied into two sandboxed Library folders, one sheet naming all
// four titles, a real `Media`, the absent Playback component, and a raw
// handle on the same database to set what a test means the sheet to differ
// from.

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
import type { ImportProblem, ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  /** One sheet naming the two films and the two shows. */
  sheet: string;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-sheet-differences-');
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
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  storage.addLibraryFolder(films);
  storage.addLibraryFolder(shows);
  return { storage, db, importer, sheet };
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

/** A run started and left in review, for `apply` and `dismiss` to settle. */
async function runToReview(importer: Importer, sheet: string) {
  await importer.start(sheet);
  return untilReview(importer);
}

/** A whole run, let go once it reaches review. */
async function runOnce(importer: Importer, sheet: string): Promise<ImportRun> {
  const run = await runToReview(importer, sheet);
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

const differsOf = (run: ImportRun): ImportProblem[] =>
  run.problems.filter((problem) => problem.kind === 'differs');

const REASON =
  'The spreadsheet has different values for fields you already filled in.';

/** The library imported once, then Die Hard's director and rating changed. */
async function filmDiffers(): Promise<Sandbox & { id: string }> {
  const box = sandbox();
  await runOnce(box.importer, box.sheet);
  const id = idOf(box.db, 'movies', 'Die Hard');
  box.db
    .prepare(
      "UPDATE movies SET director = 'Renny Harlin', rating = 5 WHERE id = ?"
    )
    .run(id);
  return { ...box, id };
}

/** The library imported once, then Harbor & Vine's creator and rating changed. */
async function seriesDiffers(): Promise<Sandbox & { id: string }> {
  const box = sandbox();
  await runOnce(box.importer, box.sheet);
  const id = idOf(box.db, 'series', 'Harbor & Vine');
  box.db
    .prepare("UPDATE series SET creator = 'Ada Brook', rating = 3 WHERE id = ?")
    .run(id);
  return { ...box, id };
}

describe('createImporter.start — a held film whose row differs', () => {
  it('ends the run as one differs Problem carrying its movie', async () => {
    const box = await filmDiffers();

    const run = await runOnce(box.importer, box.sheet);

    const differs = differsOf(run);
    expect(differs).toHaveLength(1);
    expect(differs[0]).toMatchObject({
      kind: 'differs',
      reason: REASON,
      movieId: box.id,
    });
    expect(differs[0].title).toMatch(/^Die Hard/);
  });

  it('carries each difference, both sides spelled, in the field order', async () => {
    const box = await filmDiffers();

    const [problem] = differsOf(await runOnce(box.importer, box.sheet));

    expect(problem.differences?.map((difference) => difference.field)).toEqual([
      'director',
      'rating',
    ]);
    expect(problem.differences?.[0]).toEqual({
      field: 'director',
      label: 'Director',
      mine: 'Renny Harlin',
      sheet: 'John McTiernan',
    });
    const rating = problem.differences?.[1];
    expect(rating?.label).toBe('Rating');
    expect(rating?.mine).not.toBe(rating?.sheet);
    expect(rating?.mine).not.toBe('5');
    expect(rating?.sheet).not.toBe('8');
  });

  it('leaves its fields as they were', async () => {
    const box = await filmDiffers();

    await runOnce(box.importer, box.sheet);

    expect(box.storage.getMovie(box.id)).toMatchObject({
      director: 'Renny Harlin',
      rating: 5,
    });
  });

  it('raises nothing for a held title whose row agrees', async () => {
    const box = sandbox();
    await runOnce(box.importer, box.sheet);

    const run = await runOnce(box.importer, box.sheet);

    expect(differsOf(run)).toEqual([]);
  });
});

describe('createImporter.start — a held series whose row differs', () => {
  it('ends the run as one differs Problem carrying its series', async () => {
    const box = await seriesDiffers();

    const run = await runOnce(box.importer, box.sheet);

    const differs = differsOf(run);
    expect(differs).toHaveLength(1);
    expect(differs[0]).toMatchObject({
      kind: 'differs',
      reason: REASON,
      seriesId: box.id,
    });
    expect(differs[0].movieId).toBeUndefined();
  });

  it('labels the director Created by', async () => {
    const box = await seriesDiffers();

    const [problem] = differsOf(await runOnce(box.importer, box.sheet));

    expect(problem.differences).toContainEqual({
      field: 'director',
      label: 'Created by',
      mine: 'Ada Brook',
      sheet: 'Mara Quinn',
    });
    expect(problem.differences?.map((difference) => difference.field)).toEqual([
      'director',
      'rating',
    ]);
  });

  it('leaves its fields as they were', async () => {
    const box = await seriesDiffers();

    await runOnce(box.importer, box.sheet);

    expect(box.storage.getSeriesDetail(box.id)?.series).toMatchObject({
      creator: 'Ada Brook',
      rating: 3,
    });
  });
});

describe('createImporter.apply — Apply choices', () => {
  it('writes only the fields chosen sheet, and answers true', async () => {
    const box = await filmDiffers();
    const [problem] = differsOf(await runToReview(box.importer, box.sheet));

    const applied = await box.importer.apply(problem.id, {
      director: 'sheet',
      rating: 'mine',
    });

    expect(applied).toBe(true);
    expect(box.storage.getMovie(box.id)).toMatchObject({
      director: 'John McTiernan',
      rating: 5,
    });
    await box.importer.cancel();
  });

  it('writes a series’ rating when it is chosen sheet, and keeps its creator', async () => {
    const box = await seriesDiffers();
    const [problem] = differsOf(await runToReview(box.importer, box.sheet));

    const applied = await box.importer.apply(problem.id, {
      director: 'mine',
      rating: 'sheet',
    });

    expect(applied).toBe(true);
    expect(box.storage.getSeriesDetail(box.id)?.series).toMatchObject({
      creator: 'Ada Brook',
      rating: 8,
    });
    await box.importer.cancel();
  });

  it('writes a series’ creator when it is chosen sheet', async () => {
    const box = await seriesDiffers();
    const [problem] = differsOf(await runToReview(box.importer, box.sheet));

    await box.importer.apply(problem.id, { director: 'sheet' });

    expect(box.storage.getSeriesDetail(box.id)?.series).toMatchObject({
      creator: 'Mara Quinn',
      rating: 3,
    });
    await box.importer.cancel();
  });

  it('writes an open run chosen sheet as an open run, its end year cleared', async () => {
    const box = await seriesDiffers();
    box.db
      .prepare('UPDATE series SET year = 2019, end_year = 2023 WHERE id = ?')
      .run(box.id);
    const text = readFileSync(box.sheet, 'utf8');
    expect(text).toContain('Harbor & Vine,2021,');
    writeFileSync(
      box.sheet,
      text.replace('Harbor & Vine,2021,', 'Harbor & Vine,2021-,')
    );
    const [problem] = differsOf(await runToReview(box.importer, box.sheet));

    await box.importer.apply(problem.id, { year: 'sheet' });

    expect(box.storage.getSeriesDetail(box.id)?.series).toMatchObject({
      year: 2021,
      endYear: null,
    });
    await box.importer.cancel();
  });

  it('writes a chosen cast as a fill would: each name trimmed, a blank one dropped', async () => {
    const box = await filmDiffers();
    box.storage.updateMovie(box.id, { cast: ['Bonnie Bedelia'] });
    writeFileSync(
      box.sheet,
      readFileSync(box.sheet, 'utf8').replace(
        '"Bruce Willis, Alan Rickman"',
        '" Bruce Willis , , Alan Rickman "'
      )
    );
    const [problem] = differsOf(await runToReview(box.importer, box.sheet));

    await box.importer.apply(problem.id, { cast: 'sheet' });

    expect(box.storage.getMovie(box.id)?.cast).toEqual([
      'Bruce Willis',
      'Alan Rickman',
    ]);
    await box.importer.cancel();
  });

  it('takes the Problem off the run', async () => {
    const box = await filmDiffers();
    const [problem] = differsOf(await runToReview(box.importer, box.sheet));

    await box.importer.apply(problem.id, { director: 'sheet' });

    expect(
      box.importer.current()?.problems.map((each) => each.id)
    ).not.toContain(problem.id);
    expect(box.importer.problem(problem.id)).toBeNull();
    await box.importer.cancel();
  });

  it('writes nothing for choices that keep every field', async () => {
    const box = await filmDiffers();
    const [problem] = differsOf(await runToReview(box.importer, box.sheet));

    await box.importer.apply(problem.id, {
      director: 'mine',
      rating: 'mine',
    });

    expect(box.storage.getMovie(box.id)).toMatchObject({
      director: 'Renny Harlin',
      rating: 5,
    });
    await box.importer.cancel();
  });

  it('answers false for an id that is not there, and writes nothing', async () => {
    const box = await filmDiffers();
    await runToReview(box.importer, box.sheet);

    const applied = await box.importer.apply('no-such-problem', {
      director: 'sheet',
    });

    expect(applied).toBe(false);
    expect(box.storage.getMovie(box.id)).toMatchObject({
      director: 'Renny Harlin',
    });
    expect(differsOf(box.importer.current() as ImportRun)).toHaveLength(1);
    await box.importer.cancel();
  });

  it('answers false a second time, once the Problem is gone', async () => {
    const box = await filmDiffers();
    const [problem] = differsOf(await runToReview(box.importer, box.sheet));
    await box.importer.apply(problem.id, { director: 'sheet' });

    expect(await box.importer.apply(problem.id, { rating: 'sheet' })).toBe(
      false
    );
    expect(box.storage.getMovie(box.id)).toMatchObject({ rating: 5 });
    await box.importer.cancel();
  });

  it('answers false when there is no run', async () => {
    const box = sandbox();

    expect(await box.importer.apply('p1', { director: 'sheet' })).toBe(false);
  });
});

describe('createImporter — Keep all mine', () => {
  it('is a dismiss, and writes nothing', async () => {
    const box = await filmDiffers();
    const [problem] = differsOf(await runToReview(box.importer, box.sheet));

    expect(box.importer.dismiss(problem.id)).toBe(true);

    expect(box.storage.getMovie(box.id)).toMatchObject({
      director: 'Renny Harlin',
      rating: 5,
    });
    await box.importer.cancel();
  });

  it('raises the kept difference again on a second run over the same sheet', async () => {
    const box = await filmDiffers();
    const [kept] = differsOf(await runToReview(box.importer, box.sheet));
    box.importer.dismiss(kept.id);
    await box.importer.cancel();

    const again = differsOf(await runOnce(box.importer, box.sheet));

    expect(again).toHaveLength(1);
    expect(again[0]).toMatchObject({ kind: 'differs', movieId: box.id });
    expect(again[0].differences?.map((difference) => difference.field)).toEqual(
      ['director', 'rating']
    );
  });

  it('raises a field kept by Apply choices again on a second run', async () => {
    const box = await filmDiffers();
    const [problem] = differsOf(await runToReview(box.importer, box.sheet));
    await box.importer.apply(problem.id, { director: 'sheet', rating: 'mine' });
    await box.importer.cancel();

    const again = differsOf(await runOnce(box.importer, box.sheet));

    expect(again).toHaveLength(1);
    expect(again[0].differences?.map((difference) => difference.field)).toEqual(
      ['rating']
    );
  });
});

describe('createImporter — matched counts only new imports', () => {
  it('counts every title on the first run', async () => {
    const box = sandbox();

    const run = await runOnce(box.importer, box.sheet);

    expect(run.matched).toBe(4);
  });

  it('counts none on a second run over the same sheet, films and shows alike', async () => {
    const box = sandbox();
    await runOnce(box.importer, box.sheet);

    const run = await runOnce(box.importer, box.sheet);

    expect(run.matched).toBe(0);
  });

  it('counts none for a held title raised as a difference', async () => {
    const box = await filmDiffers();

    const run = await runOnce(box.importer, box.sheet);

    expect(run.matched).toBe(0);
    expect(differsOf(run)).toHaveLength(1);
  });
});
