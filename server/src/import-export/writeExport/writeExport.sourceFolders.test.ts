// @vitest-environment node
//
// 61, Export round trip, Phase 1 (issue #582): the Export names each title by
// its Source folder.
//
// `ExportContent` carries `sourceFolders`, each title's **Source folder** by
// its id, as `sourceFoldersOf` answers it. `writeExport` hands it to
// `exportRows` as the **Library sheet** does, so a title renamed in the app
// has its row's `Folder` and its Title folder in the **Export folder** named
// by its Source folder, while its `Title` cell keeps the library's title. A
// title in no Library folder is still spelled `Title (Year)`. Two titles from
// two Library folders on one Source folder key are numbered apart with
// today's Warning line.
//
// Over a sandbox and a real `createMedia`, the stored files written into the
// media root by hand; asserted as the tree on disk, the sheet's cells and the
// outcome's value.

import ExcelJS from 'exceljs';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { SHEET_COLUMNS } from '@/types';
import type { Movie, SeriesDetail, StartExport } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { writeExport } from './writeExport';

const NAME = 'familyflix-collection_12-11-2026';

const RENAMED = "Le Fabuleux Destin d'Amélie Poulain";

/** Each stored file and the bytes it holds. */
const STORED: Record<string, string> = {
  'amelie-2001/amelie.mp4': 'amelie video',
  'amelie-2001/poster.png': 'amelie poster',
  'heat-1995/heat.mkv': 'heat video',
  'heat-1995/poster.jpg': 'heat poster',
  'other-amelie/amelie.mp4': 'other amelie video',
  'other-amelie/poster.png': 'other amelie poster',
  'tidewater-2018/poster.jpg': 'tidewater poster',
};

/** Amélie, renamed in the app; her Source folder is `Amélie (2001)`. */
const AMELIE: Movie = makeMovie({
  id: 'amelie',
  title: RENAMED,
  year: 2001,
  rating: 7,
  tmdbId: 194,
  videoPath: 'amelie-2001/amelie.mp4',
  posterPath: 'amelie-2001/poster.png',
});

/** Heat, in no Library folder: no Source folder. */
const HEAT: Movie = makeMovie({
  id: 'heat',
  title: 'Heat',
  year: 1995,
  videoPath: 'heat-1995/heat.mkv',
  posterPath: 'heat-1995/poster.jpg',
});

/** Another film, from another Library folder, on Amélie's Source folder key. */
const OTHER_AMELIE: Movie = makeMovie({
  id: 'other-amelie',
  title: 'Amelie',
  year: 2001,
  videoPath: 'other-amelie/amelie.mp4',
  posterPath: 'other-amelie/poster.png',
});

/** Tidewater, renamed in the app; its Source folder is `Tidewater (2018)`. */
const TIDEWATER: SeriesDetail = makeSeriesDetail([['unwatched']], {
  id: 'tidewater',
  title: 'Tidewater: The Ferry Town',
  year: 2018,
  endYear: null,
  posterPath: 'tidewater-2018/poster.jpg',
});

const SOURCE_FOLDERS: ReadonlyMap<string, string> = new Map([
  ['amelie', 'Amélie (2001)'],
  ['tidewater', 'Tidewater (2018)'],
]);

interface Sandbox {
  media: Media;
  destination: string;
}

/** A media root holding {@link STORED}, and an empty destination beside it. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-write-export-source-folders-');
  const mediaPath = join(dir, 'media');
  const destination = join(dir, 'Backups');
  mkdirSync(mediaPath);
  mkdirSync(destination);
  for (const [stored, bytes] of Object.entries(STORED)) {
    const file = join(mediaPath, ...stored.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  return { media: createMedia(mediaPath), destination };
}

const request = (destination: string): StartExport => ({
  format: 'csv',
  destination,
  images: true,
  subtitles: true,
  name: NAME,
});

const text = (cell: unknown): string => {
  if (typeof cell === 'object' && cell !== null && 'text' in cell) {
    return String((cell as { text: unknown }).text);
  }
  return cell === null || cell === undefined ? '' : String(cell);
};

/** The Export's csv sheet's rows by column name, header dropped. */
async function sheetRows(
  destination: string
): Promise<Record<string, string>[]> {
  const path = join(destination, NAME, 'Meta', 'familyflix-library.csv');
  const workbook = new ExcelJS.Workbook();
  await workbook.csv.read(
    Readable.from([readFileSync(path, 'utf8').replace(/^﻿/, '')]),
    { map: (value: string) => value }
  );
  const rows: string[][] = [];
  workbook.worksheets[0].eachRow({ includeEmpty: true }, (row) => {
    rows.push(
      SHEET_COLUMNS.map((_, index) => text(row.getCell(index + 1).value))
    );
  });
  const [header = [], ...body] = rows;
  return body.map((row) =>
    Object.fromEntries(header.map((name, index) => [name, row[index] ?? '']))
  );
}

const titleRow = (
  rows: Record<string, string>[],
  type: string,
  title: string
) => rows.find((row) => row.Type === type && row.Title === title);

describe('writeExport: each title is named by its Source folder', () => {
  it("names a renamed film's Folder cell by its Source folder, its Title cell the new name", async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), {
      movies: [AMELIE, HEAT],
      series: [TIDEWATER],
      sourceFolders: SOURCE_FOLDERS,
    });

    expect(
      titleRow(await sheetRows(destination), 'Movie', RENAMED)
    ).toMatchObject({ Folder: 'Amélie (2001)', Title: RENAMED, Year: '2001' });
  });

  it("names a renamed series' Folder cell by its Source folder", async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), {
      movies: [AMELIE, HEAT],
      series: [TIDEWATER],
      sourceFolders: SOURCE_FOLDERS,
    });

    expect(
      titleRow(
        await sheetRows(destination),
        'Series',
        'Tidewater: The Ferry Town'
      )
    ).toMatchObject({ Folder: 'Tidewater (2018)' });
  });

  it('names each Title folder in the Export folder by its Source folder', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), {
      movies: [AMELIE, HEAT],
      series: [TIDEWATER],
      sourceFolders: SOURCE_FOLDERS,
    });

    expect(readdirSync(join(destination, NAME)).sort()).toEqual(
      ['Amélie (2001)', 'Heat (1995)', 'Meta', 'Tidewater (2018)'].sort()
    );
    expect(
      readFileSync(
        join(destination, NAME, 'Amélie (2001)', 'Images', 'poster.png'),
        'utf8'
      )
    ).toBe('amelie poster');
  });

  it('spells a title with no Source folder `Title (Year)`', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), {
      movies: [AMELIE, HEAT],
      series: [TIDEWATER],
      sourceFolders: SOURCE_FOLDERS,
    });

    expect(
      titleRow(await sheetRows(destination), 'Movie', 'Heat')
    ).toMatchObject({ Folder: 'Heat (1995)' });
  });
});

describe('writeExport: two titles on one Source folder key', () => {
  const content = {
    movies: [AMELIE, OTHER_AMELIE],
    series: [],
    sourceFolders: new Map([
      ['amelie', 'Amélie (2001)'],
      ['other-amelie', 'Amélie (2001)'],
    ]),
  };

  it('numbers the second Title folder apart', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), content);

    expect(readdirSync(join(destination, NAME)).sort()).toEqual(
      ['Amélie (2001)', 'Amélie (2001) (1)', 'Meta'].sort()
    );
    const folders = (await sheetRows(destination))
      .filter((row) => row.Type === 'Movie')
      .map((row) => row.Folder)
      .sort();
    expect(folders).toEqual(['Amélie (2001)', 'Amélie (2001) (1)']);
  });

  it("answers written with today's Warning line for the shared key", async () => {
    const { media, destination } = sandbox();

    const outcome = await writeExport(media, request(destination), content);

    expect(outcome).toMatchObject({
      kind: 'written',
      warnings: [
        '⚠ Two titles share the folder Amélie (2001): one is exported as Amélie (2001) (1)',
      ],
    });
  });
});
