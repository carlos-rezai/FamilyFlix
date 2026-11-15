// @vitest-environment node
//
// 64, Rescan a folder, Phase 5 (issue #622): a sheet written before this
// change reads back exactly as before.
//
// `spellFolderKey` now takes a `null` year and replaces the reader's own
// `spelledKey`. A sheet from before, its Folder cells spelled `Title (Year)`
// and its season paths under `Season 01/`, reads to the same **Sheet rows**:
// a filled Folder cell as written, a blank one spelled from its Title and
// first year, or the bare title with no year.

import { describe, expect, it } from 'vitest';

import { readSheet } from './readSheet';

const SHEET = [
  'Type,Folder,Season,Episode,Title,Year,Video,Poster,Still',
  'Movie,Heat (1995),,,Heat,1995,Heat (1995)/Heat.mkv,Heat (1995)/Images/poster.jpg,',
  'Movie,,,,Ronin,1998,,,',
  'Movie,,,,Amelie,,,,',
  'Series,Severance (2022),,,Severance,2022–,,Severance (2022)/Images/poster.jpg,',
  'Season,Severance (2022),1,,,,,Severance (2022)/Season 01/Images/poster.jpg,',
  'Episode,Severance (2022),1,1,Good News About Hell,,Severance (2022)/Season 01/Severance S01E01.mkv,,Severance (2022)/Season 01/Images/Stills/S01E01.jpg',
  'Series,,,,Dark,2017–2020,,,',
].join('\n');

const read = () => readSheet(Buffer.from(`${SHEET}\n`, 'utf8'), 'library.csv');

describe('readSheet: a sheet written before #622', () => {
  it('reads each row’s Folder key as before', async () => {
    const rows = await read();

    expect(rows.map((row) => [row.type, row.folder])).toEqual([
      ['Movie', 'Heat (1995)'],
      ['Movie', 'Ronin (1998)'],
      ['Movie', 'Amelie'],
      ['Series', 'Severance (2022)'],
      ['Season', 'Severance (2022)'],
      ['Episode', 'Severance (2022)'],
      ['Series', 'Dark (2017)'],
    ]);
  });

  it('reads its years and its Season 01 path cells as written', async () => {
    const rows = await read();

    expect(rows[0]).toMatchObject({
      year: 1995,
      endYear: 1995,
      video: 'Heat (1995)/Heat.mkv',
      poster: 'Heat (1995)/Images/poster.jpg',
    });
    expect(rows[2]).toMatchObject({ year: null, endYear: null });
    expect(rows[3]).toMatchObject({ year: 2022, endYear: null });
    expect(rows[4]).toMatchObject({
      season: 1,
      poster: 'Severance (2022)/Season 01/Images/poster.jpg',
    });
    expect(rows[5]).toMatchObject({
      season: 1,
      episode: 1,
      video: 'Severance (2022)/Season 01/Severance S01E01.mkv',
      still: 'Severance (2022)/Season 01/Images/Stills/S01E01.jpg',
    });
    expect(rows[6]).toMatchObject({ year: 2017, endYear: 2020 });
  });
});
