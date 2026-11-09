// @vitest-environment node
//
// 58, Folder layout, Phase 7 (issue #540): the Library sheet writer.
//
// `createLibrarySheet({ storage })` is the **Library sheet writer**: told
// which **Library folders** a write touched, it waits a few seconds after the
// last touch, then rewrites each folder's `Meta/familyflix-library.csv` from
// the library, through a temporary file in `Meta/` and a rename, behind its
// BOM, making `Meta/` when absent. The sheet holds every title recorded
// against that folder with a **Source folder**; a copied title is in no
// sheet. An **Unreachable** folder is skipped and written when a later touch
// finds it reachable. `flush` writes every pending sheet now. A **Factory
// reset** never writes a sheet.
//
// Real in-memory SQLite, real temporary Library folders, the sheet read back
// through the **Sheet reader**; only `setTimeout` is faked, so the disk runs
// for real.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { readSheet } from '../readSheet/readSheet';
import {
  createLibrarySheet,
  LIBRARY_SHEET,
  LIBRARY_SHEET_DELAY_MS,
} from './createLibrarySheet';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
});

/** A library with folders A and B listed on disk, and titles recorded under them. */
function world() {
  const root = sandboxRoot('familyflix-library-sheet-');
  const pathA = join(root, 'Movies');
  const pathB = join(root, 'Films');
  mkdirSync(join(pathA, 'Heat (1995)'), { recursive: true });
  writeFileSync(join(pathA, 'Heat (1995)', 'Heat.mkv'), 'a film');
  mkdirSync(join(pathB, 'Ronin (1998)'), { recursive: true });

  const storage = freshStorage();
  const a = storage.addLibraryFolder(pathA);
  const b = storage.addLibraryFolder(pathB);

  const heat = storage.addMovie(
    newMovie({
      title: 'Heat',
      year: 1995,
      videoPath: 'Heat (1995)/Heat.mkv',
      videoFolderId: a.id,
    })
  );
  storage.setSourceFolder(heat.id, a.id, 'Heat (1995)');

  const series = storage.addSeries({ title: 'Harbor', year: 2020 }, [
    {
      season: 1,
      number: 1,
      title: 'Arrivals',
      videoPath: 'Harbor (2020)/Season 01/Harbor S01E01.mkv',
      videoFolderId: a.id,
      sourceFile: 'Season 01/Harbor S01E01.mkv',
    },
  ]);
  storage.setSourceFolder(series.id, a.id, 'Harbor (2020)');

  const ronin = storage.addMovie(
    newMovie({
      title: 'Ronin',
      year: 1998,
      videoPath: 'Ronin (1998)/Ronin.mkv',
      videoFolderId: b.id,
    })
  );
  storage.setSourceFolder(ronin.id, b.id, 'Ronin (1998)');

  // Linked under A with no Source folder, and copied: in no sheet.
  storage.addMovie(
    newMovie({
      title: 'Loose',
      year: 2001,
      videoPath: 'loose.mkv',
      videoFolderId: a.id,
    })
  );
  storage.addMovie(newMovie({ title: 'Copied', year: 2003 }));

  const sheet = createLibrarySheet({ storage });
  return { root, storage, sheet, a, b, pathA, pathB, heat, series };
}

/** The Library sheet's path inside a Library folder. */
function sheetOf(folderPath: string): string {
  return join(folderPath, LIBRARY_SHEET);
}

/** The Movie and Series rows' titles of a folder's sheet, in sheet order. */
async function titlesIn(folderPath: string): Promise<string[]> {
  const rows = await readSheet(
    readFileSync(sheetOf(folderPath)),
    'familyflix-library.csv'
  );
  return rows
    .filter((row) => row.type === 'Movie' || row.type === 'Series')
    .map((row) => row.title);
}

describe('LIBRARY_SHEET', () => {
  it('is the CSV in the Meta folder', () => {
    expect(LIBRARY_SHEET).toBe('Meta/familyflix-library.csv');
  });
});

describe('createLibrarySheet: the debounce', () => {
  it('makes one write of many touches, a delay after the last', async () => {
    const { sheet, a, pathA } = world();

    sheet.touch([a.id]);
    await vi.advanceTimersByTimeAsync(LIBRARY_SHEET_DELAY_MS - 1);
    sheet.touch([a.id]);
    await vi.advanceTimersByTimeAsync(LIBRARY_SHEET_DELAY_MS - 1);
    sheet.touch([a.id]);
    await vi.advanceTimersByTimeAsync(LIBRARY_SHEET_DELAY_MS - 1);
    expect(existsSync(sheetOf(pathA))).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(existsSync(sheetOf(pathA))).toBe(true));

    rmSync(sheetOf(pathA));
    await vi.advanceTimersByTimeAsync(LIBRARY_SHEET_DELAY_MS * 10);
    await sheet.flush();
    expect(existsSync(sheetOf(pathA))).toBe(false);
  });
});

describe('createLibrarySheet: the rewrite', () => {
  it('makes Meta/ when absent and writes the sheet behind its BOM', async () => {
    const { storage, sheet, a, pathA, heat } = world();
    expect(existsSync(join(pathA, 'Meta'))).toBe(false);
    storage.setRating(heat.id, 8);

    sheet.touch([a.id]);
    await sheet.flush();

    const bytes = readFileSync(sheetOf(pathA));
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const rows = await readSheet(bytes, 'familyflix-library.csv');
    expect(rows.find((row) => row.title === 'Heat')?.rating).toBe(8);
  });

  it('lands by rename from a temporary file in Meta/, leaving nothing else there', async () => {
    const { storage, sheet, a, pathA, heat } = world();
    sheet.touch([a.id]);
    await sheet.flush();
    const before = statSync(sheetOf(pathA), { bigint: true }).ino;

    storage.setRating(heat.id, 6);
    sheet.touch([a.id]);
    await sheet.flush();

    // A rename puts a new file in the sheet's place; an in-place write would
    // keep the old one.
    expect(statSync(sheetOf(pathA), { bigint: true }).ino).not.toBe(before);
    expect(readdirSync(join(pathA, 'Meta'))).toEqual([
      'familyflix-library.csv',
    ]);
    const rows = await readSheet(
      readFileSync(sheetOf(pathA)),
      'familyflix-library.csv'
    );
    expect(rows.find((row) => row.title === 'Heat')?.rating).toBe(6);
  });

  it('holds only that folder’s titles with a Source folder, every row type of a series', async () => {
    const { sheet, a, b, pathA, pathB } = world();

    sheet.touch([a.id, b.id]);
    await sheet.flush();

    expect(await titlesIn(pathA)).toEqual(['Harbor', 'Heat']);
    expect(await titlesIn(pathB)).toEqual(['Ronin']);
    const rows = await readSheet(
      readFileSync(sheetOf(pathA)),
      'familyflix-library.csv'
    );
    expect(rows.map((row) => row.type).sort()).toEqual(
      ['Episode', 'Movie', 'Season', 'Series'].sort()
    );
  });

  it('takes a deleted title’s rows out and leaves its files', async () => {
    const { storage, sheet, a, pathA, heat } = world();
    sheet.touch([a.id]);
    await sheet.flush();

    storage.deleteMovie(heat.id);
    sheet.touch([a.id]);
    await sheet.flush();

    expect(await titlesIn(pathA)).toEqual(['Harbor']);
    expect(existsSync(join(pathA, 'Heat (1995)', 'Heat.mkv'))).toBe(true);
  });
});

describe('createLibrarySheet: an Unreachable folder', () => {
  it('is skipped, writing nothing there, then written once a touch finds it reachable', async () => {
    const { root, storage, sheet } = world();
    const unplugged = join(root, 'Unplugged');
    const folder = storage.addLibraryFolder(unplugged);
    const film = storage.addMovie(
      newMovie({
        title: 'Alien',
        year: 1979,
        videoPath: 'Alien (1979)/Alien.mkv',
        videoFolderId: folder.id,
      })
    );
    storage.setSourceFolder(film.id, folder.id, 'Alien (1979)');

    sheet.touch([folder.id]);
    await vi.advanceTimersByTimeAsync(LIBRARY_SHEET_DELAY_MS * 2);
    await sheet.flush();
    expect(existsSync(unplugged)).toBe(false);

    mkdirSync(join(unplugged, 'Alien (1979)'), { recursive: true });
    sheet.touch([folder.id]);
    await sheet.flush();

    expect(await titlesIn(unplugged)).toEqual(['Alien']);
  });
});

describe('createLibrarySheet: flush', () => {
  it('writes every pending sheet at once, and leaves nothing pending', async () => {
    const { sheet, a, b, pathA, pathB } = world();

    sheet.touch([a.id]);
    sheet.touch([b.id]);
    await sheet.flush();

    expect(existsSync(sheetOf(pathA))).toBe(true);
    expect(existsSync(sheetOf(pathB))).toBe(true);

    rmSync(sheetOf(pathA));
    rmSync(sheetOf(pathB));
    await vi.advanceTimersByTimeAsync(LIBRARY_SHEET_DELAY_MS * 10);
    await sheet.flush();
    expect(existsSync(sheetOf(pathA))).toBe(false);
    expect(existsSync(sheetOf(pathB))).toBe(false);
  });
});

describe('createLibrarySheet: a Factory reset', () => {
  it('leaves a Library sheet byte-for-byte untouched, its pending work dropped', async () => {
    const { storage, sheet, a, pathA, heat } = world();
    sheet.touch([a.id]);
    await sheet.flush();
    const before = readFileSync(sheetOf(pathA));

    storage.setRating(heat.id, 4);
    sheet.touch([a.id]);
    storage.reset();
    await vi.advanceTimersByTimeAsync(LIBRARY_SHEET_DELAY_MS * 10);
    await sheet.flush();

    expect(readFileSync(sheetOf(pathA)).equals(before)).toBe(true);
  });
});

// 58, Folder layout, Phase 8 (issue #541): while a run's review holds a
// folder's sheet values, `hold` keeps that folder's sheet as it is; `release`
// rewrites it from the library, so a difference the family skipped becomes the
// family's value in the sheet.
describe('createLibrarySheet: hold and release', () => {
  it('writes nothing to a held folder however long it waits, flush included', async () => {
    const { storage, sheet, a, pathA, heat } = world();
    sheet.touch([a.id]);
    await sheet.flush();
    const before = readFileSync(sheetOf(pathA));

    sheet.hold(a.id);
    storage.setRating(heat.id, 4);
    sheet.touch([a.id]);
    await vi.advanceTimersByTimeAsync(LIBRARY_SHEET_DELAY_MS * 10);
    await sheet.flush();

    expect(readFileSync(sheetOf(pathA)).equals(before)).toBe(true);
  });

  it('rewrites a released folder from the library', async () => {
    const { storage, sheet, a, pathA, heat } = world();
    sheet.touch([a.id]);
    await sheet.flush();

    sheet.hold(a.id);
    storage.setRating(heat.id, 4);
    sheet.touch([a.id]);
    await sheet.flush();
    sheet.release(a.id);
    await vi.advanceTimersByTimeAsync(LIBRARY_SHEET_DELAY_MS * 2);
    await sheet.flush();

    const rows = await readSheet(
      readFileSync(sheetOf(pathA)),
      'familyflix-library.csv'
    );
    expect(rows.find((row) => row.title === 'Heat')?.rating).toBe(4);
  });

  it('rewrites a released folder from the library even with no touch while held', async () => {
    const { storage, sheet, a, pathA, heat } = world();
    sheet.touch([a.id]);
    await sheet.flush();
    // The sheet on disk says otherwise, as a sheet a run read would.
    storage.setRating(heat.id, 4);
    sheet.touch([a.id]);
    await sheet.flush();
    const fromLibrary = readFileSync(sheetOf(pathA));
    writeFileSync(sheetOf(pathA), 'Type,Folder,Title\n');

    sheet.hold(a.id);
    sheet.release(a.id);
    await vi.advanceTimersByTimeAsync(LIBRARY_SHEET_DELAY_MS * 2);
    await sheet.flush();

    expect(readFileSync(sheetOf(pathA)).equals(fromLibrary)).toBe(true);
  });

  it('keeps writing a folder that is not held while another is', async () => {
    const { sheet, a, b, pathB } = world();

    sheet.hold(a.id);
    sheet.touch([a.id, b.id]);
    await sheet.flush();

    expect(await titlesIn(pathB)).toEqual(['Ronin']);
  });
});

// 59, Rebuild whole, Phase 6 (issue #553): the sheet reads its folders.
//
// Before a write, each recorded **Title folder** is read with
// `readTitleFolder` and the reads become the sheet's **Path cells**
// (`layoutCells`): each cell names the file on disk, by its own name, never
// the path storage or a **File plan** would spell. A **Frame still**, which
// the folder never holds, is blank. A Title folder that cannot be read gives
// blank path cells and every other cell of its row.

/** One Library folder holding Die Hard and Tidewater as the family named them. */
function laidOut() {
  const root = sandboxRoot('familyflix-library-sheet-cells-');
  const path = join(root, 'Movies');
  const put = (...parts: string[]): void => {
    const file = join(path, ...parts);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, parts.join('/'));
  };
  put('Die Hard (1988)', 'Die.Hard.1988.1080p.mp4');
  put('Die Hard (1988)', 'Images', 'die-hard-1988-poster.jpg');
  put('Die Hard (1988)', 'Images', 'my-own-BACKDROP.png');
  put('Die Hard (1988)', 'Subtitles', 'Die.Hard.1988.1080p.en.srt');
  put('Tidewater (2018)', 'Images', 'my-own-POSTER.jpg');
  put('Tidewater (2018)', 'Season 01', 'Tidewater S01E01.mkv');
  put('Tidewater (2018)', 'Season 01', 'Tidewater S01E02.mkv');
  put('Tidewater (2018)', 'Season 01', 'Images', 'season-one-poster.png');
  put('Tidewater (2018)', 'Season 01', 'Images', 'Stills', 'S01E01.png');
  put(
    'Tidewater (2018)',
    'Season 01',
    'Subtitles',
    'S01E01',
    'Tidewater.S01E01.en.srt'
  );

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(path);

  const dieHard = storage.addMovie(
    newMovie({
      title: 'Die Hard',
      year: 1988,
      director: 'John McTiernan',
      synopsis: 'A New York cop takes on a tower full of thieves.',
      videoPath: 'Die Hard (1988)/Die.Hard.1988.1080p.mp4',
      videoFolderId: folder.id,
      posterPath: 'die-hard/poster.jpg',
      backdropPath: 'die-hard/backdrop.jpg',
      subtitles: [{ path: 'die-hard/English.srt', language: 'English' }],
    })
  );
  storage.setSourceFolder(dieHard.id, folder.id, 'Die Hard (1988)');

  const tidewater = storage.addSeries(
    { title: 'Tidewater', year: 2018, posterPath: 'tidewater/poster.jpg' },
    [1, 2].map((number) => ({
      season: 1,
      number,
      title: `Episode ${number}`,
      videoPath: `Tidewater (2018)/Season 01/Tidewater S01E0${number}.mkv`,
      videoFolderId: folder.id,
      sourceFile: `Season 01/Tidewater S01E0${number}.mkv`,
      // S01E02's is a Frame still: stored, never in the folder.
      stillPath: `tidewater/season-01/Tidewater S01E0${number}.frame.jpg`,
    }))
  );
  storage.setSourceFolder(tidewater.id, folder.id, 'Tidewater (2018)');
  storage.setSeasonPoster(tidewater.id, 1, 'tidewater/season-01.jpg');

  const sheet = createLibrarySheet({ storage });
  return { storage, sheet, folder, path };
}

/** A folder's sheet read back as rows, after one touch and a flush. */
async function writtenRows(
  sheet: ReturnType<typeof createLibrarySheet>,
  folderId: string,
  path: string
) {
  sheet.touch([folderId]);
  await sheet.flush();
  return readSheet(readFileSync(sheetOf(path)), 'familyflix-library.csv');
}

describe('createLibrarySheet: the path cells name the files on disk', () => {
  it('names a film’s art and tracks by their own names', async () => {
    const { sheet, folder, path } = laidOut();

    const rows = await writtenRows(sheet, folder.id, path);

    expect(rows.find((row) => row.title === 'Die Hard')).toMatchObject({
      video: 'Die Hard (1988)/Die.Hard.1988.1080p.mp4',
      poster: 'Die Hard (1988)/Images/die-hard-1988-poster.jpg',
      backdrop: 'Die Hard (1988)/Images/my-own-BACKDROP.png',
      subtitles: ['Die Hard (1988)/Subtitles/Die.Hard.1988.1080p.en.srt'],
    });
  });

  it('names a series’ poster, its Season poster, a Still and an episode’s tracks', async () => {
    const { sheet, folder, path } = laidOut();

    const rows = await writtenRows(sheet, folder.id, path);

    expect(rows.find((row) => row.type === 'Series')).toMatchObject({
      poster: 'Tidewater (2018)/Images/my-own-POSTER.jpg',
      backdrop: null,
    });
    expect(rows.find((row) => row.type === 'Season')).toMatchObject({
      poster: 'Tidewater (2018)/Season 01/Images/season-one-poster.png',
    });
    const episode = (number: number) =>
      rows.find((row) => row.type === 'Episode' && row.episode === number);
    expect(episode(1)).toMatchObject({
      still: 'Tidewater (2018)/Season 01/Images/Stills/S01E01.png',
      subtitles: [
        'Tidewater (2018)/Season 01/Subtitles/S01E01/Tidewater.S01E01.en.srt',
      ],
    });
  });

  it('leaves a Frame still’s cell blank', async () => {
    const { sheet, folder, path } = laidOut();

    const rows = await writtenRows(sheet, folder.id, path);

    expect(
      rows.find((row) => row.type === 'Episode' && row.episode === 2)
    ).toMatchObject({ still: null, subtitles: [] });
  });
});

describe('createLibrarySheet: a Title folder it cannot read', () => {
  it('gives blank path cells and every other cell of its row', async () => {
    const { sheet, folder, path } = laidOut();
    rmSync(join(path, 'Die Hard (1988)'), { recursive: true, force: true });

    const rows = await writtenRows(sheet, folder.id, path);

    expect(rows.find((row) => row.title === 'Die Hard')).toMatchObject({
      type: 'Movie',
      folder: 'Die Hard (1988)',
      year: 1988,
      director: 'John McTiernan',
      synopsis: 'A New York cop takes on a tower full of thieves.',
      video: null,
      poster: null,
      backdrop: null,
      subtitles: [],
    });
    expect(rows.find((row) => row.type === 'Series')).toMatchObject({
      poster: 'Tidewater (2018)/Images/my-own-POSTER.jpg',
    });
  });
});
