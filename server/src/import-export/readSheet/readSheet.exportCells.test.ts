// @vitest-environment node
//
// 67, Export paths, Phase 2 (issue #645): a path cell contained under its
// row's Folder path.
//
// A v0.16.1 Export wrote its path cells under the row's **Folder path**, a
// backslash between the parent and the Title folder:
// `Movies\Amelie (2001)/Images/poster.png`. The **Sheet reader** reads `\` as
// `/` first, so such a cell is contained when its leading segments fold equal
// to the Folder path's; the backslash refusal goes. `..`, `..\`, an empty
// segment and a drive letter's colon are still refused and reported as an
// **Unread cell**, as is a cell not under its row's folder. `resolvePathCell`
// then replaces the Folder path by the matched **Title folder**.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  readSheet,
  resolvePathCell,
  type SheetRow,
  type SheetSkip,
} from './readSheet';

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

/** Amélie's row as v0.16.1 wrote it, its one path cell under `column`. */
const amelieWith = (
  column: 'Poster' | 'Backdrop' | 'Still' | 'Subtitles',
  cell: string
): string[] => [
  `Type,Folder,Title,Year,${column}`,
  `Movie,${quoted('Movies\\Amelie (2001)')},Amelie,2001,${quoted(cell)}`,
];

/** The re-linked inner Library folder's Title folder Amélie's row matches. */
const TITLE_FOLDER = join('/', 'Library', 'Movies', 'Amelie (2001)');

describe('readSheet: a v0.16.1 path cell under its Folder path', () => {
  it.each([
    ['Poster', 'Movies\\Amelie (2001)/Images/poster.png', 'poster'],
    ['Backdrop', 'Movies\\Amelie (2001)/Images/backdrop.png', 'backdrop'],
    ['Poster', 'Movies/Amelie (2001)/Images/poster.png', 'poster'],
    ['Poster', 'Movies\\Amelie (2001)\\Images\\poster.png', 'poster'],
  ] as const)(
    'reads the %s cell %s, contained, with no skip',
    async (column, cell, field) => {
      const { rows, skips } = await readWithSkips(amelieWith(column, cell));

      expect(rows[0][field]).not.toBeNull();
      expect(skips).toEqual([]);
    }
  );

  it('reads every Subtitles path under the Folder path', async () => {
    const { rows, skips } = await readWithSkips(
      amelieWith(
        'Subtitles',
        'Movies\\Amelie (2001)/Subtitles/English.srt|Movies\\Amelie (2001)/Subtitles/French.srt'
      )
    );

    expect(rows[0].subtitles).toHaveLength(2);
    expect(skips).toEqual([]);
  });

  it('resolves the cell as read into the matched Title folder', async () => {
    const { rows } = await readWithSkips(
      amelieWith('Poster', 'Movies\\Amelie (2001)/Images/poster.png')
    );
    const [row] = rows;

    expect(
      resolvePathCell(TITLE_FOLDER, row.folderPath, row.poster ?? '')
    ).toBe(join(TITLE_FOLDER, 'Images', 'poster.png'));
  });
});

describe('readSheet: a v0.16.1 path cell that leaves its Folder path', () => {
  it.each([
    ['climbs out with ..\\', 'Movies\\Amelie (2001)\\..\\..\\secret.png'],
    ['climbs out with ..', 'Movies/Amelie (2001)/../poster.png'],
    ['holds an empty segment', 'Movies\\Amelie (2001)\\\\poster.png'],
    ['names a drive letter', 'C:\\Movies\\Amelie (2001)\\poster.png'],
    ['holds a colon', 'Movies\\Amelie (2001)\\C:poster.png'],
    ['is not under its row’s folder', 'Amelie (2001)/Images/poster.png'],
    ['names another parent', 'Series\\Amelie (2001)/Images/poster.png'],
  ])('reads a Poster cell that %s as blank, reported', async (_, cell) => {
    const { rows, skips } = await readWithSkips(amelieWith('Poster', cell));

    expect(rows[0].poster).toBeNull();
    expect(skips).toEqual([
      expect.objectContaining({
        kind: 'unread-cell',
        column: 'Poster',
        text: cell,
      }),
    ]);
  });
});
