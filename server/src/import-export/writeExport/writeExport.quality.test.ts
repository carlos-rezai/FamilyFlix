// @vitest-environment node
//
// 70, Video quality, Phase 8 (issue #671): an Export's sheet carries Quality.
//
// An **Export** writes its sheet through `exportRows`, so its csv carries the
// `Quality` column after `Runtime`, filled on a measured film's Movie row and
// blank on an unmeasured one's.
//
// Over a sandbox and a real `createMedia`; asserted as the csv's header and
// cells, read back by ExcelJS.

import ExcelJS from 'exceljs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import type { Movie, StartExport } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { createMedia } from '../../media/createMedia/createMedia';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { UTF8_BOM } from '../sheetDialect/sheetDialect';
import { writeExport } from './writeExport';

const NAME = 'familyflix-collection_20-11-2026';

const STORED: Record<string, string> = {
  'die-hard-1988/die-hard.mp4': 'die hard video',
  'amelie-2001/amelie.mp4': 'amelie video',
};

const DIE_HARD: Movie = makeMovie({
  id: 'die-hard',
  title: 'Die Hard',
  year: 1988,
  videoQuality: '720p',
  videoPath: 'die-hard-1988/die-hard.mp4',
});

const AMELIE: Movie = makeMovie({
  id: 'amelie',
  title: 'Amelie',
  year: 2001,
  videoQuality: null,
  videoPath: 'amelie-2001/amelie.mp4',
});

/** The csv's every row as text cells, header first. */
async function csvRows(destination: string): Promise<string[][]> {
  const path = join(destination, NAME, 'Meta', 'familyflix-library.csv');
  const workbook = new ExcelJS.Workbook();
  await workbook.csv.read(
    Readable.from([
      readFileSync(path).subarray(UTF8_BOM.length).toString('utf8'),
    ]),
    { map: (value: string) => value }
  );
  const rows: string[][] = [];
  const sheet = workbook.worksheets[0];
  const width = sheet.getRow(1).cellCount;
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    for (let index = 1; index <= width; index += 1) {
      const value = row.getCell(index).value;
      cells.push(value === null || value === undefined ? '' : String(value));
    }
    rows.push(cells);
  });
  return rows;
}

/** The library of two films exported once as csv, its sheet read back. */
async function exported(): Promise<string[][]> {
  const dir = sandboxRoot('familyflix-write-export-quality-');
  const mediaPath = join(dir, 'media');
  const destination = join(dir, 'Backups');
  mkdirSync(mediaPath);
  mkdirSync(destination);
  for (const [stored, bytes] of Object.entries(STORED)) {
    const file = join(mediaPath, ...stored.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  const request: StartExport = {
    format: 'csv',
    destination,
    images: false,
    subtitles: false,
    name: NAME,
  };
  await writeExport(createMedia(mediaPath, unfittedArt()), request, {
    movies: [DIE_HARD, AMELIE],
    series: [],
    sourceFolders: new Map(),
  });
  return csvRows(destination);
}

describe('writeExport: the Quality column', () => {
  it('writes Quality in the sheet’s header, after Runtime', async () => {
    const [header = []] = await exported();
    const runtime = header.indexOf('Runtime');

    expect(header.slice(runtime, runtime + 2)).toEqual(['Runtime', 'Quality']);
  });

  it('fills a measured film’s Quality cell and leaves an unmeasured one’s blank', async () => {
    const [header = [], ...body] = await exported();
    const title = header.indexOf('Title');
    const quality = header.indexOf('Quality');

    expect(body.map((row) => [row[title], row[quality] ?? ''])).toEqual([
      ['Amelie', ''],
      ['Die Hard', '720p'],
    ]);
  });
});
