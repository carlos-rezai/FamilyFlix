// @vitest-environment node
//
// 68, Resolve cells (issue #650): a row with no Title folder.
//
// `rowCellFiles` reads a `no-folder` row's **Path cells** under the run's
// **Sheet root** alone, there being no Title folder to look in first: the
// poster its `Poster` cell names, and each track its `Subtitles` cells name
// in the language its file name reads. A cell naming nothing finds nothing,
// and the `Backdrop` cell is not read: the Resolve has no slot for it.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { rowCellFiles } from './pathCellFills';
import type { SheetRow } from '../readSheet/readSheet';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

const HEAT = 'Heat (1995)';

/** Heat's row, as the reader reads an Export's. */
const row = (cells: Partial<SheetRow>): SheetRow => ({
  type: 'Movie',
  folder: HEAT,
  folderPath: HEAT,
  season: null,
  episode: null,
  title: 'Heat',
  year: 1995,
  endYear: 1995,
  genres: [],
  director: null,
  cast: [],
  synopsis: null,
  rating: null,
  watched: false,
  airDate: null,
  runtime: null,
  tmdbScore: null,
  tmdbId: null,
  favorite: false,
  videoQuality: null,
  video: null,
  subtitles: [],
  poster: null,
  backdrop: null,
  still: null,
  ...cells,
});

/** Write `relative` under `root`, its folders made on the way. */
function put(root: string, relative: string): string {
  const path = join(root, ...relative.split('/'));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, relative);
  return path;
}

describe('rowCellFiles', () => {
  it('finds the poster its Poster cell names under the Sheet root', async () => {
    const root = sandboxRoot('familyflix-row-cells-');
    const poster = put(root, `${HEAT}/Images/poster.jpg`);

    const files = await rowCellFiles(
      row({ poster: `${HEAT}/Images/poster.jpg` }),
      root
    );

    expect(files.poster).toBe(poster);
  });

  it('finds each track, in the language its name reads', async () => {
    const root = sandboxRoot('familyflix-row-cells-');
    const english = put(root, `${HEAT}/Subtitles/English.srt`);
    const french = put(root, `${HEAT}/Subtitles/French.srt`);

    const files = await rowCellFiles(
      row({
        subtitles: [
          `${HEAT}/Subtitles/English.srt`,
          `${HEAT}/Subtitles/French.srt`,
        ],
      }),
      root
    );

    expect(files.subtitles).toEqual([
      { path: english, language: 'English' },
      { path: french, language: 'French' },
    ]);
  });

  it('finds nothing a cell names that is not there', async () => {
    const root = sandboxRoot('familyflix-row-cells-');

    const files = await rowCellFiles(
      row({
        poster: `${HEAT}/Images/poster.jpg`,
        subtitles: [`${HEAT}/Subtitles/English.srt`],
      }),
      root
    );

    expect(files).toEqual({ poster: null, subtitles: [] });
  });
});
