// @vitest-environment node
//
// 58, Folder layout (issue #545): the **Season folder**, read and spelled.
//
// `seasonNumberOf` reads a folder's name as its season by the one table the
// client's mirror and the drift guard read too; `spellSeasonFolder` is its
// counterpart, `Season NN`, and the two round-trip. Prior art: `folderKeyOf`'s
// and `episodeTag`'s spelling cases.

import { describe, expect, it } from 'vitest';

import {
  ALL_SEASON_FOLDER_CASES,
  SEASON_FOLDER_CASES,
} from '../../test-support/seasonFolderCases/seasonFolderCases';
import {
  isSeasonFolder,
  seasonNumberOf,
  spellSeasonFolder,
} from './seasonNumberOf';

describe('seasonNumberOf: the season a folder name says', () => {
  it.each(ALL_SEASON_FOLDER_CASES.map(([name, season]) => [name, season]))(
    'reads %s as %s',
    (name, season) => {
      expect(seasonNumberOf(name)).toBe(season);
    }
  );
});

describe('isSeasonFolder: a Season folder or not', () => {
  it.each(SEASON_FOLDER_CASES.layout.map(([name]) => name))(
    'answers true for %s',
    (name) => {
      expect(isSeasonFolder(name)).toBe(true);
    }
  );

  it.each(SEASON_FOLDER_CASES.wider.map(([name]) => name))(
    'answers false for %s',
    (name) => {
      expect(isSeasonFolder(name)).toBe(false);
    }
  );
});

describe('spellSeasonFolder: the Season NN speller', () => {
  it.each([
    [1, 'Season 01'],
    [0, 'Season 00'],
    [12, 'Season 12'],
    [100, 'Season 100'],
  ])('spells season %i as %s', (season, name) => {
    expect(spellSeasonFolder(season)).toBe(name);
  });

  it.each([0, 1, 9, 10, 100])('round-trips season %i', (season) => {
    expect(seasonNumberOf(spellSeasonFolder(season))).toBe(season);
  });
});
