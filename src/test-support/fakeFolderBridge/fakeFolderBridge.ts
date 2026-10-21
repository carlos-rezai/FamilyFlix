import { afterEach, beforeEach } from 'vitest';

import type { FolderBridge } from '@/types/libraryFolders';

/**
 * A controllable `window.familyflix.folders` — the native folder picker the
 * **Desktop shell**'s preload defines and a browser does not have.
 *
 * Call this inside the `describe` that needs it, and for the length of that
 * block the global is installed: each `pick()` answers what `setPick` last
 * set (`[]` by default — a cancelled dialog), each `pickOne()` what
 * `setPickOne` last set and each `pickSheet()` what `setPickSheet` did
 * (`null` by default — a cancelled dialog), each
 * `openMedia()` resolves at once, and all three are counted. Each
 * `pathOf(file)` — the **Path bridge** — answers what `setPathOf` set for
 * that file's name, `''` (a file with no path) when nothing was. After the block
 * the global is deleted, so every later file in the worker is a browser
 * again. `fakeUpdateBridge`'s twin.
 */
export function fakeFolderBridge() {
  let answer: string[] = [];
  let oneAnswer: string | null = null;
  let sheetAnswer: string | null = null;
  let picks = 0;
  let pickOnes = 0;
  let pickSheets = 0;
  let openMedias = 0;
  let paths = new Map<string, string>();

  const folders: FolderBridge = {
    pick() {
      picks += 1;
      return Promise.resolve([...answer]);
    },
    pickOne() {
      pickOnes += 1;
      return Promise.resolve(oneAnswer);
    },
    pickSheet() {
      pickSheets += 1;
      return Promise.resolve(sheetAnswer);
    },
    openMedia() {
      openMedias += 1;
      return Promise.resolve();
    },
    pathOf(file: File) {
      return paths.get(file.name) ?? '';
    },
  };

  beforeEach(() => {
    answer = [];
    oneAnswer = null;
    sheetAnswer = null;
    picks = 0;
    pickOnes = 0;
    pickSheets = 0;
    openMedias = 0;
    paths = new Map();
    window.familyflix = { ...window.familyflix, folders } as NonNullable<
      Window['familyflix']
    >;
  });

  afterEach(() => {
    delete window.familyflix;
  });

  return {
    /** The bridge itself, as `window.familyflix.folders` holds it. */
    folders,
    /** What the next `pick()` answers: the paths picked, `[]` a cancel. */
    setPick(paths: string[]): void {
      answer = paths;
    },
    /** What the next `pickOne()` answers: the folder picked, `null` a cancel. */
    setPickOne(path: string | null): void {
      oneAnswer = path;
    },
    /** What the next `pickSheet()` answers: the file picked, `null` a cancel. */
    setPickSheet(path: string | null): void {
      sheetAnswer = path;
    },
    /** What `pathOf` answers for a file named `name`: its absolute path. */
    setPathOf(name: string, path: string): void {
      paths.set(name, path);
    },
    /** How many times the many-folder dialog was opened. */
    picks: (): number => picks,
    /** How many times the one-folder dialog was opened. */
    pickOnes: (): number => pickOnes,
    /** How many times the spreadsheet dialog was opened. */
    pickSheets: (): number => pickSheets,
    /** How many times the managed media directory was asked to open. */
    openMedias: (): number => openMedias,
  };
}
