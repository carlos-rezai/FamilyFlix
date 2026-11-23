// @vitest-environment node
//
// 67, Export paths, Phase 3 (issue #646): a new Export is flat.
//
// A library whose **Source folders** are nested (`Movies/Amelie (2001)`,
// `Movies\Die Hard (1988)`, `Series/Tidewater (2018)`) exports in the
// **Folder layout**: one **Title folder** per title directly in the **Export
// folder**, named by `titleFolderName` of its Source folder, its `Folder`
// cell that one segment and its art cells starting with it.
//
// Over a sandbox and a real `createMedia`, the stored files written into the
// media root by hand; asserted as the tree on disk and the sheet's cells.

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
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { UTF8_BOM } from '../sheetDialect/sheetDialect';
import { writeExport } from './writeExport';

const NAME = 'familyflix-collection_17-11-2026';

/** Each stored file and the bytes it holds. */
const STORED: Record<string, string> = {
  'amelie-2001/amelie.mp4': 'amelie video',
  'amelie-2001/poster.png': 'amelie poster',
  'amelie-2001/backdrop.png': 'amelie backdrop',
  'die-hard-1988/die-hard.mp4': 'die hard video',
  'die-hard-1988/poster.jpg': 'die hard poster',
  'tidewater-2018/poster.jpg': 'tidewater poster',
};

const AMELIE: Movie = makeMovie({
  id: 'amelie',
  title: 'Amelie',
  year: 2001,
  videoPath: 'amelie-2001/amelie.mp4',
  posterPath: 'amelie-2001/poster.png',
  backdropPath: 'amelie-2001/backdrop.png',
});

const DIE_HARD: Movie = makeMovie({
  id: 'die-hard',
  title: 'Die Hard',
  year: 1988,
  videoPath: 'die-hard-1988/die-hard.mp4',
  posterPath: 'die-hard-1988/poster.jpg',
});

const TIDEWATER: SeriesDetail = makeSeriesDetail([['unwatched']], {
  id: 'tidewater',
  title: 'Tidewater',
  year: 2018,
  endYear: null,
  posterPath: 'tidewater-2018/poster.jpg',
});

/** Nested Source folders, one stored with a backslash. */
const SOURCE_FOLDERS: ReadonlyMap<string, string> = new Map([
  ['amelie', 'Movies/Amelie (2001)'],
  ['die-hard', 'Movies\\Die Hard (1988)'],
  ['tidewater', 'Series/Tidewater (2018)'],
]);

interface Sandbox {
  media: Media;
  destination: string;
}

/** A media root holding {@link STORED}, and an empty destination beside it. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-write-export-flat-');
  const mediaPath = join(dir, 'media');
  const destination = join(dir, 'Backups');
  mkdirSync(mediaPath);
  mkdirSync(destination);
  for (const [stored, bytes] of Object.entries(STORED)) {
    const file = join(mediaPath, ...stored.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  return { media: createMedia(mediaPath, unfittedArt()), destination };
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
  const path = join(destination, NAME, '_meta', 'familyflix-library.csv');
  const workbook = new ExcelJS.Workbook();
  await workbook.csv.read(
    Readable.from([
      readFileSync(path).subarray(UTF8_BOM.length).toString('utf8'),
    ]),
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

/** The library exported once, and its sheet's rows. */
async function exported() {
  const { media, destination } = sandbox();
  await writeExport(media, request(destination), {
    movies: [AMELIE, DIE_HARD],
    series: [TIDEWATER],
    sourceFolders: SOURCE_FOLDERS,
  });
  return { destination, rows: await sheetRows(destination) };
}

describe('writeExport: a library of nested Source folders', () => {
  it('lays one Title folder per title directly in the Export folder', async () => {
    const { destination } = await exported();

    expect(readdirSync(join(destination, NAME)).sort()).toEqual(
      ['Amelie (2001)', 'Die Hard (1988)', '_meta', 'Tidewater (2018)'].sort()
    );
    expect(
      readFileSync(
        join(destination, NAME, 'Amelie (2001)', 'Images', 'poster.png'),
        'utf8'
      )
    ).toBe('amelie poster');
  });

  it('writes each Folder cell as one segment', async () => {
    const { rows } = await exported();

    expect(
      rows
        .filter((row) => row.Type === 'Movie' || row.Type === 'Series')
        .map((row) => row.Folder)
    ).toEqual(['Amelie (2001)', 'Die Hard (1988)', 'Tidewater (2018)']);
  });

  it('starts each art cell with its title’s key', async () => {
    const { rows } = await exported();

    const art = rows
      .flatMap((row) =>
        [row.Poster, row.Backdrop].map((cell) => [row.Folder, cell])
      )
      .filter(([, cell]) => cell !== '');
    expect(art).toEqual([
      ['Amelie (2001)', 'Amelie (2001)/Images/poster.png'],
      ['Amelie (2001)', 'Amelie (2001)/Images/backdrop.png'],
      ['Die Hard (1988)', 'Die Hard (1988)/Images/poster.jpg'],
      ['Tidewater (2018)', 'Tidewater (2018)/Images/poster.jpg'],
    ]);
  });
});
