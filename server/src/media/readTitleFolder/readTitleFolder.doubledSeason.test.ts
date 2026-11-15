// @vitest-environment node
//
// 64, Rescan a folder, Phase 3 (issue #620): the doubled season.
//
// A show holding two **Season folders** for one number (`Season 01/` and
// `Season 1/`) reads the first by name order and reports the other as a
// `season` **Doubled place**, never merging them.
//
// Against real folders under `sandboxRoot`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readTitleFolder } from './readTitleFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A Title folder named `name` holding the files at the relative paths given. */
function titleFolder(name: string, files: string[]): string {
  const dir = join(sandboxRoot('familyflix-doubled-season-'), name);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  return dir;
}

describe('readTitleFolder: a doubled season', () => {
  it('reads Season 01 only, beside Season 1, and reports a season Doubled place', async () => {
    const dir = titleFolder('Death Note', [
      'Season 1/Death.Note.S01E01.mkv',
      'Season 01/Death.Note.S01E01.Rebirth.mkv',
      'Season 01/Death.Note.S01E02.Confrontation.mkv',
    ]);

    const scan = await readTitleFolder(dir);

    expect(scan.kind).toBe('series');
    if (scan.kind !== 'series') return;
    expect(scan.seasons.map((season) => [season.number, season.dir])).toEqual([
      [1, join(dir, 'Season 01')],
    ]);
    expect(scan.doubled).toContainEqual({
      place: 'season',
      season: 1,
      read: join(dir, 'Season 01'),
      count: 2,
    });
  });

  it('reads the Season folder holding videos over an earlier one holding none', async () => {
    const dir = titleFolder('Death Note', [
      'Season 01/Images/poster.jpg',
      'Season 1/Death.Note.S01E01.mkv',
    ]);

    const scan = await readTitleFolder(dir);

    expect(scan.kind).toBe('series');
    if (scan.kind !== 'series') return;
    expect(scan.seasons.map((season) => [season.number, season.dir])).toEqual([
      [1, join(dir, 'Season 1')],
    ]);
    expect(scan.doubled).toContainEqual({
      place: 'season',
      season: 1,
      read: join(dir, 'Season 1'),
      count: 2,
    });
  });

  it('numbers no two videos as one episode', async () => {
    const dir = titleFolder('Death Note', [
      'Season 1/Death.Note.S01E01.mkv',
      'Season 01/Death.Note.S01E01.Rebirth.mkv',
    ]);

    const scan = await readTitleFolder(dir);

    expect(scan.kind).toBe('series');
    if (scan.kind !== 'series') return;
    expect(scan.seasons.flatMap((season) => season.videos)).toEqual([
      join(dir, 'Season 01', 'Death.Note.S01E01.Rebirth.mkv'),
    ]);
  });
});
