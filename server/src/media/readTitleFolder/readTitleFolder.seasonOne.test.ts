// @vitest-environment node
//
// 64, Rescan a folder, Phase 2 (issue #619): `Season 1` read.
//
// A **Season folder** is `Season N`, any number of digits, case folded:
// `Season 1/` is season 1, so a yearless `Death Note/` holding it is a series
// keyed `Death Note`, year `null`, its videos in season 1. `Seizoen 1/` is
// still no Season folder.
//
// Against real folders under `sandboxRoot`, as `readTitleFolder.test.ts`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readTitleFolder } from './readTitleFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A Title folder named `name` holding the files at the relative paths given. */
function titleFolder(name: string, files: string[]): string {
  const dir = join(sandboxRoot('familyflix-season-one-folder-'), name);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  return dir;
}

describe('readTitleFolder: a Season 1 folder', () => {
  it('reads a yearless Death Note/ holding Season 1/ as a series in season 1', async () => {
    const dir = titleFolder('Death Note', [
      'Season 1/Death.Note.S01E02.Confrontation.mkv',
      'Season 1/Death.Note.S01E01.Rebirth.mkv',
    ]);

    expect(await readTitleFolder(dir)).toMatchObject({
      kind: 'series',
      dir,
      name: 'Death Note',
      key: { name: 'Death Note', title: 'Death Note', year: null },
      seasons: [
        {
          dir: join(dir, 'Season 1'),
          number: 1,
          videos: [
            join(dir, 'Season 1', 'Death.Note.S01E01.Rebirth.mkv'),
            join(dir, 'Season 1', 'Death.Note.S01E02.Confrontation.mkv'),
          ],
        },
      ],
    });
  });

  it('reads season 1/ and SEASON 2/ by their numbers, case folded', async () => {
    const dir = titleFolder('Death Note', [
      'SEASON 2/Death.Note.S02E01.mkv',
      'season 1/Death.Note.S01E01.mkv',
    ]);

    const scan = await readTitleFolder(dir);

    expect(scan).toMatchObject({ kind: 'series' });
    expect(
      scan.kind === 'series' ? scan.seasons.map((season) => season.number) : []
    ).toEqual([1, 2]);
  });

  it('reads Season 0/ as the specials', async () => {
    const dir = titleFolder('Death Note', [
      'Season 0/Death.Note.S00E01.Relight.mkv',
    ]);

    expect(await readTitleFolder(dir)).toMatchObject({
      kind: 'series',
      seasons: [{ dir: join(dir, 'Season 0'), number: 0 }],
    });
  });

  it('still leaves out a folder holding only Seizoen 1/ as empty', async () => {
    const dir = titleFolder('Death Note', ['Seizoen 1/Death.Note.S01E01.mkv']);

    expect(await readTitleFolder(dir)).toEqual({
      kind: 'left-out',
      dir,
      name: 'Death Note',
      reason: 'empty',
    });
  });
});
