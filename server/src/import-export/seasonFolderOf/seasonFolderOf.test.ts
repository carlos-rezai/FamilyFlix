// 64, Rescan a folder, Phase 4 (issue #621): the Season folder name.
//
// `seasonFolderOf(sourceFiles, season)` answers the **Season folder** a
// show's season lies in: the first path segment of its held episodes'
// **Source files**, the first one that has a folder, in episode order, and
// `spellSeasonFolder(season)` when none is recorded. It reads no disk.

import { describe, expect, it } from 'vitest';

import { seasonFolderOf } from './seasonFolderOf';

describe('seasonFolderOf: the folder the episodes lie in', () => {
  it('answers the first episode’s folder', () => {
    expect(
      seasonFolderOf(
        ['Season 1/Death.Note.S01E01.mkv', 'Season 1/Death.Note.S01E02.mkv'],
        1
      )
    ).toBe('Season 1');
  });

  it('answers a later episode’s folder when the first has none recorded', () => {
    expect(seasonFolderOf([null, null, 'season 3/Show.S03E03.mkv'], 3)).toBe(
      'season 3'
    );
  });

  it('skips a Source file with no folder segment', () => {
    expect(
      seasonFolderOf(['Show.S01E01.mkv', 'Season 1/Show.S01E02.mkv'], 1)
    ).toBe('Season 1');
  });
});

describe('seasonFolderOf: no folder recorded', () => {
  it('spells Season 01 when no Source file is recorded', () => {
    expect(seasonFolderOf([null, null], 1)).toBe('Season 01');
  });

  it('spells Season 01 for a season with no episodes', () => {
    expect(seasonFolderOf([], 1)).toBe('Season 01');
  });

  it('spells Season 02 when no episode lies in a folder', () => {
    expect(seasonFolderOf(['Show.S02E01.mkv', null], 2)).toBe('Season 02');
  });
});
