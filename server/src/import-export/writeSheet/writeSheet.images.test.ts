// @vitest-environment node
//
// 31 — Export options, Phase 3: images (issue #278).
//
// `writeSheet(tables, format, name)` in xlsx writes each path cell — Poster
// and Backdrop on the Titles worksheet, Still on the Episodes worksheet — as a
// hyperlink whose text is the path, so a click in Excel opens the picture
// beside the sheet. Every other cell stays a plain value.
//
// Read back through ExcelJS, as the existing writeSheet suites do.

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import type { Episode, Movie, SeriesDetail } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { exportRows } from '../exportRows/exportRows';
import { writeSheet } from './writeSheet';

const NAME = 'familyflix-collection_09-10-2026';

const HEAT: Movie = makeMovie({
  id: 'heat',
  title: 'Heat',
  year: 1995,
  posterPath: 'heat-1995/poster.jpg',
  backdropPath: 'heat-1995/backdrop.jpg',
});

const SEVERANCE: SeriesDetail = ((): SeriesDetail => {
  const detail = makeSeriesDetail([['unwatched']], {
    id: 'severance',
    title: 'Severance',
    year: 2022,
    endYear: null,
  });
  const still = (episode: Episode): Episode => ({
    ...episode,
    stillPath: 'severance-2022/s01e01.jpg',
  });
  return {
    ...detail,
    seasons: detail.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map(still),
    })),
  };
})();

/** The workbook an images-on xlsx export of Heat and Severance writes. */
async function workbook(): Promise<ExcelJS.Workbook> {
  const { tables } = exportRows([HEAT], [SEVERANCE], {
    images: true,
    subtitles: false,
  });
  const [file] = await writeSheet(tables, 'xlsx', NAME);
  const book = new ExcelJS.Workbook();
  // `exceljs` declares its own `Buffer` shape for what is a Node `Buffer`.
  await book.xlsx.load(file?.bytes as unknown as ArrayBuffer);
  return book;
}

/** The cell under `column` in the first row after the header. */
function cellUnder(sheet: ExcelJS.Worksheet, column: string): ExcelJS.Cell {
  const header = sheet.getRow(1);
  let index = 0;
  header.eachCell((cell, at) => {
    if (cell.text === column) {
      index = at;
    }
  });
  expect(index).toBeGreaterThan(0);
  return sheet.getRow(2).getCell(index);
}

describe('writeSheet — xlsx path cells are hyperlinks', () => {
  it('links the Poster cell to its path, the path as its text', async () => {
    const titles = (await workbook()).getWorksheet('Titles');
    const poster = cellUnder(titles as ExcelJS.Worksheet, 'Poster');

    expect(poster.hyperlink).toBe('Heat (1995)/poster.jpg');
    expect(poster.text).toBe('Heat (1995)/poster.jpg');
  });

  it('links the Backdrop cell the same way', async () => {
    const titles = (await workbook()).getWorksheet('Titles');
    const backdrop = cellUnder(titles as ExcelJS.Worksheet, 'Backdrop');

    expect(backdrop.hyperlink).toBe('Heat (1995)/backdrop.jpg');
    expect(backdrop.text).toBe('Heat (1995)/backdrop.jpg');
  });

  it('links an episode’s Still cell on the Episodes worksheet', async () => {
    const episodes = (await workbook()).getWorksheet('Episodes');
    const still = cellUnder(episodes as ExcelJS.Worksheet, 'Still');

    expect(still.hyperlink).toBe('Severance (2022–)/stills/S01E01.jpg');
    expect(still.text).toBe('Severance (2022–)/stills/S01E01.jpg');
  });

  it('leaves every other cell a plain value', async () => {
    const titles = (await workbook()).getWorksheet('Titles');
    const title = cellUnder(titles as ExcelJS.Worksheet, 'Title');

    expect(title.hyperlink).toBeUndefined();
    expect(title.value).toBe('Heat');
  });
});
