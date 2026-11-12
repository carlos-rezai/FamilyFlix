// @vitest-environment node
//
// 61, Export round trip, Phase 6 (issue #587): a path cell reaches the NFD
// folder.
//
// The QA ticket's Amélie repro: a Title folder copied from a Mac names
// `Amélie (2001)` decomposed (NFD), and the Meta row Excel saved spells it
// composed (NFC), rated 7, its Poster and Backdrop **Path cells** naming
// images loose in that folder. A **Folder scan** matches the row by its
// **Folder key**, reads its rating, and resolves each path cell's first
// segment as the folder's name on disk, so the cells' files are reached and
// no **Orphaned row** is logged. A cell naming another folder is still an
// **Unread cell**.
//
// Composed as the path-cells suite is: a sandboxed Library folder (the one
// real video copied in), a real `freshStorage`, a real `Media` over a sandbox
// Managed media directory, the absent **Playback component**, an idle
// **Library sheet writer** and an idle **Layout fill**.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { FIXTURE_VIDEO } from '../../test-support/fixtureVideo/fixtureVideo';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportRun, Movie } from '@/types';

/** `Amélie (2001)` composed (NFC), as Excel saves it. */
const AMELIE_NFC = 'Amélie (2001)'.normalize('NFC');
/** `Amélie (2001)` decomposed (NFD), as a folder copied from a Mac names it. */
const AMELIE_NFD = AMELIE_NFC.normalize('NFD');

/** Another Title folder, holding an image a cell may name. */
const HEAT = 'Heat (1995)';

/** A real JPEG to build each image from. */
const JPEG = readFileSync(
  join(LIBRARY_FIXTURE, 'root', 'Die Hard (1988)', 'Images', 'poster.jpg')
);

interface Cells {
  poster: string;
  backdrop: string;
}

/** The repro's cells: two images loose in Amélie's folder, spelled in NFC. */
const REPRO_CELLS: Cells = {
  poster: `${AMELIE_NFC}/amelie.jpg`,
  backdrop: `${AMELIE_NFC}/amelie-wide.jpg`,
};

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  folder: StoredLibraryFolder;
  /** The Managed media directory. */
  media: string;
  /** Amélie's poster image, as the folder holds it. */
  poster: Buffer;
  /** Amélie's backdrop image, as the folder holds it. */
  backdrop: Buffer;
  /** Heat's image, as its folder holds it. */
  heat: Buffer;
}

/**
 * A Library folder holding the NFD `Amélie (2001)` Title folder (the real
 * video and two loose images), a `Heat (1995)` folder holding one image, and
 * a Meta sheet naming Amélie in NFC, rated 7, with `cells`.
 */
function sandbox(cells: Cells): Sandbox {
  const dir = sandboxRoot('familyflix-nfd-path-cells-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  const amelie = join(root, AMELIE_NFD);
  mkdirSync(amelie, { recursive: true });
  copyFileSync(FIXTURE_VIDEO, join(amelie, 'Amelie.mp4'));
  const poster = Buffer.concat([JPEG, Buffer.from('amelie poster')]);
  writeFileSync(join(amelie, 'amelie.jpg'), poster);
  const backdrop = Buffer.concat([JPEG, Buffer.from('amelie backdrop')]);
  writeFileSync(join(amelie, 'amelie-wide.jpg'), backdrop);
  mkdirSync(join(root, HEAT));
  const heat = Buffer.concat([JPEG, Buffer.from('heat')]);
  writeFileSync(join(root, HEAT, 'heat.jpg'), heat);
  mkdirSync(join(root, 'Meta'));
  writeFileSync(
    join(root, 'Meta', 'familyflix-library.csv'),
    [
      'Type,Folder,Title,Year,Rating,Poster,Backdrop',
      `Movie,${AMELIE_NFC},Amelie,2001,7,${cells.poster},${cells.backdrop}`,
      '',
    ].join('\n'),
    'utf8'
  );

  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
  });
  const folder = storage.addLibraryFolder(root);
  return { storage, importer, folder, media, poster, backdrop, heat };
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

/** One whole Folder scan of the sandbox's Library folder, copying. */
async function scanOnce(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan([box.folder], false, 'copy');
  return untilReview(box.importer);
}

/** Amélie as the library holds it, read whole. */
function amelie(storage: LibraryStorage): Movie {
  const listed = storage
    .listMovies({ sort: 'a-z' })
    .find((movie) => movie.title === 'Amelie');
  const movie = listed === undefined ? null : storage.getMovie(listed.id);
  if (movie === null) {
    throw new Error('the library holds no Amelie');
  }
  return movie;
}

/** The bytes of a Stored path in the Managed media directory. */
function stored(box: Sandbox, path: string | null): Buffer {
  expect(path).not.toBeNull();
  const absolute = join(box.media, path as string);
  expect(existsSync(absolute)).toBe(true);
  return readFileSync(absolute);
}

describe('createImporter.scan: the NFD Amélie repro', () => {
  it('scans with rating 7 and no Orphaned row line', async () => {
    const box = sandbox(REPRO_CELLS);

    const run = await scanOnce(box);

    expect(amelie(box.storage).rating).toBe(7);
    expect(
      run.log.filter((line) =>
        line.text.includes('is in the sheet but has no folder')
      )
    ).toEqual([]);
  });

  it('reaches its path cells’ files: the poster and the backdrop', async () => {
    const box = sandbox(REPRO_CELLS);

    await scanOnce(box);

    const movie = amelie(box.storage);
    expect(stored(box, movie.posterPath)).toEqual(box.poster);
    expect(stored(box, movie.backdropPath)).toEqual(box.backdrop);
  });

  it('still refuses a cell naming another folder as an Unread cell', async () => {
    const cell = `${HEAT}/heat.jpg`;
    const box = sandbox({ ...REPRO_CELLS, poster: cell });

    const run = await scanOnce(box);

    expect(
      run.log.filter(
        (line) =>
          line.kind === 'warning' &&
          line.text.endsWith(`: Poster "${cell}" not read`)
      )
    ).toHaveLength(1);
    expect(amelie(box.storage).posterPath).toBeNull();
  });
});
