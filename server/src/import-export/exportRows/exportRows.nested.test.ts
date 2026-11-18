// @vitest-environment node
//
// 67, Export paths, Phase 3 (issue #646): a nested Source folder's key.
//
// `exportRows` keys each title by `titleFolderName` of its **Source folder**:
// a title held from `Movies/Heat (1995)` writes `Heat (1995)` in its `Folder`
// cell, whatever separator its Source folder was stored with. Two nested
// titles sharing a last segment number `(1)` and `(2)` with a Warning line,
// as any clash is (log 61 Q4).
//
// A cell is compared as text, `''` for an empty one.

import { describe, expect, it } from 'vitest';

import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { filePlan } from '../filePlan/filePlan';
import { exportRows } from './exportRows';

const OFF = { images: false, subtitles: false };

const text = (cell: unknown): string =>
  cell === null || cell === undefined ? '' : String(cell);

/** Every row after the header, by column name. */
function rowsOf(exported: ReturnType<typeof exportRows>) {
  const [header = [], ...body] = exported.table.map((row) => row.map(text));
  return body.map((row) =>
    Object.fromEntries(header.map((name, index) => [name, row[index] ?? '']))
  );
}

describe('exportRows: a nested Source folder', () => {
  const exported = exportRows(
    [makeMovie({ id: 'heat', title: 'Heat', year: 1995 })],
    [
      makeSeriesDetail([['unwatched']], {
        id: 'tidewater',
        title: 'Tidewater',
        year: 2018,
      }),
    ],
    filePlan(OFF).cells,
    new Map([
      ['heat', 'Movies/Heat (1995)'],
      ['tidewater', 'Series\\Tidewater (2018)'],
    ])
  );

  it('writes its last segment as the Folder key', () => {
    expect(rowsOf(exported).find((row) => row.Type === 'Movie')?.Folder).toBe(
      'Heat (1995)'
    );
  });

  it('reads a backslash as a separator, every row of a series alike', () => {
    expect(
      rowsOf(exported)
        .filter((row) => row.Type !== 'Movie')
        .map((row) => row.Folder)
    ).toEqual(['Tidewater (2018)', 'Tidewater (2018)', 'Tidewater (2018)']);
  });
});

describe('exportRows: two nested titles sharing a last segment', () => {
  const exported = exportRows(
    [
      makeMovie({ id: 'one', title: 'Amelie', year: 2001 }),
      makeMovie({ id: 'two', title: 'Amelie', year: 2001 }),
    ],
    [],
    filePlan(OFF).cells,
    new Map([
      ['one', 'Movies/Amelie (2001)'],
      ['two', 'Films\\Amelie (2001)'],
    ])
  );

  it('numbers the second (1)', () => {
    expect(
      rowsOf(exported)
        .map((row) => row.Folder)
        .sort()
    ).toEqual(['Amelie (2001)', 'Amelie (2001) (1)']);
  });

  it('logs one Warning line for the shared key', () => {
    expect(exported.warnings).toEqual([
      '⚠ Two titles share the folder Amelie (2001): one is exported as Amelie (2001) (1)',
    ]);
  });
});

describe('exportRows: three nested titles sharing a last segment', () => {
  const exported = exportRows(
    [
      makeMovie({ id: 'one', title: 'Amelie', year: 2001 }),
      makeMovie({ id: 'two', title: 'Amelie', year: 2001 }),
      makeMovie({ id: 'three', title: 'Amelie', year: 2001 }),
    ],
    [],
    filePlan(OFF).cells,
    new Map([
      ['one', 'Movies/Amelie (2001)'],
      ['two', 'Films\\Amelie (2001)'],
      ['three', 'Amelie (2001)'],
    ])
  );

  it('numbers the second (1) and the third (2), each with a Warning line', () => {
    expect(
      rowsOf(exported)
        .map((row) => row.Folder)
        .sort()
    ).toEqual(['Amelie (2001)', 'Amelie (2001) (1)', 'Amelie (2001) (2)']);
    expect(exported.warnings).toHaveLength(2);
  });
});
