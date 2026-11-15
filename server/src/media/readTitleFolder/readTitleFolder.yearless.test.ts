// @vitest-environment node
//
// 64, Rescan a folder, Phase 1 (issue #618): a yearless Title folder read.
//
// The `no-key` **Left-out reason** is retired: every folder in the root has a
// **Folder key**, so `Heat` holding one video reads as a film keyed `Heat`,
// year `null`. A folder is left out only as `empty` (neither a loose video nor
// a Season folder, a genre shelf among them) or `mixed` (both).
//
// Against real folders under `sandboxRoot`, as `readTitleFolder.test.ts`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readTitleFolder } from './readTitleFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A Title folder named `name` holding the files at the relative paths given. */
function titleFolder(name: string, files: string[]): string {
  const dir = join(sandboxRoot('familyflix-yearless-folder-'), name);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  return dir;
}

describe('readTitleFolder: a yearless Title folder', () => {
  it('reads Heat/ holding one video as a film keyed Heat, year null', async () => {
    const dir = titleFolder('Heat', ['heat.mkv']);

    expect(await readTitleFolder(dir)).toMatchObject({
      kind: 'film',
      dir,
      name: 'Heat',
      key: { name: 'Heat', title: 'Heat', year: null },
      videos: [join(dir, 'heat.mkv')],
    });
  });

  it('reads a name with a suffix after its year as a film, keyed verbatim', async () => {
    const dir = titleFolder('Heat (1995) [1080p]', ['heat.mkv']);

    expect(await readTitleFolder(dir)).toMatchObject({
      kind: 'film',
      key: { title: 'Heat (1995) [1080p]', year: null },
    });
  });

  it('reads a yearless series by its Season folders', async () => {
    const dir = titleFolder('Death Note', ['Season 01/Death.Note.S01E01.mkv']);

    expect(await readTitleFolder(dir)).toMatchObject({
      kind: 'series',
      name: 'Death Note',
      key: { title: 'Death Note', year: null },
    });
  });
});

describe('readTitleFolder: no folder is left out as no-key', () => {
  it('leaves out a genre shelf of Title folders as empty', async () => {
    const dir = titleFolder('Drama', ['Heat (1995)/heat.mkv']);

    expect(await readTitleFolder(dir)).toEqual({
      kind: 'left-out',
      dir,
      name: 'Drama',
      reason: 'empty',
    });
  });

  it('leaves out a yearless folder of loose videos and Season folders as mixed', async () => {
    const dir = titleFolder('Severance', [
      'Severance.S01E01.mkv',
      'Season 01/Severance.S01E02.mkv',
    ]);

    expect(await readTitleFolder(dir)).toEqual({
      kind: 'left-out',
      dir,
      name: 'Severance',
      reason: 'mixed',
    });
  });
});
