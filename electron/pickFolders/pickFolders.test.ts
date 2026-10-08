// @vitest-environment node
//
// Issue #272 — the native picker. `main.ts` answers `familyflix:folders:pick`
// with `dialog.showOpenDialog(window, { title: 'Add library folders',
// properties: ['openDirectory', 'multiSelections'] })`, and `pickFolders` is
// the pure half: the dialog's answer → the paths to post, in the order the
// dialog gave them. A cancelled dialog is `[]`, never an error.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { pickFolders } from './pickFolders';

describe('pickFolders', () => {
  it('gives [] for a cancelled dialog', () => {
    expect(pickFolders({ canceled: true, filePaths: [] })).toEqual([]);
  });

  it('gives [] for a cancelled dialog even if it names paths', () => {
    expect(pickFolders({ canceled: true, filePaths: ['E:\\Movies'] })).toEqual(
      []
    );
  });

  it('gives one pick as a list of one', () => {
    expect(pickFolders({ canceled: false, filePaths: ['E:\\Movies'] })).toEqual(
      ['E:\\Movies']
    );
  });

  it('gives several picks back in the order the dialog gave them', () => {
    expect(
      pickFolders({
        canceled: false,
        filePaths: ['E:\\Movies', 'D:\\Kids', 'F:\\Films'],
      })
    ).toEqual(['E:\\Movies', 'D:\\Kids', 'F:\\Films']);
  });
});

describe('the shell compiles the picker', () => {
  // `electron/**/*.ts` already holds main.ts, preload.ts and pickFolders/; the
  // channel and the bridge's type are shared, so their file must be in the
  // shell's project too, the way `update.ts` is.
  const config = readFileSync(
    fileURLToPath(new URL('../../tsconfig.electron.json', import.meta.url)),
    'utf8'
  );

  it('includes the shell and the shared Library folders types', () => {
    expect(config).toContain('"electron/**/*.ts"');
    expect(config).toContain('"src/types/libraryFolders.ts"');
  });
});
