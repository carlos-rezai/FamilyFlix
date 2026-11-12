// @vitest-environment node
//
// 61, Export round trip, Phase 3 (issue #584): a Doubled place is named.
//
// `readTitleFolder` keeps reading a role's first file by name order and now
// reports each **Layout place** two files or more fill as a **Doubled
// place**, with the file it read and its count: a title's poster and
// backdrop on the folder's own scan, a **Season poster** and the **Stills**
// of one **Episode tag** on their season's. One file per role reports
// nothing. The reader holds no wording; the walk words it.
//
// Against real folders under `sandboxRoot`, as the reader's other suites.

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readTitleFolder, type DoubledPlace } from './readTitleFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A Title folder named `name` holding the files at the relative paths given. */
function titleFolder(name: string, files: string[]): string {
  const dir = join(sandboxRoot('familyflix-doubled-place-'), name);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  return dir;
}

/** A film's scan, checked to be one. */
async function filmIn(dir: string) {
  const scan = await readTitleFolder(dir);
  expect(scan).toMatchObject({ kind: 'film' });
  return scan as Extract<typeof scan, { kind: 'film' }>;
}

/** A series' scan, checked to be one. */
async function seriesIn(dir: string) {
  const scan = await readTitleFolder(dir);
  expect(scan).toMatchObject({ kind: 'series' });
  return scan as Extract<typeof scan, { kind: 'series' }>;
}

/** Each Doubled place with the file it read named by its own name. */
const named = (doubled: DoubledPlace[]) =>
  doubled.map((place) => ({ ...place, read: basename(place.read) }));

describe('readTitleFolder: a film’s Doubled places', () => {
  it('reads the first of two posters by name order and reports both', async () => {
    const dir = titleFolder('Heat (1995)', [
      'Heat.mkv',
      'Images/poster.png',
      'Images/heat-1995-POSTER.png',
    ]);

    const scan = await filmIn(dir);

    expect(basename(scan.poster ?? '')).toBe('heat-1995-POSTER.png');
    expect(named(scan.doubled)).toEqual([
      { place: 'poster', read: 'heat-1995-POSTER.png', count: 2 },
    ]);
  });

  it('reads the first of three backdrops by name order and reports all three', async () => {
    const dir = titleFolder('Heat (1995)', [
      'Heat.mkv',
      'Images/heat-backdrop.png',
      'Images/backdrop.jpg',
      'Images/old-backdrop.jpg',
    ]);

    const scan = await filmIn(dir);

    expect(basename(scan.backdrop ?? '')).toBe('backdrop.jpg');
    expect(named(scan.doubled)).toEqual([
      { place: 'backdrop', read: 'backdrop.jpg', count: 3 },
    ]);
  });

  it('reports nothing for one poster and one backdrop', async () => {
    const dir = titleFolder('Heat (1995)', [
      'Heat.mkv',
      'Images/poster.png',
      'Images/backdrop.jpg',
      'Images/folder.jpg',
    ]);

    const scan = await filmIn(dir);

    expect(scan.doubled).toEqual([]);
  });
});

describe('readTitleFolder: a series’ Doubled places', () => {
  it('reports the series’ own two posters and two backdrops', async () => {
    const dir = titleFolder('Tidewater (2018)', [
      'Season 01/Tidewater.S01E01.mkv',
      'Images/poster.jpg',
      'Images/tidewater-poster.jpg',
      'Images/backdrop.jpg',
      'Images/tidewater-backdrop.jpg',
    ]);

    const scan = await seriesIn(dir);

    expect(basename(scan.poster ?? '')).toBe('poster.jpg');
    expect(basename(scan.backdrop ?? '')).toBe('backdrop.jpg');
    expect(named(scan.doubled)).toEqual(
      expect.arrayContaining([
        { place: 'poster', read: 'poster.jpg', count: 2 },
        { place: 'backdrop', read: 'backdrop.jpg', count: 2 },
      ])
    );
    expect(scan.doubled).toHaveLength(2);
  });

  it('reads the first of two Season posters by name order and reports them on its season', async () => {
    const dir = titleFolder('Tidewater (2018)', [
      'Season 01/Tidewater.S01E01.mkv',
      'Season 01/Images/season-poster.jpg',
      'Season 01/Images/poster.png',
    ]);

    const scan = await seriesIn(dir);

    const [season] = scan.seasons;
    expect(basename(season.poster ?? '')).toBe('poster.png');
    expect(named(season.doubled)).toEqual([
      { place: 'season-poster', season: 1, read: 'poster.png', count: 2 },
    ]);
  });

  it('reads the first of two Stills for one tag by name order and reports them on its season', async () => {
    const dir = titleFolder('Tidewater (2018)', [
      'Season 01/Tidewater.S01E01.mkv',
      'Season 01/Tidewater.S01E02.mkv',
      'Season 01/Images/Stills/S01E01.jpg',
      'Season 01/Images/Stills/tidewater-s01e02.jpg',
      'Season 01/Images/Stills/S01E02.png',
    ]);

    const scan = await seriesIn(dir);

    const [season] = scan.seasons;
    expect(basename(season.stills.S01E02)).toBe('S01E02.png');
    expect(named(season.doubled)).toEqual([
      {
        place: 'still',
        season: 1,
        episode: 2,
        read: 'S01E02.png',
        count: 2,
      },
    ]);
  });

  it('reports nothing for one poster, one backdrop, one Season poster and one Still per tag', async () => {
    const dir = titleFolder('Tidewater (2018)', [
      'Season 01/Tidewater.S01E01.mkv',
      'Season 01/Tidewater.S01E02.mkv',
      'Season 01/Images/poster.jpg',
      'Season 01/Images/Stills/S01E01.jpg',
      'Season 01/Images/Stills/S01E02.jpg',
      'Images/poster.jpg',
      'Images/backdrop.jpg',
    ]);

    const scan = await seriesIn(dir);

    expect(scan.doubled).toEqual([]);
    expect(scan.seasons[0].doubled).toEqual([]);
  });
});
