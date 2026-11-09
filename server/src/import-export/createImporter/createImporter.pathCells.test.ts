// @vitest-environment node
//
// 59, Rebuild whole, Phase 8 (issue #555): path cells fill empty places.
//
// A sheet's path cell is read only for a **Layout place** the Title folder's
// read left empty: a cell naming a file that is there fills a poster, a
// backdrop, a **Season poster** or a **Still** the read did not find, and
// adds a track the read did not find. The folder's reading always wins, a
// cell naming a file that is not there fills nothing, and the `Video` cell is
// never read, whichever import reads the sheet.
//
// Composed as the fixture suites are: the importer's film or series fixture
// copied into a sandboxed Library folder with the sheet in its `Meta/`, a
// real `freshStorage`, a real `Media` over a sandbox **Managed media
// directory**, the absent **Playback component** and an idle **Library
// sheet writer**. Each file a cell names is the fixture's own bytes with its
// name appended, so a copy is known by its bytes.

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
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { SERIES_FIXTURE } from '../../test-support/seriesFixture/seriesFixture';
import type { ImportRun, Movie, SeriesDetail } from '@/types';

const DIE_HARD = 'Die Hard (1988)';
const TIDEWATER = 'Tidewater (2018)';

/** The fixture sheet's header: every Sheet column. */
const HEADER = readFileSync(join(LIBRARY_FIXTURE, 'library.csv'), 'utf8')
  .split(/\r?\n/)[0]
  .trim();

/** A real JPEG to build each image from. */
const JPEG = readFileSync(
  join(LIBRARY_FIXTURE, 'root', DIE_HARD, 'Images', 'poster.jpg')
);

/** Die Hard's own video, as its Title folder holds it. */
const DIE_HARD_VIDEO = join(DIE_HARD, 'Die.Hard.1988.1080p.mp4');

/** Die Hard's two tracks, as its Subtitles folder holds them. */
const DIE_HARD_TRACKS = [
  `${DIE_HARD}/Subtitles/Die.Hard.1988.1080p.en.srt`,
  `${DIE_HARD}/Subtitles/Die.Hard.1988.1080p.pt.srt`,
];

/** Die Hard's path cells, each a Library-folder-relative path or blank. */
interface FilmCells {
  video?: string;
  subtitles?: string[];
  poster?: string;
  backdrop?: string;
}

/** A sheet of one Movie row, Die Hard's, with `cells` for its path cells. */
const dieHardSheet = (cells: FilmCells): string =>
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
      cells.video ?? '',
      (cells.subtitles ?? []).join('|'),
      cells.poster ?? '',
      cells.backdrop ?? '',
      '',
    ].join(','),
    '',
  ].join('\n');

/** Tidewater's path cells, each a Library-folder-relative path or blank. */
interface ShowCells {
  poster?: string;
  backdrop?: string;
  seasonPoster?: string;
  still?: string;
}

/** A sheet of Tidewater's Series, Season and Episode rows, with `cells`. */
const tidewaterSheet = (cells: ShowCells): string =>
  [
    HEADER,
    `Series,${TIDEWATER},,,Tidewater,2018,,,"Drama, Family",Ines Duarte,"Rui Matos, Clara Bento",A ferry crew keeps an island connected through one hard winter.,7,,,,,,,${cells.poster ?? ''},${cells.backdrop ?? ''},`,
    `Season,${TIDEWATER},1,,,,,,,,,,,,,,,,,${cells.seasonPoster ?? ''},,`,
    `Episode,${TIDEWATER},1,1,Low Water,,2018-10-02,,,,,,,,,Unwatched,,,,,,${cells.still ?? ''}`,
    `Episode,${TIDEWATER},1,2,The Crossing,,2018-10-09,,,,,,,,,Unwatched,,,,,,`,
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
  /** The sheet in the Library folder's `Meta/`. */
  sheet: string;
}

/** `fixture`'s tree copied into a sandboxed Library folder, its sheet in `Meta/`. */
function sandbox(fixture: string, csv: string): Sandbox {
  const dir = sandboxRoot('familyflix-import-path-cells-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  cpSync(join(fixture, 'root'), root, { recursive: true });
  mkdirSync(join(root, 'Meta'));
  const sheet = join(root, 'Meta', 'familyflix-library.csv');
  writeFileSync(sheet, csv);

  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
  });
  const folder = storage.addLibraryFolder(root);
  return { storage, importer, folder, root, media, sheet };
}

/** The film fixture, its sheet Die Hard's row with `cells`. */
const filmSandbox = (cells: FilmCells): Sandbox =>
  sandbox(LIBRARY_FIXTURE, dieHardSheet(cells));

/** The series fixture, its sheet Tidewater's rows with `cells`. */
const showSandbox = (cells: ShowCells): Sandbox =>
  sandbox(SERIES_FIXTURE, tidewaterSheet(cells));

/** A file in the Library folder, by its sheet spelling, written as `bytes`. */
function writeFile(box: Sandbox, cell: string, bytes: Buffer): Buffer {
  const path = join(box.root, ...cell.split('/'));
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, bytes);
  return bytes;
}

/** An image at `cell`: the fixture JPEG, then its own spelling. */
const writeImage = (box: Sandbox, cell: string): Buffer =>
  writeFile(box, cell, Buffer.concat([JPEG, Buffer.from(cell)]));

/** A file of the Library folder taken away, by its path under the folder. */
function remove(box: Sandbox, ...path: string[]): void {
  rmSync(join(box.root, ...path));
}

/** A file of the Library folder's bytes, by its path under the folder. */
const bytesOf = (box: Sandbox, ...path: string[]): Buffer =>
  readFileSync(join(box.root, ...path));

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

/** One whole _Import from spreadsheet_ of the folder's own sheet, copying. */
async function importSheet(box: Sandbox): Promise<ImportRun> {
  await box.importer.start(box.sheet, false, 'copy');
  return untilReview(box.importer);
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

/** The bytes of each of Die Hard's stored tracks. */
const tracksOf = (box: Sandbox): Buffer[] =>
  dieHard(box.storage).subtitles.map((track) => stored(box, track.path));

describe('createImporter.scan: a path cell fills an image place the folder left empty', () => {
  it('fills a film’s poster from a cell naming an image beside its video', async () => {
    const cell = `${DIE_HARD}/heat.jpg`;
    const box = filmSandbox({ poster: cell });
    remove(box, DIE_HARD, 'Images', 'poster.jpg');
    const bytes = writeImage(box, cell);

    await scanOnce(box);

    expect(stored(box, dieHard(box.storage).posterPath)).toEqual(bytes);
  });

  it('fills a film’s backdrop from a cell naming an image the read does not take', async () => {
    const cell = `${DIE_HARD}/Images/wide.jpg`;
    const box = filmSandbox({ backdrop: cell });
    remove(box, DIE_HARD, 'Images', 'backdrop.jpg');
    const bytes = writeImage(box, cell);

    await scanOnce(box);

    expect(stored(box, dieHard(box.storage).backdropPath)).toEqual(bytes);
  });

  it('fills a series’ poster and backdrop from its Series row’s cells', async () => {
    const poster = `${TIDEWATER}/tidewater.jpg`;
    const backdrop = `${TIDEWATER}/wide.jpg`;
    const box = showSandbox({ poster, backdrop });
    const posterBytes = writeImage(box, poster);
    const backdropBytes = writeImage(box, backdrop);

    await scanOnce(box);

    const { series } = tidewater(box.storage);
    expect(stored(box, series.posterPath)).toEqual(posterBytes);
    expect(stored(box, series.backdropPath)).toEqual(backdropBytes);
  });

  it('fills a Season poster from its Season row’s cell', async () => {
    const cell = `${TIDEWATER}/Season 01/cover.jpg`;
    const box = showSandbox({ seasonPoster: cell });
    remove(box, TIDEWATER, 'Season 01', 'Images', 'poster.jpg');
    const bytes = writeImage(box, cell);

    await scanOnce(box);

    const first = tidewater(box.storage).seasons.find(
      (season) => season.number === 1
    );
    expect(stored(box, first?.posterPath ?? null)).toEqual(bytes);
  });

  it('fills an episode’s Still from its Episode row’s cell', async () => {
    const cell = `${TIDEWATER}/Season 01/Images/low-water.jpg`;
    const box = showSandbox({ still: cell });
    remove(box, TIDEWATER, 'Season 01', 'Images', 'Stills', 'S01E01.jpg');
    const bytes = writeImage(box, cell);

    await scanOnce(box);

    const [e01] = tidewater(box.storage).seasons[0].episodes;
    expect(stored(box, e01.stillPath)).toEqual(bytes);
  });
});

describe('createImporter.scan: a path cell adds a track the folder’s read did not find', () => {
  it('adds a track lying beside the video to the two in Subtitles/, once each', async () => {
    const french = `${DIE_HARD}/Die.Hard.1988.1080p.fr.srt`;
    const box = filmSandbox({ subtitles: [...DIE_HARD_TRACKS, french] });
    const bytes = writeFile(
      box,
      french,
      Buffer.from('1\n00:00:01,000 --> 00:00:02,000\nBonjour\n')
    );

    await scanOnce(box);

    const tracks = tracksOf(box);
    expect(tracks).toHaveLength(3);
    expect(tracks).toContainEqual(bytes);
  });
});

describe('createImporter.scan: a path cell never beats a file the folder’s read found', () => {
  it('keeps the folder’s poster over the cell’s, while the cell fills the empty backdrop', async () => {
    const poster = `${DIE_HARD}/heat.jpg`;
    const backdrop = `${DIE_HARD}/wide.jpg`;
    const box = filmSandbox({ poster, backdrop });
    writeImage(box, poster);
    remove(box, DIE_HARD, 'Images', 'backdrop.jpg');
    const backdropBytes = writeImage(box, backdrop);

    await scanOnce(box);

    const movie = dieHard(box.storage);
    expect(stored(box, movie.posterPath)).toEqual(
      bytesOf(box, DIE_HARD, 'Images', 'poster.jpg')
    );
    expect(stored(box, movie.backdropPath)).toEqual(backdropBytes);
  });
});

describe.each([
  ['a Folder scan', scanOnce],
  ['Import from spreadsheet', importSheet],
] as const)('createImporter: the Video cell, by %s', (_, run) => {
  it('is never read: the folder’s video imports, while the poster cell fills', async () => {
    const other = `${DIE_HARD}/Extras/Die.Hard.Directors.Cut.mp4`;
    const poster = `${DIE_HARD}/heat.jpg`;
    const box = filmSandbox({ video: other, poster });
    writeFile(
      box,
      other,
      Buffer.concat([bytesOf(box, DIE_HARD_VIDEO), Buffer.from(other)])
    );
    remove(box, DIE_HARD, 'Images', 'poster.jpg');
    const posterBytes = writeImage(box, poster);

    await run(box);

    const movie = dieHard(box.storage);
    expect(stored(box, movie.videoPath)).toEqual(bytesOf(box, DIE_HARD_VIDEO));
    expect(stored(box, movie.posterPath)).toEqual(posterBytes);
  });
});

describe('createImporter.scan: a path cell naming a file that is not there', () => {
  it('fills nothing, while a cell naming a file that is there fills its place', async () => {
    const gonePoster = `${DIE_HARD}/gone.jpg`;
    const goneTrack = `${DIE_HARD}/Die.Hard.1988.1080p.fr.srt`;
    const backdrop = `${DIE_HARD}/wide.jpg`;
    const box = filmSandbox({
      poster: gonePoster,
      backdrop,
      subtitles: [...DIE_HARD_TRACKS, goneTrack],
    });
    remove(box, DIE_HARD, 'Images', 'poster.jpg');
    remove(box, DIE_HARD, 'Images', 'backdrop.jpg');
    const backdropBytes = writeImage(box, backdrop);

    const run = await scanOnce(box);

    const movie = dieHard(box.storage);
    expect(movie.posterPath).toBeNull();
    expect(stored(box, movie.backdropPath)).toEqual(backdropBytes);
    expect(movie.subtitles).toHaveLength(2);
    expect(run.problems.filter((each) => each.kind === 'failed')).toEqual([]);
  });
});
