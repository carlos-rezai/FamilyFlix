// @vitest-environment node
//
// 48 — Add a show folder, refactor (issue #421): where a found show lies;
// narrowed by 58, Folder layout, Phase 3: "one series in the layout" (issue
// #536).
//
// `placeShowFolder(folders, video)` answers where a found episode video lies
// in the **Folder layout**: its series' **Title folder**, the parent of the
// `Season NN` folder holding it, placed under its listed **Library folder** as
// the folder's id and the **Folder key**, and the episode's **Source file**,
// its path inside the Title folder with forward slashes. A video in no Season
// folder, a loose tagged one at a show's root included, or under no listed
// folder answers `null`.
//
// Pure over paths under a fixed root; nothing touches the disk.

import { join, parse } from 'node:path';
import { describe, expect, it } from 'vitest';

import { placeShowFolder } from './placeShowFolder';
import type { StoredLibraryFolder } from '../../library';

const root = join(parse(process.cwd()).root, 'familyflix-place-show');

const shows: StoredLibraryFolder = {
  id: 'shows',
  path: join(root, 'Shows'),
  titleCount: 0,
  scannedAt: null,
};

describe('placeShowFolder', () => {
  it('places an episode at its Title folder, its Source file Season NN/<video>', () => {
    const video = join(
      root,
      'Shows',
      'Harbor & Vine (2021)',
      'Season 02',
      'Harbor.and.Vine.S02E01.mkv'
    );

    expect(placeShowFolder([shows], video)).toEqual({
      folderId: 'shows',
      sourceFolder: 'Harbor & Vine (2021)',
      sourceFile: 'Season 02/Harbor.and.Vine.S02E01.mkv',
    });
  });

  it('places a specials episode at Season 00/<video>', () => {
    const video = join(
      root,
      'Shows',
      'Harbor & Vine (2021)',
      'Season 00',
      'Christmas.mkv'
    );

    expect(placeShowFolder([shows], video)).toMatchObject({
      sourceFolder: 'Harbor & Vine (2021)',
      sourceFile: 'Season 00/Christmas.mkv',
    });
  });

  it('answers null for a loose tagged video at a show’s root', () => {
    const video = join(
      root,
      'Shows',
      'Harbor & Vine (2021)',
      'Harbor.and.Vine.S01E01.Pilot.mkv'
    );

    expect(placeShowFolder([shows], video)).toBeNull();
  });

  it.each([['Season 1'], ['Seizoen 1'], ['S01'], ['Specials']])(
    'answers null for a video in a folder named %s',
    (season) => {
      const video = join(
        root,
        'Shows',
        'Harbor & Vine (2021)',
        season,
        'e.mkv'
      );

      expect(placeShowFolder([shows], video)).toBeNull();
    }
  );

  it('answers null for a show folder not named Title (Year)', () => {
    const video = join(root, 'Shows', 'Harbor & Vine', 'Season 01', 'e.mkv');

    expect(placeShowFolder([shows], video)).toBeNull();
  });

  it('answers null for a Title folder deeper than the root', () => {
    const video = join(
      root,
      'Shows',
      'Drama',
      'Harbor & Vine (2021)',
      'Season 01',
      'e.mkv'
    );

    expect(placeShowFolder([shows], video)).toBeNull();
  });

  it('answers null for a show under no listed folder', () => {
    const video = join(
      root,
      'Downloads',
      'Harbor & Vine (2021)',
      'Season 01',
      'e.mkv'
    );

    expect(placeShowFolder([shows], video)).toBeNull();
  });
});
