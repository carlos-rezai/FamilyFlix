// @vitest-environment node
//
// 60, Rebuild edges, Phase 6 (issue #569): a sheet that doesn't read is left
// alone.
//
// The **Library sheet writer** never replaces a sheet on disk that the
// **Sheet reader** refuses: it is left until it reads or the maintainer
// removes it, as a **New folder**'s sheet is (log 60, Q7). The next touch
// after it is fixed, or removed, writes it.
//
// Real in-memory SQLite, a real temporary Library folder, the sheet read back
// as bytes; only `setTimeout` is faked.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SHEET_COLUMNS } from '@/types';
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

/**
 * A sheet the Sheet reader refuses: a half-written workbook saved under the
 * CSV's name, its header holding no title column.
 */
const CORRUPT = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]),
  Buffer.from('\u0000\u0001garbled;bytes\r\n\u0002\u0003', 'latin1'),
]);

/** A Library folder holding Die Hard, scanned, the writer over it. */
function world() {
  const root = join(sandboxRoot('familyflix-sheet-unreadable-'), 'Movies');
  mkdirSync(join(root, 'Die Hard (1988)'), { recursive: true });
  writeFileSync(join(root, 'Die Hard (1988)', 'Die Hard.mkv'), 'a film');

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(root);
  storage.markScanned([folder.id], '2026-01-01T00:00:00.000Z');

  const dieHard = storage.addMovie(
    newMovie({
      title: 'Die Hard',
      year: 1988,
      videoPath: 'Die Hard (1988)/Die Hard.mkv',
      videoFolderId: folder.id,
    })
  );
  storage.setSourceFolder(dieHard.id, folder.id, 'Die Hard (1988)');

  const sheet = createLibrarySheet({ storage });
  return { root, storage, folder, dieHard, sheet };
}

const sheetOf = (root: string): string => join(root, LIBRARY_SHEET);

/** Put the corrupt sheet in the folder's `Meta/`, checking the reader refuses it. */
async function placeCorrupt(root: string): Promise<void> {
  await expect(readSheet(CORRUPT, 'familyflix-library.csv')).rejects.toThrow();
  mkdirSync(join(root, 'Meta'), { recursive: true });
  writeFileSync(sheetOf(root), CORRUPT);
}

/** The titles the sheet on disk holds, read through the Sheet reader. */
async function titlesOnDisk(root: string): Promise<string[]> {
  const rows = await readSheet(
    readFileSync(sheetOf(root)),
    'familyflix-library.csv'
  );
  return rows.map((row) => row.title);
}

describe('createLibrarySheet: a sheet that does not read is left alone', () => {
  it('leaves a corrupt sheet byte for byte after a rating change, a touch and a flush', async () => {
    const { root, storage, folder, dieHard, sheet } = world();
    await placeCorrupt(root);

    storage.setRating(dieHard.id, 8);
    sheet.touch([folder.id]);
    await sheet.flush();

    expect(readFileSync(sheetOf(root)).equals(CORRUPT)).toBe(true);
  });

  it('writes the sheet on the next touch once the maintainer has fixed it', async () => {
    const { root, storage, folder, dieHard, sheet } = world();
    await placeCorrupt(root);
    storage.setRating(dieHard.id, 8);
    sheet.touch([folder.id]);
    await sheet.flush();
    expect(readFileSync(sheetOf(root)).equals(CORRUPT)).toBe(true);

    writeFileSync(sheetOf(root), `${SHEET_COLUMNS.join(',')}\r\n`);
    storage.setRating(dieHard.id, 9);
    sheet.touch([folder.id]);
    await sheet.flush();

    expect(await titlesOnDisk(root)).toContain('Die Hard');
  });

  it('writes the sheet on the next touch once the maintainer has removed it', async () => {
    const { root, storage, folder, dieHard, sheet } = world();
    await placeCorrupt(root);
    storage.setRating(dieHard.id, 8);
    sheet.touch([folder.id]);
    await sheet.flush();
    expect(readFileSync(sheetOf(root)).equals(CORRUPT)).toBe(true);

    rmSync(sheetOf(root));
    storage.setRating(dieHard.id, 9);
    sheet.touch([folder.id]);
    await sheet.flush();

    expect(await titlesOnDisk(root)).toContain('Die Hard');
  });
});
