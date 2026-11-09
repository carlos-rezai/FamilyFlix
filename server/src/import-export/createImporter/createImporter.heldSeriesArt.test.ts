// @vitest-environment node
//
// 59, Rebuild whole, Phase 2 (issue #549): a rescan fills a held series'
// empty art.
//
// A series scanned before its art lay in its **Title folder** (as under step
// 41, which dropped it) is scanned again: its empty **Poster**, **Backdrop**,
// **Season posters** and its held episodes' **Stills** are taken from the
// folder and copied in as a first scan copies them, never replacing art the
// series already has (a **Sync**'s or a hand pick), and the fill files no
// **Problem**: it adds no review row.
//
// Composed as Phase 1's suite is: the series fixture copied into a sandbox,
// Tidewater's own art stripped for the first scan and laid back before the
// second, a real `freshStorage`, a real `Media` over a sandbox **Managed media
// directory** and the absent **Playback component**. Each image is a fixture
// JPEG with its own name appended, so a copy is known by its bytes.

import {
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

/** The pieces of Tidewater's art a rescan may fill. */
type Piece = 'poster' | 'backdrop' | 'seasonPoster' | 'still';

/** Each piece's path in Tidewater's Title folder. */
const PIECES: Record<Piece, string> = {
  poster: join('Images', 'tidewater-poster.jpg'),
  backdrop: join('Images', 'backdrop.jpg'),
  seasonPoster: join('Season 01', 'Images', 'poster.jpg'),
  still: join('Season 01', 'Images', 'Stills', 'S01E01.jpg'),
};

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  folder: StoredLibraryFolder;
  /** The Managed media directory. */
  media: string;
  /** Tidewater's Title folder. */
  show: string;
}

/**
 * The series fixture listed as a Library folder, Tidewater's Title folder
 * holding no art at all: its Season 01 poster and Still are taken away.
 */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-held-series-art-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root } = seriesFixture(dir, 'library.csv');
  const show = join(root, SHOW);
  rmSync(join(show, 'Season 01', 'Images'), { recursive: true, force: true });

  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
  });
  const folder = storage.addLibraryFolder(root);
  return { storage, importer, folder, media, show };
}

/** Lay Tidewater's art into its Title folder: each piece's bytes by name. */
function layArt(box: Sandbox): Record<Piece, Buffer> {
  return Object.fromEntries(
    (Object.entries(PIECES) as [Piece, string][]).map(([name, path]) => [
      name,
      writeImage(join(box.show, path), name),
    ])
  ) as Record<Piece, Buffer>;
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

/** Each piece's Stored path on Tidewater as held now. */
function heldPaths(box: Sandbox): Record<Piece, string | null> {
  const { series, seasons } = tidewater(box.storage);
  const first = seasons.find((season) => season.number === 1);
  return {
    poster: series.posterPath,
    backdrop: series.backdropPath,
    seasonPoster: first?.posterPath ?? null,
    still: first?.episodes[0]?.stillPath ?? null,
  };
}

/**
 * Give held Tidewater art of its own for `piece`, as a Sync or a hand pick
 * would: a file in the Managed media directory, its Stored path recorded.
 */
function holdArt(box: Sandbox, piece: Piece): string {
  const path = join('held-art', `${piece}.jpg`);
  writeImage(join(box.media, path), `held ${piece}`);
  const detail = tidewater(box.storage);
  const id = detail.series.id;
  if (piece === 'poster') {
    box.storage.enrichSeries(id, { posterPath: path });
  } else if (piece === 'backdrop') {
    box.storage.enrichSeries(id, { backdropPath: path });
  } else if (piece === 'seasonPoster') {
    box.storage.setSeasonPoster(id, 1, path);
  } else {
    const e01 = detail.seasons[0].episodes[0];
    box.storage.enrichEpisode(e01.id, {
      stillPath: path,
      stillSource: 'tmdb',
    });
  }
  return path;
}

describe.each(['copy', 'link'] as const)(
  'createImporter.scan: a rescan fills a held series’ empty art (%s)',
  (mode) => {
    it('fills a held series’ poster, backdrop, Season poster and Still', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      expect(heldPaths(box)).toEqual({
        poster: null,
        backdrop: null,
        seasonPoster: null,
        still: null,
      });
      const bytes = layArt(box);

      await scanOnce(box, mode);

      const paths = heldPaths(box);
      expect(stored(box, paths.poster)).toEqual(bytes.poster);
      expect(stored(box, paths.backdrop)).toEqual(bytes.backdrop);
      expect(stored(box, paths.seasonPoster)).toEqual(bytes.seasonPoster);
      expect(stored(box, paths.still)).toEqual(bytes.still);
    });

    it('gives the filled Still the Still source picked, and S01E02 none', async () => {
      const box = sandbox();
      await scanOnce(box, mode);
      layArt(box);

      await scanOnce(box, mode);

      const detail = tidewater(box.storage);
      const [e01, e02] = detail.seasons[0].episodes;
      expect(box.storage.stillSourcesOf(detail.series.id).get(e01.id)).toBe(
        'picked'
      );
      expect(e02.stillPath).toBeNull();
    });

    it.each([['poster'], ['backdrop'], ['seasonPoster'], ['still']] as const)(
      'keeps the %s the series already has, filling only the rest',
      async (piece) => {
        const box = sandbox();
        await scanOnce(box, mode);
        const held = holdArt(box, piece);
        const bytes = layArt(box);

        await scanOnce(box, mode);

        const paths = heldPaths(box);
        expect(paths[piece]).toBe(held);
        for (const other of Object.keys(PIECES) as Piece[]) {
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
