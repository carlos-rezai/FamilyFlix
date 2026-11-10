// @vitest-environment node
//
// 60, Rebuild edges, Phase 9 (issue #572): a held film's empty art is filled.
//
// A film scanned before its art lay in its **Title folder** is scanned again:
// its empty **Poster** and **Backdrop** are taken from the folder's read, its
// **Path cells** filling an empty place first as a new film's do, and copied
// in as a first scan copies them. Art the film already has (a **Sync**'s or a
// hand pick) is never replaced, and the fill files no **Problem**: it adds no
// review row.
//
// Composed as the held series' art suite is: the film fixture copied into a
// sandboxed Library folder, Die Hard's art taken away for the first scan and
// laid back before the second, a real `freshStorage`, a real `Media` over a
// sandbox **Managed media directory** and the absent **Playback component**.
// Each image is the fixture JPEG with its own name appended, so a copy is
// known by its bytes.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportMode, ImportRun, Movie } from '@/types';

const DIE_HARD = 'Die Hard (1988)';

/** The fixture sheet's header: every Sheet column. */
const HEADER = readFileSync(join(LIBRARY_FIXTURE, 'library.csv'), 'utf8')
  .split(/\r?\n/)[0]
  .trim();

/** A real JPEG to build each image from. */
const JPEG = readFileSync(
  join(LIBRARY_FIXTURE, 'root', DIE_HARD, 'Images', 'poster.jpg')
);

/** The pieces of Die Hard's art a rescan may fill. */
type Piece = 'poster' | 'backdrop';

const PIECE_NAMES: readonly Piece[] = ['poster', 'backdrop'];

/** Each piece's path in Die Hard's Title folder, as the folder's read takes it. */
const PIECES: Record<Piece, string> = {
  poster: join('Images', 'poster.jpg'),
  backdrop: join('Images', 'backdrop.jpg'),
};

/** A sheet of one Movie row, Die Hard's, its Poster and Backdrop cells given. */
const dieHardSheet = (cells: { poster?: string; backdrop?: string }): string =>
  [
    HEADER,
    [
      'Movie',
      DIE_HARD,
      '',
      '',
      'Die Hard',
      '1988',
      '',
      '',
      '"Action, Thriller"',
      'John McTiernan',
      '"Bruce Willis, Alan Rickman"',
      'A New York cop takes on a tower full of thieves on Christmas Eve.',
      '8',
      '',
      '',
      'Watched',
      '',
      '',
      '',
      cells.poster ?? '',
      cells.backdrop ?? '',
      '',
    ].join(','),
    '',
  ].join('\n');

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  folder: StoredLibraryFolder;
  /** The Library folder on disk. */
  root: string;
  /** The Managed media directory. */
  media: string;
  /** Die Hard's Title folder. */
  film: string;
}

/** An image whose bytes are the JPEG's and then its own name. */
function writeImage(path: string, name: string): Buffer {
  const bytes = Buffer.concat([JPEG, Buffer.from(name)]);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, bytes);
  return bytes;
}

/**
 * The film fixture listed as a Library folder, no sheet in its `Meta/`, Die
 * Hard's Title folder holding no art at all.
 */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-held-film-art-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  cpSync(join(LIBRARY_FIXTURE, 'root'), root, { recursive: true });
  const film = join(root, DIE_HARD);
  rmSync(join(film, 'Images'), { recursive: true, force: true });

  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
  });
  const folder = storage.addLibraryFolder(root);
  return { storage, importer, folder, root, media, film };
}

/** Lay Die Hard's art into its Title folder: each piece's bytes by name. */
function layArt(box: Sandbox): Record<Piece, Buffer> {
  return {
    poster: writeImage(join(box.film, PIECES.poster), 'poster'),
    backdrop: writeImage(join(box.film, PIECES.backdrop), 'backdrop'),
  };
}

/** Die Hard's sheet laid into the Library folder's `Meta/`. */
function laySheet(
  box: Sandbox,
  cells: { poster?: string; backdrop?: string }
): void {
  mkdirSync(join(box.root, 'Meta'), { recursive: true });
  writeFileSync(
    join(box.root, 'Meta', 'familyflix-library.csv'),
    dieHardSheet(cells)
  );
}

/** The snapshot once the run has reached review, or a failure if it never does. */
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

/** One whole Folder scan in a mode, then the run let go. */
async function scanOnce(box: Sandbox, mode: ImportMode): Promise<ImportRun> {
  await box.importer.scan([box.folder], false, mode);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

/** Die Hard as the library holds it, read whole. */
function dieHard(storage: LibraryStorage): Movie {
  const listed = storage
    .listMovies({ sort: 'a-z' })
    .find((movie) => movie.title === 'Die Hard');
  const movie = listed === undefined ? null : storage.getMovie(listed.id);
  if (movie === null) {
    throw new Error('the library holds no Die Hard');
  }
  return movie;
}

/** Each piece's Stored path on Die Hard as held now. */
function heldPaths(box: Sandbox): Record<Piece, string | null> {
  const movie = dieHard(box.storage);
  return { poster: movie.posterPath, backdrop: movie.backdropPath };
}

/** The bytes of a Stored path in the Managed media directory. */
function stored(box: Sandbox, path: string | null): Buffer {
  expect(path).not.toBeNull();
  const absolute = join(box.media, path as string);
  expect(existsSync(absolute)).toBe(true);
  return readFileSync(absolute);
}

/**
 * Give held Die Hard art of its own for `piece`, as a Sync or a hand pick
 * would: a file in the Managed media directory, its Stored path recorded.
 */
function holdArt(box: Sandbox, piece: Piece): string {
  const path = join('held-art', `${piece}.jpg`);
  writeImage(join(box.media, path), `held ${piece}`);
  const id = dieHard(box.storage).id;
  box.storage.enrichMovie(
    id,
    piece === 'poster' ? { posterPath: path } : { backdropPath: path }
  );
  return path;
}

describe.each(['copy', 'link'] as const)(
  'createImporter.scan: a rescan fills a held film’s empty art (%s)',
  (mode) => {
    it('fills a held film’s poster and backdrop from its folder', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      expect(heldPaths(box)).toEqual({ poster: null, backdrop: null });
      const bytes = layArt(box);

      await scanOnce(box, mode);

      const paths = heldPaths(box);
      expect(stored(box, paths.poster)).toEqual(bytes.poster);
      expect(stored(box, paths.backdrop)).toEqual(bytes.backdrop);
    });

    it('fills an empty place from a contained path cell first', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      const poster = `${DIE_HARD}/heat.jpg`;
      const backdrop = `${DIE_HARD}/Images/wide.jpg`;
      const posterBytes = writeImage(join(box.film, 'heat.jpg'), poster);
      const backdropBytes = writeImage(
        join(box.film, 'Images', 'wide.jpg'),
        backdrop
      );
      laySheet(box, { poster, backdrop });

      await scanOnce(box, mode);

      const paths = heldPaths(box);
      expect(stored(box, paths.poster)).toEqual(posterBytes);
      expect(stored(box, paths.backdrop)).toEqual(backdropBytes);
    });

    it.each(PIECE_NAMES.map((piece) => [piece]))(
      'keeps the %s the film already has, filling only the other',
      async (piece) => {
        const box = sandbox();
        await scanOnce(box, mode);
        const held = holdArt(box, piece);
        const bytes = layArt(box);

        await scanOnce(box, mode);

        const paths = heldPaths(box);
        expect(paths[piece]).toBe(held);
        expect(stored(box, held)).toEqual(
          Buffer.concat([JPEG, Buffer.from(`held ${piece}`)])
        );
        for (const other of PIECE_NAMES) {
          if (other !== piece) {
            expect(stored(box, paths[other])).toEqual(bytes[other]);
          }
        }
      }
    );

    it('fills the art without adding a review row', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      layArt(box);

      const run = await scanOnce(box, mode);

      expect(heldPaths(box).poster).not.toBeNull();
      expect(run.problems).toEqual([]);
    });
  }
);
