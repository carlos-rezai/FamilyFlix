// @vitest-environment node
//
// 74, Sheet in sight, Phase 2 (issue #702): the **Meta move**.
//
// Before a write reads the sheet on disk, the **Library sheet writer** settles
// which folder it writes in. An **Old Meta folder** (`Meta/`) with no `_meta`
// beside it is renamed whole to `_meta/`, once, whether or not a cell
// changed; a refused rename (the sheet open in Excel) writes in `Meta/` this
// time and tries the move again at the next write. With both present, `Meta/`
// is left alone and `_meta/` is written. A folder the writer skips (unlisted,
// unscanned, unreachable) is neither moved nor written.
//
// Real in-memory SQLite, a real temporary Library folder, the sheet read back
// as bytes; `setTimeout` is faked, and `node:fs/promises` is wrapped only to
// refuse the move's rename and to hide a folder from the reach check.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SHEET_COLUMNS } from '@/types';
import {
  LIBRARY_SHEET_STEM,
  META_FOLDER,
  OLD_META_FOLDER,
} from '../../media/folderLayout/folderLayout';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { readSheet } from '../readSheet/readSheet';
import { createLibrarySheet } from './createLibrarySheet';

/** Whether a rename onto a `_meta` folder is refused, as Excel holding the sheet does. */
let refuseMove = false;

/** Folders the reach check finds nothing at, though they lie on disk. */
const unreachable = new Set<string>();

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const rename: typeof actual.rename = async (from, to) => {
    if (refuseMove && basename(String(to)) === '_meta') {
      throw Object.assign(
        new Error(`EBUSY: resource busy or locked, rename '${String(from)}'`),
        { code: 'EBUSY' }
      );
    }
    return actual.rename(from, to);
  };
  const stat = (async (path: Parameters<typeof actual.stat>[0]) => {
    if (unreachable.has(resolve(String(path)))) {
      throw Object.assign(
        new Error(`ENOENT: no such file or directory, stat '${String(path)}'`),
        { code: 'ENOENT' }
      );
    }
    return actual.stat(path);
  }) as typeof actual.stat;
  const wrapped = { ...actual, rename, stat };
  return { ...wrapped, default: wrapped };
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  refuseMove = false;
  unreachable.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const SHEET_NAME = `${LIBRARY_SHEET_STEM}.csv`;
const WORKBOOK_NAME = `${LIBRARY_SHEET_STEM}.xlsx`;
const WORKBOOK = Buffer.from('a workbook the maintainer saved');
const HEADER_ONLY = Buffer.from(`${SHEET_COLUMNS.join(',')}\r\n`);

const newMeta = (root: string): string => join(root, META_FOLDER);
const oldMeta = (root: string): string => join(root, OLD_META_FOLDER);

/** A Library folder holding Die Hard, scanned, the writer over it. */
function world() {
  const root = join(sandboxRoot('familyflix-sheet-meta-move-'), 'Movies');
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

/** An Old Meta folder in `root`: a header-only sheet and a workbook beside it. */
function placeOldMeta(root: string): void {
  mkdirSync(oldMeta(root), { recursive: true });
  writeFileSync(join(oldMeta(root), SHEET_NAME), HEADER_ONLY);
  writeFileSync(join(oldMeta(root), WORKBOOK_NAME), WORKBOOK);
}

/** The titles of the sheet in `metaFolder`, read through the Sheet reader. */
async function titlesIn(metaFolder: string): Promise<string[]> {
  const rows = await readSheet(
    readFileSync(join(metaFolder, SHEET_NAME)),
    SHEET_NAME
  );
  return rows.map((row) => row.title);
}

describe('createLibrarySheet: the Meta move', () => {
  it('moves a held Meta/ whole to _meta/, its workbook too, and writes the sheet in _meta/', async () => {
    const { root, storage, folder, dieHard, sheet } = world();
    placeOldMeta(root);

    storage.setRating(dieHard.id, 8);
    sheet.touch([folder.id]);
    await sheet.flush();

    expect(existsSync(oldMeta(root))).toBe(false);
    expect(
      readFileSync(join(newMeta(root), WORKBOOK_NAME)).equals(WORKBOOK)
    ).toBe(true);
    expect(await titlesIn(newMeta(root))).toEqual(['Die Hard']);
  });

  it('moves the folder even when the sheet bytes would not change', async () => {
    const { root, folder, sheet } = world();
    sheet.touch([folder.id]);
    await sheet.flush();
    const written = readFileSync(join(newMeta(root), SHEET_NAME));
    renameSync(newMeta(root), oldMeta(root));

    sheet.touch([folder.id]);
    await sheet.flush();

    expect(existsSync(oldMeta(root))).toBe(false);
    expect(readFileSync(join(newMeta(root), SHEET_NAME)).equals(written)).toBe(
      true
    );
  });

  it('leaves Meta/ untouched and writes _meta/ when both are present, with no warning', async () => {
    const { root, storage, folder, dieHard, sheet } = world();
    placeOldMeta(root);
    mkdirSync(newMeta(root), { recursive: true });
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');

    storage.setRating(dieHard.id, 8);
    sheet.touch([folder.id]);
    await sheet.flush();

    expect(
      readFileSync(join(oldMeta(root), SHEET_NAME)).equals(HEADER_ONLY)
    ).toBe(true);
    expect(
      readFileSync(join(oldMeta(root), WORKBOOK_NAME)).equals(WORKBOOK)
    ).toBe(true);
    expect(await titlesIn(newMeta(root))).toEqual(['Die Hard']);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('writes in Meta/ when the move is refused, leaving no _meta/ sheet, and moves at the next write', async () => {
    const { root, storage, folder, dieHard, sheet } = world();
    placeOldMeta(root);
    refuseMove = true;

    storage.setRating(dieHard.id, 8);
    sheet.touch([folder.id]);
    await sheet.flush();

    expect(await titlesIn(oldMeta(root))).toEqual(['Die Hard']);
    expect(existsSync(join(newMeta(root), SHEET_NAME))).toBe(false);

    refuseMove = false;
    storage.setRating(dieHard.id, 9);
    sheet.touch([folder.id]);
    await sheet.flush();

    expect(existsSync(oldMeta(root))).toBe(false);
    expect(await titlesIn(newMeta(root))).toEqual(['Die Hard']);
    expect(
      readFileSync(join(newMeta(root), WORKBOOK_NAME)).equals(WORKBOOK)
    ).toBe(true);
  });
});

describe('createLibrarySheet: a skipped folder keeps its Meta/', () => {
  /** Meta/ still holds exactly what was placed, and no _meta/ was made. */
  function expectUntouched(root: string): void {
    expect(
      readFileSync(join(oldMeta(root), SHEET_NAME)).equals(HEADER_ONLY)
    ).toBe(true);
    expect(
      readFileSync(join(oldMeta(root), WORKBOOK_NAME)).equals(WORKBOOK)
    ).toBe(true);
    expect(existsSync(newMeta(root))).toBe(false);
  }

  it('neither moves nor writes an unlisted folder', async () => {
    const { root, storage, sheet } = world();
    const path = join(root, 'Removed');
    placeOldMeta(path);
    const folder = storage.addLibraryFolder(path);
    storage.markScanned([folder.id], '2026-01-01T00:00:00.000Z');
    expect(storage.removeLibraryFolder(folder.id)).toEqual({ kind: 'removed' });

    sheet.touch([folder.id]);
    await sheet.flush();

    expectUntouched(path);
  });

  it('neither moves nor writes an unscanned folder', async () => {
    const { root, storage, sheet } = world();
    const path = join(root, 'Added back');
    mkdirSync(join(path, 'Alien (1979)'), { recursive: true });
    placeOldMeta(path);
    const folder = storage.addLibraryFolder(path);
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
    await sheet.flush();

    expectUntouched(path);
  });

  it('neither moves nor writes an unreachable folder', async () => {
    const { root, storage, folder, dieHard, sheet } = world();
    placeOldMeta(root);
    unreachable.add(resolve(root));

    storage.setRating(dieHard.id, 8);
    sheet.touch([folder.id]);
    await sheet.flush();

    expectUntouched(root);
  });
});
