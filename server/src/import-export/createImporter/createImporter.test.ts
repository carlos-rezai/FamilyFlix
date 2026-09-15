// @vitest-environment node
//
// 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
//
// The importer — the injected domain, composed over a real `freshStorage`, a
// real `Media` over a sandbox managed directory, and the absent **Playback
// component** — run over the fixture: a two-film sheet and a folder tree copied
// under a sandbox **Library root**. What is asserted is what the run leaves
// behind: rows in the library, files under the managed directory, the snapshot
// `current()` answers along the way, and a source tree with not one byte
// changed.
//
// The fixture is real and checked in beside this file, because it is also what
// fills a dev library once the seed goes: `library.xlsx` / `library.csv` are the
// same two rows, and `root/` holds `Die.Hard.1988.1080p` beside a `Drama/`
// folder that has to be descended to reach `Amelie (2001)`. The videos are MP4
// headers alone — an `mvhd` saying how long each film is, which is all the
// runtime derivation reads on a machine with no FFmpeg — and nothing a player
// could show.
//
// The tracer bullet gave the importer `start` and `current`; issue #126 adds
// `cancel` — abort the in-flight copy, roll that one folder back, keep every
// movie already added, discard the run — and the **Already in library** skip:
// the library's titles are loaded once at start, and a row whose **Title key**
// and year are already there is neither a **Match** nor a **Problem**, which
// is what makes cancel-then-restart harmless. A row the matcher cannot settle
// is still neither imported nor shown; the **Problems** are the review slice's.
//
// Issue #128 gives the run its voice: the **Activity log** on the snapshot —
// the connecting line, one **Log line** per folder found, the found line, one
// per match imported, the complete line — plus the lines for what the run
// skipped or could not do (an already-in-library row, a blank title, an
// unknown genre name, a folder the scanner cannot read) and the two **Warning
// lines** that never block (no subtitle, no poster). The log is capped at 80
// lines, newest kept, so a snapshot stays small; and `currentItem` names the
// film's title while it is being copied, the folder while it is being found.
//
// Issue #129 makes **Problems** data: the matcher's other verdicts land on the
// snapshot — `no-folder`, `ambiguous` (two reasons), `no-video`, `no-row` — by
// the time the bar turns determinate; a copy that fails partway rolls its
// folder back and files `failed` with the OS's reason while the run goes on;
// a genre-less row imports and is listed as the soft `missing-meta` with its
// `movieId`; the complete line counts them all; and `dismiss` — the **Review
// step**'s _Skip_ — removes one and answers false for one that is not there.
//
// Issue #130 opens a **Problem** on the form: `problem` answers the **Problem
// detail** — row, folder, candidates, **Found files** — and `resolve` is
// _Save & continue_: copy the found files in from under the root and nowhere
// else, add the movie, dismiss the problem.
//
// Issue #133 is the edges a twelve-hour run meets that the two-film fixture
// does not: a title with quotes, diacritics or two hundred characters matches,
// imports and sits in a **Problem** whole; two matches with the same title and
// year land in two **Movie folders**, never one; a **Source folder** named
// with characters no **Movie folder** may carry imports into one named by the
// app's own rule; a subtitle tag the form does not know lands as English; and
// an importer composed afresh over the storage of an interrupted run — the app
// restarting mid-run — has no run and every movie already added.

import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { userInfo } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createImporter,
  ImportPathError,
  ProblemNotFoundError,
  type Importer,
  type ResolveForm,
} from './createImporter';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { heldCopy } from '../../test-support/heldCopy/heldCopy';
import {
  LIBRARY_FIXTURE,
  libraryFixture,
} from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { LibraryStorage } from '../../library';
import type {
  ImportProblem,
  ImportRun,
  LogLine,
  Movie,
  ProblemKind,
} from '@/types';

/**
 * A fresh library, a managed media directory and a copy of the fixture tree
 * under one sandbox, and the importer composed over the first two.
 *
 * `media` wraps the real `Media` for the tests that need to see or hold a
 * copy; `storage` wraps the real library for the one that counts how often it
 * is read. Every other test runs over the real ones.
 */
function sandbox({
  media: mediaSeam = (real) => real,
  storage: storageSeam = (real) => real,
}: {
  media?: (real: Media) => Media;
  storage?: (real: LibraryStorage) => LibraryStorage;
} = {}): {
  storage: LibraryStorage;
  importer: Importer;
  media: string;
  root: string;
  sheet: string;
} {
  const dir = sandboxRoot('familyflix-import-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } = libraryFixture(dir);

  const storage = freshStorage();
  const importer = createImporter({
    storage: storageSeam(storage),
    media: mediaSeam(createMedia(media)),
    playback: createPlayback(media, null),
  });
  return { storage, importer, media, root, sheet };
}

/** The **Movie folders** under a managed directory, by name. */
const folders = (media: string): string[] => readdirSync(media).sort();

/** Every file under a tree, by relative path, with its size and its bytes. */
function treeOf(dir: string): Record<string, { size: number; bytes: string }> {
  const files: Record<string, { size: number; bytes: string }> = {};
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else {
        files[relative(dir, path).split('\\').join('/')] = {
          size: statSync(path).size,
          bytes: readFileSync(path).toString('base64'),
        };
      }
    }
  };
  walk(dir);
  return files;
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

/** The library's movies, by title. */
function byTitle(storage: LibraryStorage): Record<string, Movie> {
  const movies: Record<string, Movie> = {};
  for (const movie of storage.listMovies({ sort: 'a-z' })) {
    movies[movie.title] = movie;
  }
  return movies;
}

describe('createImporter — the fixture becomes two movies', () => {
  it('adds both films to the library', async () => {
    const { storage, importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    expect(Object.keys(byTitle(storage)).sort()).toEqual([
      'Amélie',
      'Die Hard',
    ]);
  });

  it('carries every column of the sheet onto the row', async () => {
    const { storage, importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    const dieHard = byTitle(storage)['Die Hard'];
    expect(dieHard).toMatchObject({
      year: 1988,
      director: 'John McTiernan',
      cast: ['Bruce Willis', 'Alan Rickman'],
      synopsis:
        'A New York cop takes on a tower full of thieves on Christmas Eve.',
      rating: 8,
      watched: true,
    });
    expect(dieHard.genres.map((genre) => genre.name).sort()).toEqual([
      'Action',
      'Thriller',
    ]);

    const amelie = byTitle(storage)['Amélie'];
    expect(amelie).toMatchObject({
      year: 2001,
      director: 'Jean-Pierre Jeunet',
      cast: ['Audrey Tautou'],
      rating: 7,
      watched: false,
    });
    expect(amelie.genres.map((genre) => genre.name).sort()).toEqual([
      'Comedy',
      'Romance',
    ]);
  });

  it('copies the video, the poster, the backdrop and each subtitle into the movie folder', async () => {
    const { storage, importer, media, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    const dieHard = byTitle(storage)['Die Hard'];
    expect(dieHard.videoPath).toBe('die-hard-1988/Die.Hard.1988.1080p.mp4');
    expect(dieHard.posterPath).toBe('die-hard-1988/poster.jpg');
    expect(dieHard.backdropPath).toBe('die-hard-1988/fanart.jpg');
    expect(
      [...dieHard.subtitles]
        .sort((a, b) => a.position - b.position)
        .map((track) => [track.path, track.language])
    ).toEqual([
      ['die-hard-1988/Die.Hard.1988.1080p.en.srt', 'English'],
      ['die-hard-1988/Die.Hard.1988.1080p.pt.srt', 'Portuguese'],
    ]);

    // Every stored path resolves to a file with the source's own bytes.
    for (const stored of [
      dieHard.videoPath,
      dieHard.posterPath,
      dieHard.backdropPath,
      ...dieHard.subtitles.map((track) => track.path),
    ]) {
      const name = String(stored).split('/')[1];
      expect(readFileSync(join(media, String(stored)))).toEqual(
        readFileSync(join(root, 'Die.Hard.1988.1080p', name))
      );
    }
  });

  it('reaches a film in a descended folder and takes its named poster and backdrop', async () => {
    const { storage, importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    const amelie = byTitle(storage)['Amélie'];
    expect(amelie.videoPath).toBe('amelie-2001/Amelie.mp4');
    expect(amelie.posterPath).toBe('amelie-2001/cover.png');
    expect(amelie.backdropPath).toBe('amelie-2001/backdrop.png');
    expect(
      amelie.subtitles.map((track) => [track.path, track.language])
    ).toEqual([['amelie-2001/Amelie.srt', 'English']]);
  });

  it('derives the runtime from the copied video', async () => {
    const { storage, importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    // The fixture's headers say 132 and 122 minutes; nothing on the sheet
    // does, and `runtimeMinutes` is the one column with no field anywhere.
    expect(byTitle(storage)['Die Hard'].runtimeMinutes).toBe(132);
    expect(byTitle(storage)['Amélie'].runtimeMinutes).toBe(122);
  });

  it('leaves tmdbId null — nothing is looked up anywhere', async () => {
    const { storage, importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    for (const movie of Object.values(byTitle(storage))) {
      expect(movie.tmdbId).toBeNull();
    }
  });

  it('changes nothing under the library root', async () => {
    const { importer, root, sheet } = sandbox();
    const before = treeOf(root);

    await importer.start(sheet, root);
    await untilReview(importer);

    expect(treeOf(root)).toEqual(before);
  });

  it('reads the .csv spelling of the sheet to the same library', async () => {
    const { storage, importer, root } = sandbox();
    const csv = join(root, '..', 'library.csv');
    cpSync(join(LIBRARY_FIXTURE, 'library.csv'), csv);

    await importer.start(csv, root);
    await untilReview(importer);

    expect(Object.keys(byTitle(storage)).sort()).toEqual([
      'Amélie',
      'Die Hard',
    ]);
  });
});

describe('createImporter — a genre the pool does not know', () => {
  it('drops the genre from the row and still imports it', async () => {
    const { storage, importer, root } = sandbox();
    const sheet = join(root, '..', 'odd-genre.csv');
    writeFileSync(
      sheet,
      'Title,Year,Genre\nDie Hard,1988,Action / Kung-fu\n',
      'utf8'
    );

    await importer.start(sheet, root);
    await untilReview(importer);

    const dieHard = byTitle(storage)['Die Hard'];
    expect(dieHard).toBeDefined();
    expect(dieHard.genres.map((genre) => genre.name)).toEqual(['Action']);
  });

  it('imports a row whose every genre is unknown, with none', async () => {
    const { storage, importer, root } = sandbox();
    const sheet = join(root, '..', 'odd-genre.csv');
    writeFileSync(sheet, 'Title,Year,Genre\nDie Hard,1988,Kung-fu\n', 'utf8');

    await importer.start(sheet, root);
    await untilReview(importer);

    expect(byTitle(storage)['Die Hard'].genres).toEqual([]);
  });
});

describe('createImporter — the snapshot', () => {
  it('answers the run from start, with its problems empty', async () => {
    const { importer, root, sheet } = sandbox();

    const run = await importer.start(sheet, root);

    expect(run).toMatchObject({
      id: expect.any(String),
      phase: expect.stringMatching(/^(scanning|importing|review)$/),
      startedAt: expect.any(String),
      found: expect.any(Number),
      total: expect.any(Number),
      done: expect.any(Number),
      matched: expect.any(Number),
      currentItem: expect.any(String),
      log: expect.any(Array),
      problems: [],
    });
    // An ISO stamp, as every date in the app is.
    expect(new Date(run.startedAt).toISOString()).toBe(run.startedAt);
  });

  it('holds the same run under current() while it runs and once it is in review', async () => {
    const { importer, root, sheet } = sandbox();

    const started = await importer.start(sheet, root);
    const during = importer.current();
    const finished = await untilReview(importer);

    expect(during?.id).toBe(started.id);
    expect(finished.id).toBe(started.id);
    expect(importer.current()?.id).toBe(started.id);
  });

  it('counts the run out: two found, two matched, two of two done', async () => {
    const { importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run).toMatchObject({
      phase: 'review',
      found: 2,
      matched: 2,
      total: 2,
      done: 2,
      problems: [],
    });
  });

  it('names the folder being scanned under currentItem', async () => {
    // The walk is asynchronous, one `readdir` at a time, so a poll between
    // its turns sees the folder it is on. A hundred more folders make the
    // scan long enough to be seen at all.
    const { importer, root, sheet } = sandbox();
    aHundredFolders(root);
    const seen = new Set<string>();

    await importer.start(sheet, root);
    for (;;) {
      const run = importer.current();
      if (run === null || run.phase !== 'scanning') {
        break;
      }
      if (run.currentItem !== '') {
        seen.add(run.currentItem);
      }
      await new Promise((resolve) => setImmediate(resolve));
    }
    await untilReview(importer);

    expect(seen.size).toBeGreaterThan(0);
    for (const item of seen) {
      // A **Source folder** under the root — never a title off the sheet.
      expect(item.startsWith(root)).toBe(true);
      expect(statSync(item).isDirectory()).toBe(true);
    }
  });

  it('names the title being imported under currentItem', async () => {
    // Held on Amélie's video, mid-copy: what the running step shows under the
    // bar while importing is the film's title, not the folder it comes from.
    const hold = heldCopy('Amelie.mp4');
    const { importer, root, sheet } = sandbox({ media: hold.seam });
    await importer.start(sheet, root);
    await hold.reached;

    expect(importer.current()?.currentItem).toBe('Amélie');

    hold.release();
    await untilReview(importer);
  });

  it('answers null before any run has started', () => {
    const { importer } = sandbox();

    expect(importer.current()).toBeNull();
  });

  it('completes the scan before the first copy starts', async () => {
    const seen: (ImportRun | null)[] = [];
    let importer: Importer | null = null;
    const box = sandbox({
      media: (real) => ({
        ...real,
        copyIn: (...args) => {
          seen.push(importer?.current() ?? null);
          return real.copyIn(...args);
        },
      }),
    });
    importer = box.importer;

    await importer.start(box.sheet, box.root);
    await untilReview(importer);

    // By the first byte copied, every folder under the root has been found and
    // every row matched: the phase is importing, and `found` and `total` are
    // already the numbers review will show.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]).toMatchObject({ phase: 'importing', found: 2, total: 2 });
  });
});

describe('createImporter — refusing to start', () => {
  it('refuses a sheet that does not exist, on the sheet field', async () => {
    const { importer, root } = sandbox();

    await expect(
      importer.start(join(root, '..', 'missing.xlsx'), root)
    ).rejects.toMatchObject({
      field: 'sheet',
    });
    expect(importer.current()).toBeNull();
  });

  it('refuses a sheet that cannot be read, on the sheet field', async () => {
    const { importer, root } = sandbox();
    // A directory with a sheet's name: it exists, and opening it as a file fails.
    const sheet = join(root, '..', 'folder.xlsx');
    mkdirSync(sheet);

    await expect(importer.start(sheet, root)).rejects.toMatchObject({
      field: 'sheet',
    });
  });

  it('refuses a sheet that is neither .xlsx nor .csv, on the sheet field', async () => {
    const { importer, root } = sandbox();
    const sheet = join(root, '..', 'library.txt');
    writeFileSync(sheet, 'Title,Year\nDie Hard,1988\n');

    await expect(importer.start(sheet, root)).rejects.toMatchObject({
      field: 'sheet',
    });
  });

  it('refuses a sheet with no title column, on the sheet field', async () => {
    const { importer, root } = sandbox();
    const sheet = join(root, '..', 'no-title.csv');
    writeFileSync(sheet, 'Year,Genre\n1988,Action\n');

    await expect(importer.start(sheet, root)).rejects.toMatchObject({
      field: 'sheet',
    });
  });

  it('refuses a root that does not exist, on the root field', async () => {
    const { importer, root, sheet } = sandbox();

    await expect(
      importer.start(sheet, join(root, 'nowhere'))
    ).rejects.toMatchObject({
      field: 'root',
    });
    expect(importer.current()).toBeNull();
  });

  it('refuses a root that is not a directory, on the root field', async () => {
    const { importer, sheet } = sandbox();

    await expect(importer.start(sheet, sheet)).rejects.toMatchObject({
      field: 'root',
    });
  });

  it('carries a reason a screen can print', async () => {
    const { importer, root } = sandbox();

    await expect(
      importer.start(join(root, '..', 'missing.xlsx'), root)
    ).rejects.toMatchObject({
      message: expect.stringMatching(/\S/),
    });
  });

  it('refuses a second start while a run exists, and keeps the first', async () => {
    const { importer, root, sheet } = sandbox();

    const first = await importer.start(sheet, root);

    await expect(importer.start(sheet, root)).rejects.toThrow();
    expect(importer.current()?.id).toBe(first.id);
  });
});

/**
 * Cancel, mid-copy: the run is held on Amélie's video — Die Hard already
 * added, Amélie's folder reserved and its first byte not yet landed — and
 * `cancel` is called there. What must be true afterwards: the run is gone,
 * Die Hard is still in the library, Amélie never arrives, and the managed
 * directory holds no half-folder for her.
 *
 * `cancel` resolves once the in-flight copy has been dealt with and its
 * folder is gone; `current` answers `null` from then on. The gate is released
 * after the call and before the await, so the test holds whether the importer
 * aborts the copy or waits it out before rolling back.
 */
describe('createImporter — cancel', () => {
  it('discards the run: current answers null afterwards', async () => {
    const hold = heldCopy('Amelie.mp4');
    const { importer, root, sheet } = sandbox({ media: hold.seam });
    await importer.start(sheet, root);
    await hold.reached;

    const cancelled = importer.cancel();
    hold.release();
    await cancelled;

    expect(importer.current()).toBeNull();
  });

  it('keeps every movie added before the cancel', async () => {
    const hold = heldCopy('Amelie.mp4');
    const { storage, importer, root, sheet } = sandbox({ media: hold.seam });
    await importer.start(sheet, root);
    await hold.reached;

    const cancelled = importer.cancel();
    hold.release();
    await cancelled;

    expect(Object.keys(byTitle(storage))).toEqual(['Die Hard']);
    expect(byTitle(storage)['Die Hard'].videoPath).toBe(
      'die-hard-1988/Die.Hard.1988.1080p.mp4'
    );
  });

  it('aborts the in-flight copy and leaves no reserved folder behind for it', async () => {
    const hold = heldCopy('Amelie.mp4');
    const { storage, importer, media, root, sheet } = sandbox({
      media: hold.seam,
    });
    await importer.start(sheet, root);
    await hold.reached;
    // The folder is reserved before the first byte is copied into it.
    expect(folders(media)).toEqual(['amelie-2001', 'die-hard-1988']);

    const cancelled = importer.cancel();
    hold.release();
    await cancelled;

    expect(folders(media)).toEqual(['die-hard-1988']);
    expect(byTitle(storage)['Amélie']).toBeUndefined();
  });

  it('does not go on to the next match once cancelled', async () => {
    // Held on Die Hard's video, the first copy of the run: nothing has been
    // added yet, and nothing may be added after the cancel either.
    const hold = heldCopy('Die.Hard.1988.1080p.mp4');
    const { storage, importer, media, root, sheet } = sandbox({
      media: hold.seam,
    });
    await importer.start(sheet, root);
    await hold.reached;

    const cancelled = importer.cancel();
    hold.release();
    await cancelled;
    // Room for a run that wrongly went on to reach Amélie.
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(Object.keys(byTitle(storage))).toEqual([]);
    expect(folders(media)).toEqual([]);
    expect(importer.current()).toBeNull();
  });

  it('changes nothing under the library root', async () => {
    const hold = heldCopy('Amelie.mp4');
    const { importer, root, sheet } = sandbox({ media: hold.seam });
    const before = treeOf(root);
    await importer.start(sheet, root);
    await hold.reached;

    const cancelled = importer.cancel();
    hold.release();
    await cancelled;

    expect(treeOf(root)).toEqual(before);
  });

  it('discards a run that is already in review, so a new one can start', async () => {
    const { importer, root, sheet } = sandbox();
    const first = await importer.start(sheet, root);
    await untilReview(importer);

    await importer.cancel();

    expect(importer.current()).toBeNull();
    const second = await importer.start(sheet, root);
    expect(second.id).not.toBe(first.id);
    await untilReview(importer);
  });
});

/**
 * The **Already in library** skip: a row whose **Title key** and year are
 * already a movie in the library is neither a **Match** nor a **Problem**. The
 * titles are read once when the run starts, not once per row — a thousand-row
 * sheet is a thousand lookups otherwise.
 */
describe('createImporter — a row already in the library', () => {
  it('adds nothing on a second run of the same sheet', async () => {
    const { storage, importer, root, sheet } = sandbox();
    await importer.start(sheet, root);
    await untilReview(importer);
    await importer.cancel();

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(Object.keys(byTitle(storage)).sort()).toEqual([
      'Amélie',
      'Die Hard',
    ]);
    // Skipped rows are counted as neither: nothing to import, nothing to fix.
    expect(run).toMatchObject({
      phase: 'review',
      found: 2,
      matched: 0,
      total: 0,
      done: 0,
      problems: [],
    });
  });

  it('leaves the managed directory as the first run left it', async () => {
    const { importer, media, root, sheet } = sandbox();
    await importer.start(sheet, root);
    await untilReview(importer);
    const after = treeOf(media);
    await importer.cancel();

    await importer.start(sheet, root);
    await untilReview(importer);

    expect(treeOf(media)).toEqual(after);
  });

  it('skips by title key and year: the same film under another spelling, not a remake', async () => {
    const { storage, importer, root, sheet } = sandbox();
    // The key of `Die.Hard` is the key of `Die Hard`, and the year agrees:
    // the row is the film already there.
    storage.addMovie({
      title: 'Die.Hard',
      year: 1988,
      videoPath: 'elsewhere/die-hard.mp4',
    });
    // Key-equal, but another year: a different film, so the row imports.
    storage.addMovie({
      title: 'Amélie',
      year: 1995,
      videoPath: 'elsewhere/amelie-1995.mp4',
    });

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    const films = storage
      .listMovies({ sort: 'a-z' })
      .map((movie) => [movie.title, movie.year])
      .sort();
    expect(films).toEqual([
      ['Amélie', 1995],
      ['Amélie', 2001],
      ['Die.Hard', 1988],
    ]);
    expect(run).toMatchObject({ matched: 1, total: 1, done: 1, problems: [] });
  });

  it('reads the library once per run, not once per row', async () => {
    const reads = { count: 0 };
    const { importer, root } = sandbox({
      storage: (real) => ({
        ...real,
        listMovies: (query) => {
          reads.count += 1;
          return real.listMovies(query);
        },
        searchMovies: (text) => {
          reads.count += 1;
          return real.searchMovies(text);
        },
        getHome: (query) => {
          reads.count += 1;
          return real.getHome(query);
        },
      }),
    });
    // Three rows, so a per-row lookup would show as three reads.
    const sheet = join(root, '..', 'three.csv');
    writeFileSync(
      sheet,
      'Title,Year\nDie Hard,1988\nAmélie,2001\nThe Lantern Keeper,2019\n',
      'utf8'
    );

    await importer.start(sheet, root);
    await untilReview(importer);

    expect(reads.count).toBe(1);
  });
});

/**
 * Make a folder one the scanner cannot read — a deny-read ACL on Windows,
 * mode 000 elsewhere — and register its undoing. The undo runs in this file's
 * own `afterEach`, which Vitest runs before `sandboxRoot`'s, so the sandbox
 * can still be swept.
 */
const locked: (() => void)[] = [];
function lockFolder(dir: string): void {
  if (process.platform === 'win32') {
    const user = userInfo().username;
    const icacls = (args: string[]) =>
      execFileSync('icacls', [dir, ...args], {
        stdio: 'ignore',
        windowsHide: true,
      });
    icacls(['/deny', `${user}:(R)`]);
    locked.push(() => icacls(['/remove:d', user]));
  } else {
    chmodSync(dir, 0o000);
    locked.push(() => chmodSync(dir, 0o755));
  }
}
afterEach(() => {
  for (const unlock of locked.splice(0)) {
    unlock();
  }
});

/**
 * A third **Source folder** under the root for a film the fixture sheet does
 * not know — `The Lantern Keeper (2019)` — holding a video that is Amélie's
 * bytes under another name (a real `mvhd`, so the runtime derivation has
 * something to read), and whichever of a poster and a subtitle the test wants
 * beside it. Answers a sheet with the fixture's two rows and this one.
 */
function lanternKeeper(
  root: string,
  { poster, subtitle }: { poster: boolean; subtitle: boolean }
): { sheet: string; folder: string } {
  const folder = join(root, 'The Lantern Keeper (2019)');
  mkdirSync(folder);
  const amelie = join(root, 'Drama', 'Amelie (2001)');
  cpSync(join(amelie, 'Amelie.mp4'), join(folder, 'The.Lantern.Keeper.mp4'));
  if (poster) {
    cpSync(join(amelie, 'cover.png'), join(folder, 'poster.png'));
  }
  if (subtitle) {
    cpSync(join(amelie, 'Amelie.srt'), join(folder, 'The.Lantern.Keeper.srt'));
  }
  const sheet = join(root, '..', 'three.csv');
  writeFileSync(
    sheet,
    'Title,Year,Genre\nDie Hard,1988,Action\nAmélie,2001,Comedy\nThe Lantern Keeper,2019,Drama\n',
    'utf8'
  );
  return { sheet, folder };
}

/** A hundred more **Source folders** the sheet does not name, for the cap. */
function aHundredFolders(root: string): void {
  for (let n = 1; n <= 100; n += 1) {
    const name = `Film ${String(n).padStart(3, '0')}`;
    mkdirSync(join(root, name));
    writeFileSync(join(root, name, `${name}.mp4`), '');
  }
}

/** The log's texts, in order. */
const texts = (run: ImportRun): string[] => run.log.map((line) => line.text);

/** The log's lines matching a pattern, in order. */
const linesMatching = (run: ImportRun, pattern: RegExp): LogLine[] =>
  run.log.filter((line) => pattern.test(line.text));

/** Where the first line matching a pattern sits in the log, or -1. */
const indexOfLine = (run: ImportRun, pattern: RegExp): number =>
  run.log.findIndex((line) => pattern.test(line.text));

/** Where the last line matching a pattern sits in the log, or -1. */
const lastIndexOfLine = (run: ImportRun, pattern: RegExp): number =>
  run.log.length -
  1 -
  [...run.log].reverse().findIndex((line) => pattern.test(line.text));

/**
 * The **Activity log** over the two-film fixture: the story the prototype's
 * console tells, line for line, each with its **Log kind** — `info` to open,
 * `scan` per folder, `success` for the found, imported and complete lines.
 */
describe('createImporter — the Activity log', () => {
  it('opens with the connecting line, naming the root', async () => {
    const { importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.log[0]).toEqual({
      text: `Connecting to ${root} …`,
      kind: 'info',
    });
  });

  it('carries one scanning line per folder found, naming the folder', async () => {
    const { importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    const scanning = linesMatching(run, /^Scanning\s/);
    expect(scanning).toHaveLength(2);
    expect(scanning.map((line) => line.kind)).toEqual(['scan', 'scan']);
    expect(scanning.map((line) => line.text)).toEqual([
      expect.stringMatching(/^Scanning\s+.*Die\.Hard\.1988\.1080p$/),
      expect.stringMatching(/^Scanning\s+.*Amelie \(2001\)$/),
    ]);
  });

  it('says what the scan found and that the import starts', async () => {
    const { importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    const found = linesMatching(run, /^✓ Found /);
    expect(found).toHaveLength(1);
    expect(found[0]).toEqual({
      text: expect.stringMatching(
        /^✓ Found 2 movies across \d+ folders\. Starting import…$/
      ),
      kind: 'success',
    });
  });

  it('carries one imported line per match, naming the title', async () => {
    const { importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    const imported = linesMatching(run, /^✓ Imported\s/);
    expect(imported).toHaveLength(2);
    expect(imported.map((line) => line.kind)).toEqual(['success', 'success']);
    expect(imported.map((line) => line.text)).toEqual([
      expect.stringMatching(/^✓ Imported\s+Die Hard$/),
      expect.stringMatching(/^✓ Imported\s+Amélie$/),
    ]);
  });

  it('ends with the complete line, counting the imported and the flagged', async () => {
    const { importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    // The fixture gives the run nothing to flag: P is zero.
    expect(run.log[run.log.length - 1]).toEqual({
      text: '✓ Import complete — 2 imported, 0 need attention.',
      kind: 'success',
    });
  });

  it('tells the story in order: connect, scan, found, import, complete', async () => {
    const { importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(indexOfLine(run, /^Connecting to /)).toBe(0);
    expect(indexOfLine(run, /^Scanning\s/)).toBeGreaterThan(0);
    expect(indexOfLine(run, /^✓ Found /)).toBeGreaterThan(
      lastIndexOfLine(run, /^Scanning\s/)
    );
    expect(indexOfLine(run, /^✓ Imported\s/)).toBeGreaterThan(
      indexOfLine(run, /^✓ Found /)
    );
    expect(indexOfLine(run, /^✓ Import complete /)).toBe(run.log.length - 1);
  });
});

/**
 * The lines for what the run skips: a row already in the library, a row with
 * no title, a genre name the **Genre pool** does not know. None of them is a
 * **Problem** — each is a line, so nothing is silent and the maintainer
 * learns which spelling to fix.
 */
describe('createImporter — the lines for what is skipped', () => {
  it('logs an already-in-library row as skipped, by title and year', async () => {
    const { importer, root, sheet } = sandbox();
    await importer.start(sheet, root);
    await untilReview(importer);
    await importer.cancel();

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(texts(run)).toEqual(
      expect.arrayContaining([
        '– Already in library Die Hard (1988)',
        '– Already in library Amélie (2001)',
      ])
    );
    expect(linesMatching(run, /^✓ Imported\s/)).toHaveLength(0);
    expect(run.log[run.log.length - 1]).toEqual({
      text: '✓ Import complete — 0 imported, 0 need attention.',
      kind: 'success',
    });
  });

  it('logs a blank-title row as a warning, once, and still imports the rest', async () => {
    const { storage, importer, root } = sandbox();
    const sheet = join(root, '..', 'blank.csv');
    writeFileSync(
      sheet,
      'Title,Year\nDie Hard,1988\n,2001\nAmélie,2001\n',
      'utf8'
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    const blank = run.log.filter(
      (line) => line.kind === 'warning' && /title/i.test(line.text)
    );
    expect(blank).toHaveLength(1);
    expect(Object.keys(byTitle(storage)).sort()).toEqual([
      'Amélie',
      'Die Hard',
    ]);
  });

  it('logs an unknown genre name as a warning, once per name across the run', async () => {
    const { storage, importer, root } = sandbox();
    const sheet = join(root, '..', 'odd-genre.csv');
    // `Kung-fu` on both rows, `Wuxia` on one: one line each, not three.
    writeFileSync(
      sheet,
      'Title,Year,Genre\nDie Hard,1988,Action / Kung-fu\nAmélie,2001,Kung-fu; Wuxia\n',
      'utf8'
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    const kungFu = linesMatching(run, /Kung-fu/);
    const wuxia = linesMatching(run, /Wuxia/);
    expect(kungFu).toHaveLength(1);
    expect(wuxia).toHaveLength(1);
    expect(kungFu[0].kind).toBe('warning');
    expect(wuxia[0].kind).toBe('warning');
    // The one the pool knows is not warned about.
    expect(
      run.log.filter(
        (line) => line.kind === 'warning' && /Action/.test(line.text)
      )
    ).toHaveLength(0);
    expect(
      byTitle(storage)['Die Hard'].genres.map((genre) => genre.name)
    ).toEqual(['Action']);
  });
});

/**
 * A folder the scanner cannot read (permissions) is a **Warning line** and is
 * skipped — one locked directory never ends the run. It is named to sort
 * before both films, so a walk that stopped at it would find neither.
 */
describe('createImporter — a folder the scanner cannot read', () => {
  it('warns, skips it, and goes on to import the rest of the root', async () => {
    const { storage, importer, root, sheet } = sandbox();
    const shelf = join(root, 'A Locked Shelf');
    mkdirSync(shelf);
    lockFolder(shelf);

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.phase).toBe('review');
    expect(Object.keys(byTitle(storage)).sort()).toEqual([
      'Amélie',
      'Die Hard',
    ]);
    const warned = run.log.filter(
      (line) => line.kind === 'warning' && line.text.includes('A Locked Shelf')
    );
    expect(warned).toHaveLength(1);
  });
});

/**
 * The two **Warning lines** that never block: subtitles and posters are
 * optional on the form this run shares its save with, so a match without one
 * imports, and the log notes it — "⚠ {Title} — no subtitle track found" as
 * the prototype spells the first.
 */
describe('createImporter — a match with no subtitle, and one with no poster', () => {
  it('imports a match with no subtitle and logs the warning for it', async () => {
    const { storage, importer, root } = sandbox();
    const { sheet } = lanternKeeper(root, { poster: true, subtitle: false });

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    const lantern = byTitle(storage)['The Lantern Keeper'];
    expect(lantern).toBeDefined();
    expect(lantern.subtitles).toEqual([]);
    expect(run.log).toContainEqual({
      text: '⚠ The Lantern Keeper — no subtitle track found',
      kind: 'warning',
    });
    // The films that have one are not warned about.
    expect(linesMatching(run, /no subtitle track found/)).toHaveLength(1);
  });

  it('imports a match with no poster and logs a warning for it', async () => {
    const { storage, importer, root } = sandbox();
    const { sheet } = lanternKeeper(root, { poster: false, subtitle: true });

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    const lantern = byTitle(storage)['The Lantern Keeper'];
    expect(lantern).toBeDefined();
    expect(lantern.posterPath).toBeNull();
    const warned = run.log.filter(
      (line) => line.kind === 'warning' && /poster/i.test(line.text)
    );
    expect(warned).toHaveLength(1);
    expect(warned[0].text).toContain('The Lantern Keeper');
  });

  it('counts a match imported with a warning as done', async () => {
    const { importer, root } = sandbox();
    const { sheet } = lanternKeeper(root, { poster: false, subtitle: false });

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run).toMatchObject({ matched: 3, total: 3, done: 3 });
    expect(run.log[run.log.length - 1]).toEqual({
      text: '✓ Import complete — 3 imported, 0 need attention.',
      kind: 'success',
    });
  });
});

/**
 * The cap: a thousand-film run would put a thousand scanning lines on every
 * poll otherwise. Eighty, newest kept — the console reads the end of the
 * story, and the snapshot stays small.
 */
describe('createImporter — the log is capped at 80 lines', () => {
  it('never exceeds 80 lines and keeps the newest', async () => {
    const { importer, root, sheet } = sandbox();
    // A hundred scanning lines, and nothing to import for them — and a
    // problem each, which is the list's business, not the log's.
    aHundredFolders(root);

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.found).toBe(102);
    expect(run.log).toHaveLength(80);
    // A hundred folders the sheet does not name: a hundred `no-row` problems.
    expect(run.log[run.log.length - 1]).toEqual({
      text: '✓ Import complete — 2 imported, 100 need attention.',
      kind: 'success',
    });
    // The oldest lines are the ones that went.
    expect(linesMatching(run, /^Connecting to /)).toHaveLength(0);
    expect(linesMatching(run, /^Scanning\s+.*Film 001$/)).toHaveLength(0);
  });
});

/** The reason strings the review slice fixes, verbatim from the prototype. */
const REASON = {
  noFolder: 'No folder found matching this spreadsheet row.',
  twoFolders: 'Two folders look like plausible matches — pick one.',
  nearName: "One folder looks like a match, but the name isn't exact.",
  manyVideos: 'Folder matched, but it holds more than one video file.',
  noRow: "Folder isn't in the spreadsheet.",
  missingMeta:
    "Imported, but the row has no genre — it won't appear in any genre row.",
} as const;

/** A sheet beside the root, with whatever rows the test names under the header. */
function sheetOf(
  root: string,
  rows: string,
  header = 'Title,Year,Genre'
): string {
  const sheet = join(root, '..', 'sheet.csv');
  writeFileSync(sheet, `${header}\n${rows}`, 'utf8');
  return sheet;
}

/** The fixture's two rows, as a sheet a test can add a row to. */
const FIXTURE_ROWS = 'Die Hard,1988,Action\nAmélie,2001,Comedy\n';

/**
 * A **Source folder** under the root holding the video files it names — empty
 * files, because nothing here is ever copied: a folder the sheet does not
 * name, a second folder for a row that already has one, a folder with two
 * videos, are all things the run declines to import.
 */
function folderUnder(root: string, name: string, videos: string[]): string {
  const folder = join(root, name);
  mkdirSync(folder);
  for (const video of videos) {
    writeFileSync(join(folder, video), '');
  }
  return folder;
}

/**
 * A `Media` whose copy of the one source file whose path ends in `filename`
 * throws with `message` — a locked or vanishing file, as the OS reports it.
 * Every other copy goes through to the real one.
 */
function failCopyOf(filename: string, message: string): (real: Media) => Media {
  return (real) => ({
    ...real,
    copyIn: async (...args) => {
      if (args[1].endsWith(filename)) {
        throw new Error(message);
      }
      return real.copyIn(...args);
    },
  });
}

/** The run's problems of one kind. */
const ofKind = (run: ImportRun, kind: ProblemKind): ImportProblem[] =>
  run.problems.filter((problem) => problem.kind === kind);

/**
 * The matcher's other verdicts, on the snapshot as **Problems**: what the run
 * could not settle on its own, each with its kind, the title it is about and
 * the fixed reason. A row the run files is not imported; the rest of the sheet
 * still is.
 */
describe('createImporter — the matcher’s verdicts become problems', () => {
  it('files no-row for a folder the sheet does not name, and imports the rest', async () => {
    const { storage, importer, media, root, sheet } = sandbox();
    folderUnder(root, 'Ironwood (2018)', ['Ironwood.mp4']);

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([
      {
        id: expect.any(String),
        kind: 'no-row',
        title: 'Ironwood (2018)',
        reason: REASON.noRow,
      },
    ]);
    expect(Object.keys(byTitle(storage)).sort()).toEqual([
      'Amélie',
      'Die Hard',
    ]);
    expect(folders(media)).toEqual(['amelie-2001', 'die-hard-1988']);
  });

  it('files no-folder for a row no folder answers to', async () => {
    const { storage, importer, root } = sandbox();
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\n`
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([
      {
        id: expect.any(String),
        kind: 'no-folder',
        title: 'The Lantern Keeper',
        reason: REASON.noFolder,
      },
    ]);
    expect(byTitle(storage)['The Lantern Keeper']).toBeUndefined();
    expect(Object.keys(byTitle(storage))).toHaveLength(2);
  });

  it('files ambiguous for a row two folders answer to, and imports neither', async () => {
    const { storage, importer, media, root, sheet } = sandbox();
    folderUnder(root, 'Die Hard (1988)', ['Die Hard.mp4']);

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([
      {
        id: expect.any(String),
        kind: 'ambiguous',
        title: 'Die Hard',
        reason: REASON.twoFolders,
      },
    ]);
    expect(Object.keys(byTitle(storage))).toEqual(['Amélie']);
    expect(folders(media)).toEqual(['amelie-2001']);
  });

  it('files ambiguous, with the near-name reason, for a folder whose name only starts with the row’s', async () => {
    const { storage, importer, root } = sandbox();
    folderUnder(root, 'Aliens (1986)', ['Aliens.mp4']);
    const sheet = sheetOf(root, `${FIXTURE_ROWS}Alien,1979,Horror\n`);

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([
      {
        id: expect.any(String),
        kind: 'ambiguous',
        title: 'Alien',
        reason: REASON.nearName,
      },
    ]);
    expect(byTitle(storage)['Alien']).toBeUndefined();
  });

  it('gives every problem an id of its own', async () => {
    const { importer, root } = sandbox();
    folderUnder(root, 'Ironwood (2018)', ['Ironwood.mp4']);
    folderUnder(root, 'Aliens (1986)', ['Aliens.mp4']);
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\nAlien,1979,Horror\n`
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toHaveLength(3);
    const ids = run.problems.map((problem) => problem.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(id).not.toBe('');
    }
  });

  it('has every match-time problem on the snapshot by the time the bar turns determinate', async () => {
    const hold = heldCopy('Die.Hard.1988.1080p.mp4');
    const { importer, root } = sandbox({ media: hold.seam });
    folderUnder(root, 'Ironwood (2018)', ['Ironwood.mp4']);
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\n`
    );

    await importer.start(sheet, root);
    await hold.reached;
    const during = importer.current();
    hold.release();
    await untilReview(importer);

    // Held on the first byte of the first copy: the scan is over, the total
    // is known, and both problems are already there to be counted.
    expect(during).toMatchObject({ phase: 'importing', total: 2 });
    expect(during?.problems.map((problem) => problem.kind).sort()).toEqual([
      'no-folder',
      'no-row',
    ]);
  });
});

/**
 * `no-video`: the folder matched, but it holds more than one video file, and
 * the run will not guess which is the film. The zero case is the matcher's
 * table test — a walked folder always holds at least one.
 */
describe('createImporter — a matched folder holding two videos', () => {
  it('files no-video with the more-than-one reason, and imports nothing from it', async () => {
    const { storage, importer, media, root, sheet } = sandbox();
    const dieHard = join(root, 'Die.Hard.1988.1080p');
    cpSync(
      join(dieHard, 'Die.Hard.1988.1080p.mp4'),
      join(dieHard, 'Die.Hard.1988.1080p.mkv')
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([
      {
        id: expect.any(String),
        kind: 'no-video',
        title: 'Die Hard',
        reason: REASON.manyVideos,
      },
    ]);
    expect(Object.keys(byTitle(storage))).toEqual(['Amélie']);
    expect(folders(media)).toEqual(['amelie-2001']);
  });
});

/**
 * A copy that fails partway — a locked or vanishing file: the reserved
 * **Movie folder** is rolled back, `failed` is filed with the OS's reason, and
 * the run goes on to the next match rather than stopping there.
 */
describe('createImporter — a copy that fails partway', () => {
  it('leaves no folder behind, files failed with the reason, and still imports the next match', async () => {
    const { storage, importer, media, root, sheet } = sandbox({
      media: failCopyOf(
        'Die.Hard.1988.1080p.mp4',
        'EBUSY: resource busy or locked'
      ),
    });

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([
      {
        id: expect.any(String),
        kind: 'failed',
        title: 'Die Hard',
        reason: "Couldn't copy the video file: EBUSY: resource busy or locked.",
      },
    ]);
    expect(folders(media)).toEqual(['amelie-2001']);
    expect(Object.keys(byTitle(storage))).toEqual(['Amélie']);
  });

  it('files failed for a copy that fails on a file after the video, too', async () => {
    const { storage, importer, media, root, sheet } = sandbox({
      media: failCopyOf('poster.jpg', 'ENOENT: no such file or directory'),
    });

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(ofKind(run, 'failed')).toHaveLength(1);
    expect(ofKind(run, 'failed')[0].title).toBe('Die Hard');
    expect(folders(media)).toEqual(['amelie-2001']);
    expect(Object.keys(byTitle(storage))).toEqual(['Amélie']);
  });

  it('counts the failure in the complete line and still reaches review', async () => {
    const { importer, root, sheet } = sandbox({
      media: failCopyOf(
        'Die.Hard.1988.1080p.mp4',
        'EBUSY: resource busy or locked'
      ),
    });

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.phase).toBe('review');
    expect(run.log[run.log.length - 1]).toEqual({
      text: '✓ Import complete — 1 imported, 1 need attention.',
      kind: 'success',
    });
  });
});

/**
 * The one soft kind: a row with no genre imports — nothing about the film is
 * missing — and is then listed, carrying the `movieId` the library gave it,
 * because a film in no genre row is a film the family will not find.
 */
describe('createImporter — a genre-less row', () => {
  it('imports it and files missing-meta with its movieId', async () => {
    const { storage, importer, root } = sandbox();
    const sheet = sheetOf(root, 'Die Hard,1988,Action\nAmélie,2001,\n');

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    // Imported as any match is — counted, logged, done — and then listed.
    const amelie = byTitle(storage)['Amélie'];
    expect(amelie).toBeDefined();
    expect(amelie.genres).toEqual([]);
    expect(run).toMatchObject({ matched: 2, total: 2, done: 2 });
    expect(linesMatching(run, /^✓ Imported\s+Amélie$/)).toHaveLength(1);
    expect(run.problems).toEqual([
      {
        id: expect.any(String),
        kind: 'missing-meta',
        title: 'Amélie',
        reason: REASON.missingMeta,
        movieId: amelie.id,
      },
    ]);
  });

  it('files it for every row when the sheet has no genre column at all', async () => {
    const { storage, importer, root } = sandbox();
    const sheet = sheetOf(root, 'Die Hard,1988\nAmélie,2001\n', 'Title,Year');

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(Object.keys(byTitle(storage)).sort()).toEqual([
      'Amélie',
      'Die Hard',
    ]);
    expect(run.problems.map((problem) => problem.kind)).toEqual([
      'missing-meta',
      'missing-meta',
    ]);
    expect(run.problems.map((problem) => problem.movieId).sort()).toEqual(
      [byTitle(storage)['Amélie'].id, byTitle(storage)['Die Hard'].id].sort()
    );
  });
});

describe('createImporter — the complete line counts the problems', () => {
  it('counts a no-row folder and a no-folder row as needing attention', async () => {
    const { importer, root } = sandbox();
    folderUnder(root, 'Ironwood (2018)', ['Ironwood.mp4']);
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\n`
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toHaveLength(2);
    expect(run.log[run.log.length - 1]).toEqual({
      text: '✓ Import complete — 2 imported, 2 need attention.',
      kind: 'success',
    });
  });

  it('counts the soft kind too — it is listed, so it is counted', async () => {
    const { importer, root } = sandbox();
    const sheet = sheetOf(root, 'Die Hard,1988,Action\nAmélie,2001,\n');

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.log[run.log.length - 1]).toEqual({
      text: '✓ Import complete — 2 imported, 1 need attention.',
      kind: 'success',
    });
  });
});

/**
 * **Dismiss** — the **Review step**'s _Skip_: the problem is gone from the
 * snapshot, and nothing was imported for it. Gone is gone: a second dismiss of
 * the same id, an id that never was, and a dismiss with no run all answer
 * false, which the route turns into its `404`.
 */
describe('createImporter — dismiss', () => {
  it('removes the problem from the snapshot and answers true, importing nothing', async () => {
    const { storage, importer, media, root } = sandbox();
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\n`
    );
    await importer.start(sheet, root);
    const run = await untilReview(importer);
    const [problem] = run.problems;

    expect(importer.dismiss(problem.id)).toBe(true);

    expect(importer.current()?.problems).toEqual([]);
    expect(byTitle(storage)['The Lantern Keeper']).toBeUndefined();
    expect(folders(media)).toEqual(['amelie-2001', 'die-hard-1988']);
  });

  it('removes only the problem named, keeping the others', async () => {
    const { importer, root } = sandbox();
    folderUnder(root, 'Ironwood (2018)', ['Ironwood.mp4']);
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\n`
    );
    await importer.start(sheet, root);
    const run = await untilReview(importer);
    const noRow = ofKind(run, 'no-row')[0];
    const noFolder = ofKind(run, 'no-folder')[0];

    importer.dismiss(noRow.id);

    expect(importer.current()?.problems).toEqual([noFolder]);
  });

  it('answers false for a problem already dismissed', async () => {
    const { importer, root } = sandbox();
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\n`
    );
    await importer.start(sheet, root);
    const [problem] = (await untilReview(importer)).problems;
    importer.dismiss(problem.id);

    expect(importer.dismiss(problem.id)).toBe(false);
    expect(importer.current()?.problems).toEqual([]);
  });

  it('answers false for an id that never was', async () => {
    const { importer, root, sheet } = sandbox();
    await importer.start(sheet, root);
    await untilReview(importer);

    expect(importer.dismiss('no-such-problem')).toBe(false);
  });

  it('answers false when there is no run', () => {
    const { importer } = sandbox();

    expect(importer.dismiss('p1')).toBe(false);
  });

  it('leaves the snapshot a copy: a dismissed problem is gone from the next read, not from the last', async () => {
    const { importer, root } = sandbox();
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\n`
    );
    await importer.start(sheet, root);
    const before = await untilReview(importer);

    importer.dismiss(before.problems[0].id);

    expect(before.problems).toHaveLength(1);
    expect(importer.current()?.problems).toHaveLength(0);
  });
});

// --- 13 — Bulk import, Phase 5: Resolve — the found file and the resolve route (issue #130)
//
// Two more things the API layer can ask the domain for. `problem(id)` answers
// the **Problem detail** the form prefills from — the problem, the **Sheet
// row**, the matched **Source folder**, the candidates and the folder's
// **Found files** as absolute paths under the root — or `null` for an id that
// is not there. `resolve(id, form)` is _Save & continue_: the form's fields
// with each **File slot** as a **Found file** (`{ found }`, an absolute path)
// or a file the route already stored from bytes (`{ stored }`), copied in by
// the form's sequence, added as a movie, and the problem dismissed. A found
// path outside the **Current run**'s root is refused before anything is
// copied — the `mediaFilePath` boundary rule aimed at the **Library root**.

/**
 * A `Media` whose copy of the one source file whose path ends in `filename`
 * throws **once** — the first time only — and goes through to the real one
 * from then on. What turns the fixture's Die Hard into a `failed` problem the
 * run leaves behind, and lets Resolve copy the very same file afterwards.
 */
function failCopyOnce(
  filename: string,
  message: string
): (real: Media) => Media {
  let failed = false;
  return (real) => ({
    ...real,
    copyIn: async (...args) => {
      if (!failed && args[1].endsWith(filename)) {
        failed = true;
        throw new Error(message);
      }
      return real.copyIn(...args);
    },
  });
}

/** A sandbox whose run leaves Die Hard behind as a `failed` problem. */
async function failedDieHard(): Promise<
  ReturnType<typeof sandbox> & { problem: ImportProblem; dieHard: string }
> {
  const box = sandbox({
    media: failCopyOnce(
      'Die.Hard.1988.1080p.mp4',
      'EBUSY: resource busy or locked'
    ),
  });
  await box.importer.start(box.sheet, box.root);
  const run = await untilReview(box.importer);
  const [problem] = ofKind(run, 'failed');
  return { ...box, problem, dieHard: join(box.root, 'Die.Hard.1988.1080p') };
}

/** The fixture's Die Hard, as the form sends it back with every slot found. */
function dieHardForm(dieHard: string): ResolveForm {
  return {
    title: 'Die Hard',
    year: 1988,
    director: 'John McTiernan',
    synopsis:
      'A New York cop takes on a tower full of thieves on Christmas Eve.',
    rating: 8,
    cast: ['Bruce Willis', 'Alan Rickman'],
    genres: ['Action', 'Thriller'],
    video: { found: join(dieHard, 'Die.Hard.1988.1080p.mp4') },
    poster: { found: join(dieHard, 'poster.jpg') },
    subtitles: [
      {
        file: { found: join(dieHard, 'Die.Hard.1988.1080p.en.srt') },
        language: 'English',
      },
      {
        file: { found: join(dieHard, 'Die.Hard.1988.1080p.pt.srt') },
        language: 'Portuguese',
      },
    ],
  };
}

describe('createImporter — problem: the detail Resolve prefills from', () => {
  it('answers a failed problem with its row, its folder and every found file', async () => {
    const { importer, problem, dieHard } = await failedDieHard();

    const detail = importer.problem(problem.id);

    expect(detail).toMatchObject({
      id: problem.id,
      kind: 'failed',
      title: 'Die Hard',
      reason: problem.reason,
      row: {
        title: 'Die Hard',
        year: 1988,
        genres: ['Action', 'Thriller'],
        director: 'John McTiernan',
        cast: ['Bruce Willis', 'Alan Rickman'],
        synopsis:
          'A New York cop takes on a tower full of thieves on Christmas Eve.',
        rating: 8,
      },
      folder: dieHard,
      files: {
        video: join(dieHard, 'Die.Hard.1988.1080p.mp4'),
        poster: join(dieHard, 'poster.jpg'),
        backdrop: join(dieHard, 'fanart.jpg'),
        subtitles: [
          {
            path: join(dieHard, 'Die.Hard.1988.1080p.en.srt'),
            language: 'English',
          },
          {
            path: join(dieHard, 'Die.Hard.1988.1080p.pt.srt'),
            language: 'Portuguese',
          },
        ],
      },
    });
    expect(detail?.candidates).toEqual([]);
  });

  it('leaves the video slot of a no-video problem empty, and fills the rest from the folder', async () => {
    const { importer, root, sheet } = sandbox();
    const dieHard = join(root, 'Die.Hard.1988.1080p');
    cpSync(
      join(dieHard, 'Die.Hard.1988.1080p.mp4'),
      join(dieHard, 'Die.Hard.1988.1080p.mkv')
    );
    await importer.start(sheet, root);
    const [problem] = ofKind(await untilReview(importer), 'no-video');

    const detail = importer.problem(problem.id);

    // Two videos is no video: the run will not guess which is the film, and
    // neither does the detail — the maintainer picks. The artwork and the
    // tracks are not in doubt.
    expect(detail?.folder).toBe(dieHard);
    expect(detail?.files.video).toBeUndefined();
    expect(detail?.files.poster).toBe(join(dieHard, 'poster.jpg'));
    expect(detail?.files.subtitles).toHaveLength(2);
    expect(detail?.row.title).toBe('Die Hard');
  });

  it('names every candidate folder of an ambiguous problem', async () => {
    const { importer, root, sheet } = sandbox();
    const second = folderUnder(root, 'Die Hard (1988)', ['Die Hard.mp4']);
    await importer.start(sheet, root);
    const [problem] = ofKind(await untilReview(importer), 'ambiguous');

    const detail = importer.problem(problem.id);

    expect([...(detail?.candidates ?? [])].sort()).toEqual(
      [join(root, 'Die.Hard.1988.1080p'), second].sort()
    );
    expect(detail?.row).toMatchObject({ title: 'Die Hard', year: 1988 });
  });

  it('answers the row with no folder and no files for a no-folder problem', async () => {
    const { importer, root } = sandbox();
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\n`
    );
    await importer.start(sheet, root);
    const [problem] = ofKind(await untilReview(importer), 'no-folder');

    const detail = importer.problem(problem.id);

    expect(detail?.row).toMatchObject({
      title: 'The Lantern Keeper',
      year: 2019,
      genres: ['Drama'],
    });
    expect(detail?.folder).toBeUndefined();
    expect(detail?.candidates).toEqual([]);
    expect(detail?.files).toEqual({ subtitles: [] });
  });

  it('answers null for an id that never was', async () => {
    const { importer, root, sheet } = sandbox();
    await importer.start(sheet, root);
    await untilReview(importer);

    expect(importer.problem('no-such-problem')).toBeNull();
  });

  it('answers null for a problem already dismissed', async () => {
    const { importer, problem } = await failedDieHard();
    importer.dismiss(problem.id);

    expect(importer.problem(problem.id)).toBeNull();
  });

  it('answers null when there is no run', () => {
    const { importer } = sandbox();

    expect(importer.problem('p1')).toBeNull();
  });

  // A `no-row` **Problem** is a folder the sheet forgot: there is no **Sheet
  // row** to prefill from, so the detail offers the one title the folder can
  // suggest — its name with the **Title key**'s tail forms dropped, the way
  // `titleGuess` reads it — beside the folder's own **Found files**. The
  // snapshot's row keeps naming the folder as it is on disk; the guess is for
  // the title field.
  describe('a no-row opening', () => {
    it('guesses the title from the folder name, with the tail forms dropped', async () => {
      const { importer, root, sheet } = sandbox();
      folderUnder(root, 'Harbor.Lights.2019', ['Harbor.Lights.2019.mp4']);
      await importer.start(sheet, root);
      const [problem] = ofKind(await untilReview(importer), 'no-row');

      const detail = importer.problem(problem.id);

      // Story 84: a film the sheet forgot is one title away from imported — and
      // that title is already typed, not `Harbor.Lights.2019`.
      expect(detail?.row).toEqual({ title: 'Harbor Lights', genres: [] });
    });

    it('keeps the review row naming the folder as it is on disk', async () => {
      const { importer, root, sheet } = sandbox();
      folderUnder(root, 'Harbor.Lights.2019', ['Harbor.Lights.2019.mp4']);
      await importer.start(sheet, root);
      const [problem] = ofKind(await untilReview(importer), 'no-row');

      const detail = importer.problem(problem.id);

      expect(problem.title).toBe('Harbor.Lights.2019');
      expect(detail?.title).toBe('Harbor.Lights.2019');
    });

    it('answers the folder’s own files beside the guess', async () => {
      const { importer, root, sheet } = sandbox();
      const folder = folderUnder(root, 'Harbor.Lights.2019', [
        'Harbor.Lights.2019.mp4',
      ]);
      writeFileSync(join(folder, 'poster.jpg'), '');
      writeFileSync(join(folder, 'Harbor.Lights.2019.en.srt'), '');
      await importer.start(sheet, root);
      const [problem] = ofKind(await untilReview(importer), 'no-row');

      const detail = importer.problem(problem.id);

      expect(detail?.row.title).toBe('Harbor Lights');
      expect(detail?.folder).toBe(folder);
      expect(detail?.candidates).toEqual([]);
      expect(detail?.files).toEqual({
        video: join(folder, 'Harbor.Lights.2019.mp4'),
        poster: join(folder, 'poster.jpg'),
        subtitles: [
          {
            path: join(folder, 'Harbor.Lights.2019.en.srt'),
            language: 'English',
          },
        ],
      });
    });

    it('guesses from a name that carries no tail by leaving it as it is', async () => {
      const { importer, root, sheet } = sandbox();
      folderUnder(root, 'Ironwood', ['Ironwood.mp4']);
      await importer.start(sheet, root);
      const [problem] = ofKind(await untilReview(importer), 'no-row');

      expect(importer.problem(problem.id)?.row.title).toBe('Ironwood');
    });
  });
});

describe('createImporter — resolve: Save & continue', () => {
  it('copies every found file into a movie folder and adds the movie', async () => {
    const { storage, importer, media, problem, dieHard } =
      await failedDieHard();

    const movie = await importer.resolve(problem.id, dieHardForm(dieHard));

    expect(movie.title).toBe('Die Hard');
    expect(movie.videoPath).toBe('die-hard-1988/Die.Hard.1988.1080p.mp4');
    expect(movie.posterPath).toBe('die-hard-1988/poster.jpg');
    expect(
      [...movie.subtitles]
        .sort((a, b) => a.position - b.position)
        .map((track) => [track.path, track.language])
    ).toEqual([
      ['die-hard-1988/Die.Hard.1988.1080p.en.srt', 'English'],
      ['die-hard-1988/Die.Hard.1988.1080p.pt.srt', 'Portuguese'],
    ]);
    expect(readFileSync(join(media, movie.videoPath))).toEqual(
      readFileSync(join(dieHard, 'Die.Hard.1988.1080p.mp4'))
    );
    expect(byTitle(storage)['Die Hard']).toMatchObject({ id: movie.id });
    expect(folders(media)).toEqual(['amelie-2001', 'die-hard-1988']);
  });

  it('writes the form’s fields onto the row, not the sheet’s', async () => {
    const { storage, importer, problem, dieHard } = await failedDieHard();

    await importer.resolve(problem.id, {
      ...dieHardForm(dieHard),
      title: 'Die Hard (restored)',
      year: null,
      director: null,
      synopsis: null,
      rating: null,
      cast: [],
      genres: ['Action'],
      poster: null,
      subtitles: [],
    });

    // What the maintainer left the form saying is what is written — the sheet
    // row only prefilled it.
    const restored = byTitle(storage)['Die Hard (restored)'];
    expect(restored).toMatchObject({
      year: null,
      director: null,
      synopsis: null,
      rating: null,
      cast: [],
      posterPath: null,
      subtitles: [],
    });
    expect(restored.genres.map((genre) => genre.name)).toEqual(['Action']);
  });

  it('derives the runtime from the copied video', async () => {
    const { storage, importer, problem, dieHard } = await failedDieHard();

    await importer.resolve(problem.id, dieHardForm(dieHard));

    expect(byTitle(storage)['Die Hard'].runtimeMinutes).toBe(132);
  });

  it('dismisses the problem once the movie is added', async () => {
    const { importer, problem, dieHard } = await failedDieHard();

    await importer.resolve(problem.id, dieHardForm(dieHard));

    expect(importer.current()?.problems).toEqual([]);
    expect(importer.problem(problem.id)).toBeNull();
  });

  it('refuses a found path outside the root, before anything is copied', async () => {
    const { storage, importer, media, problem, dieHard } =
      await failedDieHard();
    const outside = join(media, '..', 'elsewhere.mp4');
    writeFileSync(outside, 'not the family’s');

    await expect(
      importer.resolve(problem.id, {
        ...dieHardForm(dieHard),
        video: { found: outside },
      })
    ).rejects.toBeInstanceOf(ImportPathError);

    // Nothing copied — not the film named outside, and not the poster and
    // tracks named inside beside it — no row, and the problem still there.
    expect(folders(media)).toEqual(['amelie-2001']);
    expect(byTitle(storage)['Die Hard']).toBeUndefined();
    expect(importer.current()?.problems).toEqual([problem]);
  });

  it('refuses a path that climbs out of the root through ..', async () => {
    const { importer, media, problem, dieHard } = await failedDieHard();

    await expect(
      importer.resolve(problem.id, {
        ...dieHardForm(dieHard),
        poster: { found: join(dieHard, '..', '..', 'elsewhere.jpg') },
      })
    ).rejects.toBeInstanceOf(ImportPathError);

    expect(folders(media)).toEqual(['amelie-2001']);
  });

  it('rejects for a problem that is not there, adding nothing', async () => {
    const { storage, importer, problem, dieHard } = await failedDieHard();
    importer.dismiss(problem.id);

    await expect(
      importer.resolve(problem.id, dieHardForm(dieHard))
    ).rejects.toBeInstanceOf(ProblemNotFoundError);

    expect(byTitle(storage)['Die Hard']).toBeUndefined();
  });

  it('rejects when there is no run', async () => {
    const { importer, root } = sandbox();

    await expect(
      importer.resolve('p1', dieHardForm(join(root, 'Die.Hard.1988.1080p')))
    ).rejects.toBeInstanceOf(ProblemNotFoundError);
  });

  it('leaves no folder behind and keeps the problem when the copy fails', async () => {
    const { importer, media, problem, dieHard } = await failedDieHard();

    await expect(
      importer.resolve(problem.id, {
        ...dieHardForm(dieHard),
        poster: { found: join(dieHard, 'no-such-poster.jpg') },
      })
    ).rejects.toThrow();

    expect(folders(media)).toEqual(['amelie-2001']);
    expect(importer.current()?.problems).toEqual([problem]);
  });

  it('changes nothing under the library root', async () => {
    const { importer, root, problem, dieHard } = await failedDieHard();
    const before = treeOf(root);

    await importer.resolve(problem.id, dieHardForm(dieHard));

    expect(treeOf(root)).toEqual(before);
  });
});

// --- Phase 7: failure and the edges (issue #133) -------------------------------

/** A title of exactly two hundred characters — a real film, a mouthful. */
const LONG_TITLE =
  'The Extraordinarily Long Title Of A Film Nobody Can Say In One Breath '
    .repeat(3)
    .slice(0, 200);

/**
 * A **Source folder** under the root holding a real film — Amélie's bytes
 * under the video name given, so the copy has something to copy and the
 * runtime derivation an `mvhd` to read — and whichever subtitle files the test
 * names beside it, each Amélie's `.srt`.
 */
function filmUnder(
  root: string,
  name: string,
  video: string,
  subtitles: string[] = []
): string {
  const folder = join(root, name);
  mkdirSync(folder);
  const amelie = join(root, 'Drama', 'Amelie (2001)');
  cpSync(join(amelie, 'Amelie.mp4'), join(folder, video));
  for (const subtitle of subtitles) {
    cpSync(join(amelie, 'Amelie.srt'), join(folder, subtitle));
  }
  return folder;
}

/** A CSV cell: quoted, with any quote in it doubled, as a spreadsheet writes one. */
const cell = (text: string): string => `"${text.replace(/"/g, '""')}"`;

const QUOTED = 'Zoë\'s "Lantern" Keeper';
const ACCENTED = "Ça, c'est Noël à Zürich";

/**
 * Story 96: the copy holds for any film in the collection. The **Title key**
 * folds quotes, diacritics and punctuation away for the match, and the row
 * keeps the title exactly as the sheet spelt it — the family reads the sheet's
 * spelling, not the folder's. A folder cannot carry a double quote on Windows,
 * so the quoted title's folder spells the name without them, which is the case
 * the match exists for.
 */
describe('createImporter — the awkward titles match and import', () => {
  it('imports a title with quotes in it, kept whole on the row', async () => {
    const { storage, importer, media, root } = sandbox();
    filmUnder(root, "Zoë's Lantern Keeper (2020)", 'Zoe.mp4');
    const sheet = sheetOf(root, `${FIXTURE_ROWS}${cell(QUOTED)},2020,Drama\n`);

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([]);
    expect(byTitle(storage)[QUOTED]).toMatchObject({
      title: QUOTED,
      year: 2020,
      videoPath: 'zoes-lantern-keeper-2020/Zoe.mp4',
    });
    expect(folders(media)).toContain('zoes-lantern-keeper-2020');
    expect(texts(run)).toContain(`✓ Imported   ${QUOTED}`);
  });

  it('imports a title with diacritics, matched to a folder spelt without them', async () => {
    const { storage, importer, media, root } = sandbox();
    filmUnder(root, "Ca c'est Noel a Zurich (2019)", 'Noel.mp4');
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}${cell(ACCENTED)},2019,Comedy\n`
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([]);
    expect(byTitle(storage)[ACCENTED]).toMatchObject({
      title: ACCENTED,
      year: 2019,
      videoPath: 'ca-cest-noel-a-zurich-2019/Noel.mp4',
    });
    expect(folders(media)).toContain('ca-cest-noel-a-zurich-2019');
  });

  it('imports a two-hundred-character title, its folder carrying the whole slug', async () => {
    const { storage, importer, media, root } = sandbox();
    filmUnder(root, `${LONG_TITLE} (2021)`, 'Long.mp4');
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}${cell(LONG_TITLE)},2021,Drama\n`
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([]);
    const movie = byTitle(storage)[LONG_TITLE];
    expect(movie.title).toHaveLength(200);
    expect(movie.year).toBe(2021);
    const [folder, file] = movie.videoPath.split('/');
    expect(file).toBe('Long.mp4');
    expect(folder).toBe(
      `${LONG_TITLE.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-2021`
    );
    expect(folders(media)).toContain(folder);
    expect(readFileSync(join(media, movie.videoPath))).toEqual(
      readFileSync(join(root, 'Drama', 'Amelie (2001)', 'Amelie.mp4'))
    );
  });
});

/**
 * The same three titles with no folder to answer to them: each sits in a
 * **Problem** whole — the review list and the form's banner print
 * `problem.title` and `row.title` as they are, so a quote or an accent that
 * broke here would break on the screen.
 */
describe('createImporter — the awkward titles sit in a problem whole', () => {
  it('files no-folder for each, the title exactly as the sheet spelt it', async () => {
    const { importer, root } = sandbox();
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}${cell(QUOTED)},2020,Drama\n` +
        `${cell(ACCENTED)},2019,Comedy\n` +
        `${cell(LONG_TITLE)},2021,Drama\n`
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(
      run.problems.map((problem) => [problem.kind, problem.title])
    ).toEqual([
      ['no-folder', QUOTED],
      ['no-folder', ACCENTED],
      ['no-folder', LONG_TITLE],
    ]);
  });

  it('answers each problem’s detail with the row’s title whole', async () => {
    const { importer, root } = sandbox();
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}${cell(QUOTED)},2020,Drama\n` +
        `${cell(LONG_TITLE)},2021,Drama\n`
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    const [quoted, long] = run.problems;
    expect(importer.problem(quoted.id)).toMatchObject({
      title: QUOTED,
      row: { title: QUOTED, year: 2020 },
    });
    expect(importer.problem(long.id)).toMatchObject({
      title: LONG_TITLE,
      row: { title: LONG_TITLE, year: 2021 },
    });
  });
});

/** The form's **Resolve** of one of the two Heat rows, its film found in `folder`. */
function heatForm(folder: string, video: string): ResolveForm {
  return {
    title: 'Heat',
    year: 1995,
    director: null,
    synopsis: null,
    rating: null,
    cast: [],
    genres: ['Action'],
    video: { found: join(folder, video) },
    poster: null,
    subtitles: [],
  };
}

/**
 * Story 97: two films with the same title and year never share a **Movie
 * folder**. The name is `movieFolder`'s — a slug and the year — and the slug
 * folds more than the **Title key** does: two titles in a script the slug's
 * alphabet has no letters for are two different keys, two different matches,
 * and one folder name. `reserveFolder`'s suffix is what keeps them apart, in
 * the run and in **Resolve** alike.
 */
describe('createImporter — two matches with the same title and year', () => {
  it('lands two films the slug cannot tell apart in two folders, neither overwritten', async () => {
    const { storage, importer, media, root } = sandbox();
    // Throne of Blood and The Lower Depths, both Kurosawa, both 1957: two
    // keys, one slug — `movie-1957` — once the slug has nothing to keep.
    const throne = filmUnder(root, '蜘蛛巣城 (1957)', 'Throne.mp4');
    const depths = join(root, 'どん底 (1957)');
    mkdirSync(depths);
    cpSync(
      join(root, 'Die.Hard.1988.1080p', 'Die.Hard.1988.1080p.mp4'),
      join(depths, 'Depths.mp4')
    );
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}蜘蛛巣城,1957,Drama\nどん底,1957,Drama\n`
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([]);
    expect(run.done).toBe(4);
    const movies = byTitle(storage);
    expect(movies['蜘蛛巣城'].videoPath).toBe('movie-1957/Throne.mp4');
    expect(movies['どん底'].videoPath).toBe('movie-1957-2/Depths.mp4');
    expect(folders(media)).toEqual([
      'amelie-2001',
      'die-hard-1988',
      'movie-1957',
      'movie-1957-2',
    ]);
    // Each folder holds its own film's bytes — the second did not land on
    // the first.
    expect(readFileSync(join(media, 'movie-1957', 'Throne.mp4'))).toEqual(
      readFileSync(join(throne, 'Throne.mp4'))
    );
    expect(readFileSync(join(media, 'movie-1957-2', 'Depths.mp4'))).toEqual(
      readFileSync(join(depths, 'Depths.mp4'))
    );
  });

  it('suffixes the second of two resolves with the same title and year, as the form does', async () => {
    const { storage, importer, media, root } = sandbox();
    // Two rows for Heat and two folders for it: each row sees both, so each
    // is `ambiguous`, and the maintainer resolves one onto each folder.
    const first = filmUnder(root, 'Heat (1995)', 'Heat.mp4');
    const second = filmUnder(root, 'Heat 1995 1080p', 'Heat.1995.1080p.mp4');
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}Heat,1995,Action\nHeat,1995,Action\n`
    );
    await importer.start(sheet, root);
    const run = await untilReview(importer);
    expect(ofKind(run, 'ambiguous')).toHaveLength(2);
    const [one, two] = ofKind(run, 'ambiguous');

    const mann = await importer.resolve(one.id, heatForm(first, 'Heat.mp4'));
    const other = await importer.resolve(
      two.id,
      heatForm(second, 'Heat.1995.1080p.mp4')
    );

    expect(mann.videoPath).toBe('heat-1995/Heat.mp4');
    expect(other.videoPath).toBe('heat-1995-2/Heat.1995.1080p.mp4');
    expect(folders(media)).toEqual([
      'amelie-2001',
      'die-hard-1988',
      'heat-1995',
      'heat-1995-2',
    ]);
    expect(
      storage
        .listMovies({ sort: 'a-z' })
        .filter((movie) => movie.title === 'Heat')
    ).toHaveLength(2);
    expect(importer.current()?.problems).toEqual([]);
  });
});

/**
 * Story 104: the **Movie folder** is named by the app's own rule and never by
 * the source. A **Source folder** may be called anything its filesystem
 * allows — `#`, `!`, `%` and `&` are all legal on NTFS and all hostile to the
 * URL `/api/images/<stored path>` — and none of it reaches the managed
 * directory: the folder is `movieFolder`'s slug of the row's title.
 */
describe('createImporter — a source folder named with unsafe characters', () => {
  const UNSAFE = '#The Lantern Keeper!# (2019)';

  it('imports it into a folder named by the app’s rule, the source’s name nowhere under media', async () => {
    const { storage, importer, media, root } = sandbox();
    filmUnder(root, UNSAFE, 'The.Lantern.Keeper.mp4');
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\n`
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([]);
    expect(byTitle(storage)['The Lantern Keeper']).toMatchObject({
      videoPath: 'the-lantern-keeper-2019/The.Lantern.Keeper.mp4',
    });
    expect(folders(media)).toEqual([
      'amelie-2001',
      'die-hard-1988',
      'the-lantern-keeper-2019',
    ]);
    for (const name of Object.keys(treeOf(media))) {
      expect(name).toMatch(/^[a-z0-9-]+\/[^/]+$/);
    }
    expect(texts(run)).toContain('✓ Imported   The Lantern Keeper');
  });

  it('names the folder as it is on disk in the scanning line, unsafe characters and all', async () => {
    const { importer, root } = sandbox();
    const folder = filmUnder(root, UNSAFE, 'The.Lantern.Keeper.mp4');
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\n`
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    // The log is the maintainer's map back to the source: a name the log
    // sanitised would be a folder they could not find.
    expect(linesMatching(run, /^Scanning/).map((line) => line.text)).toContain(
      `Scanning   ${folder}`
    );
  });
});

/**
 * Story 103: an odd filename never blocks a track. `detectSubtitleLanguage`
 * answers English for a tag the form does not offer, and the importer takes
 * that answer as it takes any other — the track is copied and filed, no
 * problem raised, no warning logged, and the maintainer corrects the language
 * on the form if it matters.
 */
describe('createImporter — a subtitle with an unknown language tag', () => {
  it('lands the track as English, copied beside the film', async () => {
    const { storage, importer, media, root } = sandbox();
    filmUnder(root, 'The Lantern Keeper (2019)', 'The.Lantern.Keeper.mp4', [
      'The.Lantern.Keeper.ja.srt',
    ]);
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\n`
    );

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([]);
    const movie = byTitle(storage)['The Lantern Keeper'];
    expect(
      movie.subtitles.map((track) => [track.path, track.language])
    ).toEqual([
      ['the-lantern-keeper-2019/The.Lantern.Keeper.ja.srt', 'English'],
    ]);
    expect(
      existsSync(
        join(media, 'the-lantern-keeper-2019', 'The.Lantern.Keeper.ja.srt')
      )
    ).toBe(true);
    // No warning about the track: past the scan, the lines naming the film
    // are its imported line and the one warning it earns, for no poster.
    expect(
      linesMatching(run, /^[^S].*Lantern Keeper/).map((line) => line.text)
    ).toEqual([
      '✓ Imported   The Lantern Keeper',
      '⚠ The Lantern Keeper — no poster found',
    ]);
  });

  it('keeps a known tag beside an unknown one on the same film', async () => {
    const { storage, importer, root } = sandbox();
    filmUnder(root, 'The Lantern Keeper (2019)', 'The.Lantern.Keeper.mp4', [
      'The.Lantern.Keeper.ja.srt',
      'The.Lantern.Keeper.pt.srt',
    ]);
    const sheet = sheetOf(
      root,
      `${FIXTURE_ROWS}The Lantern Keeper,2019,Drama\n`
    );

    await importer.start(sheet, root);
    await untilReview(importer);

    const movie = byTitle(storage)['The Lantern Keeper'];
    expect(
      [...movie.subtitles]
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((track) => [track.path, track.language])
    ).toEqual([
      ['the-lantern-keeper-2019/The.Lantern.Keeper.ja.srt', 'English'],
      ['the-lantern-keeper-2019/The.Lantern.Keeper.pt.srt', 'Portuguese'],
    ]);
  });
});

/**
 * Story 99: the app restarting mid-run loses the run and keeps every movie
 * already added — a crash costs a re-run and never a row. The **Current run**
 * lives in the importer's memory and nowhere else; the movies live in the
 * library. A run is interrupted here by holding its second copy for ever and
 * composing a fresh importer over the same storage and managed directory, as
 * a restarted process would.
 */
describe('createImporter — the importer restarting mid-run', () => {
  async function interrupted(): Promise<{
    storage: LibraryStorage;
    media: string;
    root: string;
    sheet: string;
    restarted: Importer;
  }> {
    const hold = heldCopy('Amelie.mp4');
    const { storage, importer, media, root, sheet } = sandbox({
      media: hold.seam,
    });
    await importer.start(sheet, root);
    await hold.reached;
    expect(importer.current()?.phase).toBe('importing');

    const restarted = createImporter({
      storage,
      media: createMedia(media),
      playback: createPlayback(media, null),
    });
    return { storage, media, root, sheet, restarted };
  }

  it('has no run', async () => {
    const { restarted } = await interrupted();

    expect(restarted.current()).toBeNull();
  });

  it('has every movie the interrupted run added, its file still under media', async () => {
    const { storage, media, restarted } = await interrupted();

    expect(restarted.current()).toBeNull();
    const dieHard = byTitle(storage)['Die Hard'];
    expect(dieHard).toMatchObject({
      title: 'Die Hard',
      year: 1988,
      videoPath: 'die-hard-1988/Die.Hard.1988.1080p.mp4',
    });
    expect(existsSync(join(media, dieHard.videoPath))).toBe(true);
    expect(byTitle(storage)['Amélie']).toBeUndefined();
  });

  it('can start again over the same sheet: the added film is skipped, the rest imported', async () => {
    const { storage, media, root, sheet, restarted } = await interrupted();
    const before = byTitle(storage)['Die Hard'];

    await restarted.start(sheet, root);
    const run = await untilReview(restarted);

    expect(run.problems).toEqual([]);
    expect(texts(run)).toContain('– Already in library Die Hard (1988)');
    expect(
      linesMatching(run, /^✓ Imported\s/).map((line) => line.text)
    ).toEqual(['✓ Imported   Amélie']);
    const after = byTitle(storage);
    expect(Object.keys(after).sort()).toEqual(['Amélie', 'Die Hard']);
    expect(after['Die Hard'].id).toBe(before.id);
    // The interrupted run's reserved folder is still on disk, so the re-run
    // takes the next name rather than writing over it.
    expect(existsSync(join(media, after['Amélie'].videoPath))).toBe(true);
    expect(readFileSync(join(media, after['Amélie'].videoPath))).toEqual(
      readFileSync(join(root, 'Drama', 'Amelie (2001)', 'Amelie.mp4'))
    );
  });
});
