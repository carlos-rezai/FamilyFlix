// @vitest-environment node
//
// 60, Rebuild edges, Phase 1 (issue #564): a path cell stays inside its
// Title folder.
//
// The **Sheet reader** reads a path cell only when it is contained: its first
// segment the row's **Folder key** (by `sameFolderKey`), no segment empty,
// `.` or `..`, none holding a backslash or a colon, and the file naming its
// column's kind. A cell that fails reads as blank and is one **Unread cell**,
// reported through `onSkip` as an `unread-cell` skip. `Video` is never
// checked. `onBlankTitle` is gone: a titleless row is a `blank-title` skip.

import { describe, expect, it } from 'vitest';

import { readSheet, type SheetRow, type SheetSkip } from './readSheet';

/** A sheet typed in place, as the bytes a CSV file would hold. */
const csv = (lines: string[]): Buffer =>
  Buffer.from(`${lines.join('\n')}\n`, 'utf8');

/** A cell quoted for CSV, so a comma, quote or space in it reads as text. */
const quoted = (text: string): string => `"${text.replace(/"/g, '""')}"`;

/** Read a sheet and gather every skip the reader reports. */
async function readWithSkips(
  lines: string[]
): Promise<{ rows: SheetRow[]; skips: SheetSkip[] }> {
  const skips: SheetSkip[] = [];
  const rows = await readSheet(csv(lines), 'library.csv', (skip) => {
    skips.push(skip);
  });
  return { rows, skips };
}

/** _Heat_ (1995)'s row, its one path cell under `column` holding `cell`. */
const heatWith = (
  column: 'Poster' | 'Backdrop' | 'Still' | 'Subtitles' | 'Video',
  cell: string
): string[] => [
  `Type,Folder,Title,Year,${column}`,
  `Movie,Heat (1995),Heat,1995,${quoted(cell)}`,
];

describe('readSheet: a path cell that leaves its Title folder', () => {
  it.each([
    ['climbs out with ..', '../secret.txt'],
    ['names another Folder key', 'Gigli (2003)/poster.jpg'],
    ['holds an empty segment', 'Heat (1995)//poster.jpg'],
    ['holds a . segment', 'Heat (1995)/./poster.jpg'],
    ['holds a .. segment', 'Heat (1995)/../Heat (1995)/poster.jpg'],
    ['holds a backslash', 'Heat (1995)/art\\poster.jpg'],
    ['holds a colon', 'Heat (1995)/C:poster.jpg'],
  ])(
    'reads a Poster cell that %s as blank, one Unread cell',
    async (_case, cell) => {
      const { rows, skips } = await readWithSkips(heatWith('Poster', cell));

      expect(rows[0].poster).toBeNull();
      expect(skips).toEqual([
        {
          kind: 'unread-cell',
          label: 'Heat (1995)',
          column: 'Poster',
          text: cell,
        },
      ]);
    }
  );

  it('reads a contained Poster cell as the sheet spells it, with no skip', async () => {
    const { rows, skips } = await readWithSkips(
      heatWith('Poster', 'Heat (1995)/art/poster.jpg')
    );

    expect(rows[0].poster).toBe('Heat (1995)/art/poster.jpg');
    expect(skips).toEqual([]);
  });

  it('still reads a Folder key cased differently from the row’s', async () => {
    const { rows, skips } = await readWithSkips(
      heatWith('Poster', 'HEAT (1995)/poster.jpg')
    );

    expect(rows[0].poster).toBe('HEAT (1995)/poster.jpg');
    expect(skips).toEqual([]);
  });
});

describe('readSheet: a path cell that names the wrong kind of file', () => {
  it.each([['Poster' as const], ['Backdrop' as const], ['Still' as const]])(
    'reads a non-image in %s as blank and reports it',
    async (column) => {
      const cell = 'Heat (1995)/notes.txt';
      const { rows, skips } = await readWithSkips(heatWith(column, cell));

      const field = { Poster: 'poster', Backdrop: 'backdrop', Still: 'still' }[
        column
      ] as 'poster' | 'backdrop' | 'still';
      expect(rows[0][field]).toBeNull();
      expect(skips).toEqual([
        { kind: 'unread-cell', label: 'Heat (1995)', column, text: cell },
      ]);
    }
  );

  it.each([['Backdrop' as const], ['Still' as const]])(
    'reads an image in %s, contained, with no skip',
    async (column) => {
      const cell = 'Heat (1995)/frame.jpg';
      const { rows, skips } = await readWithSkips(heatWith(column, cell));

      const field = column === 'Backdrop' ? 'backdrop' : 'still';
      expect(rows[0][field]).toBe(cell);
      expect(skips).toEqual([]);
    }
  );

  it('drops a non-subtitle among Subtitles, reports it, and reads the rest', async () => {
    const { rows, skips } = await readWithSkips(
      heatWith(
        'Subtitles',
        'Heat (1995)/heat.en.srt|Heat (1995)/notes.txt|Heat (1995)/heat.nl.srt'
      )
    );

    expect(rows[0].subtitles).toEqual([
      'Heat (1995)/heat.en.srt',
      'Heat (1995)/heat.nl.srt',
    ]);
    expect(skips).toEqual([
      {
        kind: 'unread-cell',
        label: 'Heat (1995)',
        column: 'Subtitles',
        text: 'Heat (1995)/notes.txt',
      },
    ]);
  });

  it('drops a Subtitles path that leaves the Title folder and reads the rest', async () => {
    const { rows, skips } = await readWithSkips(
      heatWith('Subtitles', '../secret.srt|Heat (1995)/heat.en.srt')
    );

    expect(rows[0].subtitles).toEqual(['Heat (1995)/heat.en.srt']);
    expect(skips).toEqual([
      {
        kind: 'unread-cell',
        label: 'Heat (1995)',
        column: 'Subtitles',
        text: '../secret.srt',
      },
    ]);
  });
});

describe('readSheet: the Video cell', () => {
  it('reads Video unchecked, wherever it points', async () => {
    const { rows, skips } = await readWithSkips(
      heatWith('Video', '../Elsewhere/Heat.1995.mkv')
    );

    expect(rows[0].video).toBe('../Elsewhere/Heat.1995.mkv');
    expect(skips).toEqual([]);
  });
});

describe('readSheet: onSkip in place of onBlankTitle', () => {
  it('reports a titleless row as a blank-title skip with its row number', async () => {
    const { rows, skips } = await readWithSkips([
      'Title,Year',
      'Die Hard,1988',
      ',1990',
      'Amélie,2001',
    ]);

    expect(rows.map((row) => row.title)).toEqual(['Die Hard', 'Amélie']);
    expect(skips).toEqual([{ kind: 'blank-title', rowNumber: 3 }]);
  });
});
