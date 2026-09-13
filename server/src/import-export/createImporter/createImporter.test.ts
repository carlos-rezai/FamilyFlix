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

import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { LibraryStorage } from '../../library';
import type { ImportRun, Movie } from '@/types';

const FIXTURE = fileURLToPath(new URL('./fixture/', import.meta.url));

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
  const root = join(dir, 'root');
  mkdirSync(media);
  cpSync(join(FIXTURE, 'root'), root, { recursive: true });
  const sheet = join(dir, 'library.xlsx');
  cpSync(join(FIXTURE, 'library.xlsx'), sheet);

  const storage = freshStorage();
  const importer = createImporter({
    storage: storageSeam(storage),
    media: mediaSeam(createMedia(media)),
    playback: createPlayback(media, null),
  });
  return { storage, importer, media, root, sheet };
}

/**
 * A `Media` that holds the copy of one source file — the first whose path
 * ends in `filename` — until the test lets it go, and says when it has got
 * there. The one way to have a run reliably mid-copy when cancel is called.
 *
 * Every argument is forwarded as given, so a signal the importer hands its
 * copies reaches the real one untouched.
 */
function holdCopyOf(filename: string): {
  seam: (real: Media) => Media;
  reached: Promise<void>;
  release: () => void;
} {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrive: () => void = () => undefined;
  const reached = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  let held = false;
  return {
    reached,
    release: () => release(),
    seam: (real) => ({
      ...real,
      copyIn: async (...args) => {
        if (!held && args[1].endsWith(filename)) {
          held = true;
          arrive();
          await gate;
        }
        return real.copyIn(...args);
      },
    }),
  };
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
    cpSync(join(FIXTURE, 'library.csv'), csv);

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
  it('answers the run from start, with its log and problems empty', async () => {
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
      log: [],
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
      log: [],
      problems: [],
    });
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
    const hold = holdCopyOf('Amelie.mp4');
    const { importer, root, sheet } = sandbox({ media: hold.seam });
    await importer.start(sheet, root);
    await hold.reached;

    const cancelled = importer.cancel();
    hold.release();
    await cancelled;

    expect(importer.current()).toBeNull();
  });

  it('keeps every movie added before the cancel', async () => {
    const hold = holdCopyOf('Amelie.mp4');
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
    const hold = holdCopyOf('Amelie.mp4');
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
    const hold = holdCopyOf('Die.Hard.1988.1080p.mp4');
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
    const hold = holdCopyOf('Amelie.mp4');
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
