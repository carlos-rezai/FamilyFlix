// @vitest-environment node
//
// 59, Rebuild whole, Phase 1 (issue #548): a scanned series brings its art.
//
// The QA ticket's repro: a **Folder scan** of `Tidewater (2018)` read its
// series poster, its Season 01 **Season poster** and its S01E01 **Still** off
// the disk and dropped all three. Now a series reaches the importer whole and
// every piece is copied in with `media.copyIn`, whatever the **Import mode**:
// the **Poster** and **Backdrop** on the new series, each Season poster once
// its season holds an episode, each Still on its episode as a picked Still. A
// copy that fails is the show's one `failed` **Problem**.
//
// Composed as the series suites are: the series fixture copied into a
// sandbox, its Title folder given its own art, a real `freshStorage`, a real
// `Media` over a sandbox **Managed media directory** (its `copyIn` failing on
// cue in the last suite) and the absent **Playback component**. Each image is
// a fixture JPEG with its own name appended, so a copy is known by its bytes.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type { ImportMode, ImportRun, SeriesDetail } from '@/types';

const SHOW = 'Tidewater (2018)';

/** A real JPEG to build each image from. */
const JPEG = readFileSync(
  join(LIBRARY_FIXTURE, 'root', 'Die Hard (1988)', 'Images', 'poster.jpg')
);

/** An image whose bytes are the JPEG's and then its own name. */
function writeImage(path: string, name: string): Buffer {
  const bytes = Buffer.concat([JPEG, Buffer.from(name)]);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, bytes);
  return bytes;
}

/** Where each piece of Tidewater's art lies in its Title folder. */
interface Art {
  poster: string;
  backdrop: string;
  seasonPoster: string;
  still: string;
  /** Season 02's poster: a Season folder holding no episode. */
  hollowSeasonPoster: string;
}

/** Each piece's path in Tidewater's Title folder. */
const PIECES: Art = {
  poster: join('Images', 'tidewater-poster.jpg'),
  backdrop: join('Images', 'backdrop.jpg'),
  seasonPoster: join('Season 01', 'Images', 'poster.jpg'),
  still: join('Season 01', 'Images', 'Stills', 'S01E01.jpg'),
  hollowSeasonPoster: join('Season 02', 'Images', 'poster.jpg'),
};

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  folder: StoredLibraryFolder;
  /** The Managed media directory. */
  media: string;
  /** Each piece's bytes, by its name in {@link Art}. */
  bytes: Record<keyof Art, Buffer>;
}

/**
 * The series fixture listed as a Library folder, Tidewater's Title folder
 * given a poster, a backdrop, a Season 01 poster and an S01E01 Still, and a
 * `Season 02/` holding a poster and no video. `wrap` stands between the real
 * Media and the importer.
 */
function sandbox(wrap: (real: Media) => Media = (real) => real): Sandbox {
  const dir = sandboxRoot('familyflix-import-series-art-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root } = seriesFixture(dir, 'library.csv');

  const show = join(root, SHOW);
  const bytes = Object.fromEntries(
    Object.entries(PIECES).map(([name, path]) => [
      name,
      writeImage(join(show, path), name),
    ])
  ) as Record<keyof Art, Buffer>;

  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: wrap(createMedia(media)),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
  });
  const folder = storage.addLibraryFolder(root);
  return { storage, importer, folder, media, bytes };
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

/** One whole Folder scan in a mode. */
async function scanOnce(box: Sandbox, mode: ImportMode): Promise<ImportRun> {
  await box.importer.scan([box.folder], false, mode);
  return untilReview(box.importer);
}

/** Tidewater as the library holds it, or a failure when it holds none. */
function tidewater(storage: LibraryStorage): SeriesDetail {
  const series = storage
    .getSeriesHome()
    .series.find((held) => held.title === 'Tidewater');
  const detail =
    series === undefined ? null : storage.getSeriesDetail(series.id);
  if (detail === null) {
    throw new Error('the library holds no Tidewater');
  }
  return detail;
}

/** The bytes of a Stored path in the Managed media directory. */
function stored(box: Sandbox, path: string | null): Buffer {
  expect(path).not.toBeNull();
  const absolute = join(box.media, path as string);
  expect(existsSync(absolute)).toBe(true);
  return readFileSync(absolute);
}

/** Every file under the Managed media directory, absolute. */
function mediaFiles(box: Sandbox): string[] {
  return (
    readdirSync(box.media, { recursive: true, withFileTypes: true }) as {
      isFile(): boolean;
      name: string;
      parentPath: string;
    }[]
  )
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

describe.each(['copy', 'link'] as const)(
  'createImporter.scan: a scanned series brings its art (%s)',
  (mode) => {
    it('copies the series’ poster in', async () => {
      const box = sandbox();

      await scanOnce(box, mode);

      const { series } = tidewater(box.storage);
      expect(stored(box, series.posterPath)).toEqual(box.bytes.poster);
    });

    it('copies the series’ backdrop in', async () => {
      const box = sandbox();

      await scanOnce(box, mode);

      const { series } = tidewater(box.storage);
      expect(stored(box, series.backdropPath)).toEqual(box.bytes.backdrop);
    });

    it('copies Season 01’s poster in as its Season poster', async () => {
      const box = sandbox();

      await scanOnce(box, mode);

      const first = tidewater(box.storage).seasons.find(
        (season) => season.number === 1
      );
      expect(first).toBeDefined();
      expect(stored(box, first?.posterPath ?? null)).toEqual(
        box.bytes.seasonPoster
      );
    });

    it('copies S01E01’s Still in on its episode, and gives S01E02 none', async () => {
      const box = sandbox();

      await scanOnce(box, mode);

      const [first] = tidewater(box.storage).seasons;
      const [e01, e02] = first.episodes;
      expect(stored(box, e01.stillPath)).toEqual(box.bytes.still);
      expect(e02.stillPath).toBeNull();
    });

    it('records the scanned Still as picked', async () => {
      const box = sandbox();

      await scanOnce(box, mode);

      const detail = tidewater(box.storage);
      const e01 = detail.seasons[0].episodes[0];
      expect(box.storage.stillSourcesOf(detail.series.id).get(e01.id)).toBe(
        'picked'
      );
    });

    it('copies the poster of a season holding an episode, never one holding none', async () => {
      const box = sandbox();

      await scanOnce(box, mode);

      const copiesOf = (bytes: Buffer): string[] =>
        mediaFiles(box).filter((file) => readFileSync(file).equals(bytes));
      expect(copiesOf(box.bytes.seasonPoster)).toHaveLength(1);
      expect(copiesOf(box.bytes.hollowSeasonPoster)).toEqual([]);
      expect(
        tidewater(box.storage).seasons.map((season) => season.number)
      ).toEqual([1]);
    });
  }
);

/** A Media whose copy of Tidewater's `piece` throws, every other copy real. */
const failingOn =
  (piece: keyof Art) =>
  (real: Media): Media => ({
    ...real,
    copyIn: async (...args) => {
      if (args[1].endsWith(join(SHOW, PIECES[piece]))) {
        throw new Error('no space left on device');
      }
      return real.copyIn(...args);
    },
  });

describe('createImporter.scan: a series art copy that fails', () => {
  it.each([['poster'], ['backdrop'], ['seasonPoster'], ['still']] as const)(
    'files a failed %s copy as the show’s one failed Problem',
    async (piece) => {
      const box = sandbox(failingOn(piece));

      const run = await scanOnce(box, 'copy');

      const failed = run.problems.filter(
        (problem) => problem.kind === 'failed'
      );
      expect(failed).toHaveLength(1);
      expect(failed[0].title).toContain('Tidewater');
    }
  );
});
