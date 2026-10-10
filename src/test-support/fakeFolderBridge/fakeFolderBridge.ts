import { afterEach, beforeEach } from 'vitest';

import type { FolderBridge } from '@/types/libraryFolders';

/**
 * A controllable `window.familyflix.folders` — the native folder picker the
 * **Desktop shell**'s preload defines and a browser does not have.
 *
 * Call this inside the `describe` that needs it, and for the length of that
 * block the global is installed: each `pick()` answers what `setPick` last
 * set (`[]` by default — a cancelled dialog), each `pickOne()` what
 * `setPickOne` last set (`null` by default — a cancelled dialog), each
 * `openMedia()` resolves at once, and all three are counted. After the block
 * the global is deleted, so every later file in the worker is a browser again. `fakeUpdateBridge`'s twin.
 */
export function fakeFolderBridge() {
  let answer: string[] = [];
  let oneAnswer: string | null = null;
  let picks = 0;
  let pickOnes = 0;
  let openMedias = 0;

  const folders: FolderBridge = {
    pick() {
      picks += 1;
      return Promise.resolve([...answer]);
    },
    pickOne() {
      pickOnes += 1;
      return Promise.resolve(oneAnswer);
    },
    openMedia() {
      openMedias += 1;
      return Promise.resolve();
    },
  };

  beforeEach(() => {
    answer = [];
    oneAnswer = null;
    picks = 0;
    pickOnes = 0;
    openMedias = 0;
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
    /** How many times the many-folder dialog was opened. */
    picks: (): number => picks,
    /** How many times the one-folder dialog was opened. */
    pickOnes: (): number => pickOnes,
    /** How many times the managed media directory was asked to open. */
    openMedias: (): number => openMedias,
  };
}
