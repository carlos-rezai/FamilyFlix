// @vitest-environment node
//
// 64, Rescan a folder, Phase 5 (issue #622): the Library sheet, unchanged in
// shape for the household's relaxed names.
//
// A title held from a yearless folder, `Heat/`, has that folder's own name in
// its `Folder` cell and a blank `Year` until a **Sync** fills it. A show held
// from `Death Note/Season 1/` has path cells naming `Death Note/Season 1/...`,
// as its **Layout read** of disk finds them.
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

/** One Library folder holding `Heat/` and `Death Note/Season 1/`. */
function laidOut() {
  const root = sandboxRoot('familyflix-library-sheet-yearless-');
  const path = join(root, 'Movies');
  const put = (...parts: string[]): void => {
    const file = join(path, ...parts);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, parts.join('/'));
  };
  put('Heat', 'heat.mkv');
  put('Heat', 'Images', 'poster.jpg');
  put('Death Note', 'Season 1', 'Death Note 01.mkv');
  put('Death Note', 'Season 1', 'Images', 'poster.png');
  put('Death Note', 'Season 1', 'Images', 'Stills', 'S01E01.jpg');
  put('Death Note', 'Season 1', 'Subtitles', 'S01E01', 'English.srt');

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(path);
  storage.markScanned([folder.id], SCANNED_AT);

  const heat = storage.addMovie(
    newMovie({
      title: 'Heat',
      videoPath: 'Heat/heat.mkv',
      videoFolderId: folder.id,
      posterPath: 'heat/poster.jpg',
    })
  );
  storage.setSourceFolder(heat.id, folder.id, 'Heat');

  const deathNote = storage.addSeries(
    { title: 'Death Note', posterPath: 'death-note/poster.jpg' },
    [
      {
        season: 1,
        number: 1,
        title: 'Rebirth',
        videoPath: 'Death Note/Season 1/Death Note 01.mkv',
        videoFolderId: folder.id,
        sourceFile: 'Season 1/Death Note 01.mkv',
        stillPath: 'death-note/s1e1.jpg',
      },
    ]
  );
  storage.setSourceFolder(deathNote.id, folder.id, 'Death Note');
  storage.setSeasonPoster(deathNote.id, 1, 'death-note/season-1.jpg');

  const sheet = createLibrarySheet({ storage });
  return { sheet, folder, path };
}

/** The folder's sheet, after one touch and a flush: its text and its rows. */
async function written() {
  const { sheet, folder, path } = laidOut();
  sheet.touch([folder.id]);
  await sheet.flush();
  const bytes = readFileSync(join(path, LIBRARY_SHEET));
  return {
    text: bytes.toString('utf8'),
    rows: await readSheet(bytes, 'familyflix-library.csv'),
  };
}

describe('createLibrarySheet: a yearless Title folder', () => {
  it('writes the folder’s own name in its Folder cell, never Heat ()', async () => {
    const { text, rows } = await written();

    expect(rows.find((row) => row.type === 'Movie')).toMatchObject({
      folder: 'Heat',
      title: 'Heat',
    });
    expect(text).not.toContain('Heat ()');
  });

  it('leaves its Year blank until a Sync fills it', async () => {
    const { rows } = await written();

    expect(rows.find((row) => row.type === 'Movie')).toMatchObject({
      year: null,
      endYear: null,
    });
    expect(rows.find((row) => row.type === 'Series')).toMatchObject({
      folder: 'Death Note',
      year: null,
    });
  });
});

describe('createLibrarySheet: a Season 1 show', () => {
  it('names Death Note/Season 1/... in its path cells', async () => {
    const { rows } = await written();

    expect(rows.find((row) => row.type === 'Season')).toMatchObject({
      poster: 'Death Note/Season 1/Images/poster.png',
    });
    expect(rows.find((row) => row.type === 'Episode')).toMatchObject({
      video: 'Death Note/Season 1/Death Note 01.mkv',
      still: 'Death Note/Season 1/Images/Stills/S01E01.jpg',
      subtitles: ['Death Note/Season 1/Subtitles/S01E01/English.srt'],
    });
  });
});
