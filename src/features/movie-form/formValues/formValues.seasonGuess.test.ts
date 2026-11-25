import { describe, it, expect } from 'vitest';

import type { ShowFolderRead } from '@/types';
import { showFolderRows } from './formValues';

/**
 * 51, Library audit, Phase 14 (issue #457): episodes numbered by their
 * season. A picked video in a **Season folder** is numbered from that
 * folder's season, read by `readSeasonFolder` over its path inside
 * the **Show folder** (its `relativePath`), so a season-2 video never lands
 * as S1 E3. The **Numbering guess** starts each season's free numbers from
 * that season, and a video with an **Episode tag** keeps its tagged number.
 *
 * The pick here is a Season folder itself, `Season 02`: its videos lie at the
 * root of the folder read, so only their relative paths
 * (`Season 02/<name>`) name their season.
 */

const SHOW = 'E:\\Series\\De Veerboot';
const PICKED = `${SHOW}\\Season 02`;

/** A read of the picked `Season 02`, its videos relative to the show. */
const seasonTwoRead = (
  unplaced: string[],
  episodes: ShowFolderRead['episodes'] = []
): ShowFolderRead => ({
  path: PICKED,
  title: 'De Veerboot',
  year: null,
  libraryFolderId: 'shows',
  heldSeriesId: null,
  poster: null,
  backdrop: null,
  episodes,
  unplaced: unplaced.map((name) => ({
    video: `${PICKED}\\${name}`,
    relativePath: `Season 02/${name}`,
  })),
  straySubtitles: 0,
});

/** The rows as `[relative path, season, number]`. */
const numbered = (read: ShowFolderRead) =>
  showFolderRows(read).map((row) => [
    row.file?.kind === 'found' ? row.file.filename : null,
    row.season,
    row.number,
  ]);

describe('showFolderRows: episodes numbered by their season', () => {
  it('lands a video under Season 02 in season 2', () => {
    expect(numbered(seasonTwoRead(['de_overtocht.mkv']))).toEqual([
      ['Season 02/de_overtocht.mkv', '2', '1'],
    ]);
  });

  it('numbers free episodes from 1 in their own season, never after season 1', () => {
    const read = seasonTwoRead(
      ['de_mist.mkv', 'de_overtocht.mkv', 'het_anker.mkv'],
      [
        {
          season: 2,
          number: 2,
          title: null,
          video: `${PICKED}\\De.Veerboot.S02E02.mkv`,
          relativePath: 'Season 02/De.Veerboot.S02E02.mkv',
          subtitles: [],
        },
      ]
    );

    expect(numbered(read)).toEqual([
      ['Season 02/De.Veerboot.S02E02.mkv', '2', '2'],
      // Season 2's free numbers: 1, then past the numbered 2, 3 and 4.
      ['Season 02/de_mist.mkv', '2', '1'],
      ['Season 02/de_overtocht.mkv', '2', '3'],
      ['Season 02/het_anker.mkv', '2', '4'],
    ]);
  });

  it('keeps an Episode word’s number, under the folder’s season', () => {
    expect(
      numbered(seasonTwoRead(['de_mist.mkv', 'De Veerboot Aflevering 1.mkv']))
    ).toEqual([
      // `Aflevering 1` takes 1, so the untagged video takes the next free.
      ['Season 02/de_mist.mkv', '2', '2'],
      ['Season 02/De Veerboot Aflevering 1.mkv', '2', '1'],
    ]);
  });
});

/**
 * 64, Rescan a folder, Phase 2 (issue #619): `Season N` read. A **Season
 * folder** is `Season N`, any number of digits, case folded, so a pick of the
 * show `Death Note` numbers a video under `Season 1` in season 1 and one under
 * `Season 2` in season 2; `Season 0` is the specials. One read holds all
 * three, so a reader that only falls back to season 1 still fails.
 */
describe('showFolderRows: a Season N folder', () => {
  const DEATH_NOTE = 'E:\\Series\\Death Note';

  /** A read of the picked `Death Note`, its videos at the paths given. */
  const deathNoteRead = (inside: string[]): ShowFolderRead => ({
    path: DEATH_NOTE,
    title: 'Death Note',
    year: null,
    libraryFolderId: 'shows',
    heldSeriesId: null,
    poster: null,
    backdrop: null,
    episodes: [],
    unplaced: inside.map((relativePath) => ({
      video: `${DEATH_NOTE}\\${relativePath.split('/').join('\\')}`,
      relativePath,
    })),
    straySubtitles: 0,
  });

  it('says season 1 off Season 1, season 2 off Season 2, 0 off Season 0', () => {
    expect(
      numbered(
        deathNoteRead([
          'Season 1/rebirth.mkv',
          'Season 2/succession.mkv',
          'Season 0/relight.mkv',
        ])
      )
        .map(([filename, season]) => [filename, season])
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
    ).toEqual([
      ['Season 0/relight.mkv', '0'],
      ['Season 1/rebirth.mkv', '1'],
      ['Season 2/succession.mkv', '2'],
    ]);
  });
});
