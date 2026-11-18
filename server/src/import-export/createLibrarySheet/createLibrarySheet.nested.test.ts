// @vitest-environment node
//
// 67, Export paths, Phase 3 (issue #646): the Library sheet of a nested
// library.
//
// A Library folder whose titles were recorded a level deep (`Films/Amelie
// (2001)`, `Series\Tidewater (2018)`) has each recorded **Title folder** read
// where it lies and keyed by its **Folder key**, its last segment: the
// `Folder` cell is that one segment, and every path cell is relative to the
// folder holding the Title folder, so it starts with the title's own folder
// name. A title in the root, beside them, keeps the cells it always had: for
// it the two folders are one (the **Round trip**'s byte-for-byte guard is
// `createImporter.roundTrip.test.ts`).
//
// Real in-memory SQLite, a real temporary Library folder, the sheet read back
// through the **Sheet reader**; only `setTimeout` is faked.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { readSheet } from '../readSheet/readSheet';
import { createLibrarySheet, LIBRARY_SHEET } from './createLibrarySheet';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
});

const SCANNED_AT = '2026-01-01T00:00:00.000Z';

/**
 * One Library folder holding `Heat (1995)/` in its root, `Films/Amelie
 * (2001)/` and `Series/Tidewater (2018)/Season 01/` a level deep.
 */
function laidOut() {
  const root = sandboxRoot('familyflix-library-sheet-nested-');
  const path = join(root, 'Library');
  const put = (...parts: string[]): void => {
    const file = join(path, ...parts);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, parts.join('/'));
  };
  put('Heat (1995)', 'heat.mkv');
  put('Heat (1995)', 'Images', 'poster.jpg');
  put('Films', 'Amelie (2001)', 'amelie.mp4');
  put('Films', 'Amelie (2001)', 'Images', 'poster.png');
  put('Films', 'Amelie (2001)', 'Images', 'backdrop.png');
  put('Films', 'Amelie (2001)', 'Subtitles', 'English.srt');
  put('Series', 'Tidewater (2018)', 'Season 01', 'S01E01.mkv');
  put('Series', 'Tidewater (2018)', 'Season 01', 'Images', 'poster.png');
  put(
    'Series',
    'Tidewater (2018)',
    'Season 01',
    'Images',
    'Stills',
    'S01E01.jpg'
  );

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(path);
  storage.markScanned([folder.id], SCANNED_AT);

  const heat = storage.addMovie(
    newMovie({
      title: 'Heat',
      year: 1995,
      videoPath: 'Heat (1995)/heat.mkv',
      videoFolderId: folder.id,
      posterPath: 'heat/poster.jpg',
    })
  );
  storage.setSourceFolder(heat.id, folder.id, 'Heat (1995)');

  const amelie = storage.addMovie(
    newMovie({
      title: 'Amelie',
      year: 2001,
      videoPath: 'Films/Amelie (2001)/amelie.mp4',
      videoFolderId: folder.id,
      posterPath: 'amelie/poster.png',
    })
  );
  storage.setSourceFolder(amelie.id, folder.id, 'Films/Amelie (2001)');

  const tidewater = storage.addSeries(
    { title: 'Tidewater', year: 2018, posterPath: 'tidewater/poster.jpg' },
    [
      {
        season: 1,
        number: 1,
        title: 'Pilot',
        videoPath: 'Series/Tidewater (2018)/Season 01/S01E01.mkv',
        videoFolderId: folder.id,
        sourceFile: 'Season 01/S01E01.mkv',
        stillPath: 'tidewater/s1e1.jpg',
      },
    ]
  );
  storage.setSourceFolder(tidewater.id, folder.id, 'Series\\Tidewater (2018)');
  storage.setSeasonPoster(tidewater.id, 1, 'tidewater/season-1.jpg');

  const sheet = createLibrarySheet({ storage });
  return { sheet, folder, path };
}

/** The folder's sheet, after one touch and a flush: its rows. */
async function written() {
  const { sheet, folder, path } = laidOut();
  sheet.touch([folder.id]);
  await sheet.flush();
  const bytes = readFileSync(join(path, LIBRARY_SHEET));
  return readSheet(bytes, 'familyflix-library.csv');
}

describe('createLibrarySheet: a nested film', () => {
  it('writes its own folder name in its Folder cell', async () => {
    const rows = await written();

    expect(
      rows.find((row) => row.type === 'Movie' && row.title === 'Amelie')
    ).toMatchObject({ folder: 'Amelie (2001)' });
  });

  it('starts every path cell with its own folder name', async () => {
    const rows = await written();

    expect(
      rows.find((row) => row.type === 'Movie' && row.title === 'Amelie')
    ).toMatchObject({
      video: 'Amelie (2001)/amelie.mp4',
      poster: 'Amelie (2001)/Images/poster.png',
      backdrop: 'Amelie (2001)/Images/backdrop.png',
      subtitles: ['Amelie (2001)/Subtitles/English.srt'],
    });
  });
});

describe('createLibrarySheet: a nested series stored with a backslash', () => {
  it('writes its own folder name in every row’s Folder cell', async () => {
    const rows = await written();

    expect(
      rows
        .filter((row) => row.type !== 'Movie')
        .map((row) => [row.type, row.folder])
    ).toEqual([
      ['Series', 'Tidewater (2018)'],
      ['Season', 'Tidewater (2018)'],
      ['Episode', 'Tidewater (2018)'],
    ]);
  });

  it('starts its Season poster, Still and video cells with its own folder name', async () => {
    const rows = await written();

    expect(rows.find((row) => row.type === 'Season')).toMatchObject({
      poster: 'Tidewater (2018)/Season 01/Images/poster.png',
    });
    expect(rows.find((row) => row.type === 'Episode')).toMatchObject({
      video: 'Tidewater (2018)/Season 01/S01E01.mkv',
      still: 'Tidewater (2018)/Season 01/Images/Stills/S01E01.jpg',
    });
  });
});

describe('createLibrarySheet: a root-level title beside nested ones', () => {
  it('keeps the cells it always had, while the nested film is flat', async () => {
    const rows = await written();

    expect(
      rows
        .filter((row) => row.type === 'Movie')
        .map((row) => [row.folder, row.video, row.poster])
    ).toEqual([
      [
        'Amelie (2001)',
        'Amelie (2001)/amelie.mp4',
        'Amelie (2001)/Images/poster.png',
      ],
      ['Heat (1995)', 'Heat (1995)/heat.mkv', 'Heat (1995)/Images/poster.jpg'],
    ]);
  });
});
