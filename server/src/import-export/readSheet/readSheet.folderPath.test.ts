// @vitest-environment node
//
// 67, Export paths, Phase 1 (issue #644): a Folder cell read as a path.
//
// The **Sheet reader** reads a `Folder` cell as a path: `\` and `/` both
// separate, the **Folder path** (`SheetRow.folderPath`) is its segments joined
// by `/`, and the **Folder key** (`SheetRow.folder`) is its last segment. A
// v0.16.1 Export wrote `Movies\Guardians of the Galaxy`; it reads as the Folder
// path `Movies/Guardians of the Galaxy` and the key `Guardians of the Galaxy`.
// Duplicate rows are told apart by the Folder path, not the key.

import { describe, expect, it } from 'vitest';

import { readSheet, type SheetRow, type SheetSkip } from './readSheet';

/** A sheet typed in place, as the bytes a CSV file would hold. */
const csv = (lines: string[]): Buffer =>
  Buffer.from(`${lines.join('\n')}\n`, 'utf8');

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

/** The one row a one-Movie sheet with the Folder cell `cell` reads. */
async function readFolderCell(cell: string): Promise<SheetRow> {
  const { rows } = await readWithSkips([
    'Type,Folder,Title,Year',
    `Movie,"${cell}",Guardians of the Galaxy,2014`,
  ]);
  expect(rows).toHaveLength(1);
  return rows[0];
}

const GUARDIANS = 'Guardians of the Galaxy';
const GUARDIANS_PATH = 'Movies/Guardians of the Galaxy';

describe('readSheet: a Folder cell read as a Folder path', () => {
  it.each([
    ['a backslash', 'Movies\\Guardians of the Galaxy'],
    ['a slash', 'Movies/Guardians of the Galaxy'],
    ['mixed separators', 'Movies\\Guardians of the Galaxy/'],
    ['a trailing slash', 'Movies/Guardians of the Galaxy/'],
    ['a trailing backslash', 'Movies\\Guardians of the Galaxy\\'],
  ])(
    'reads %s as the Folder path and its last segment as the key',
    async (_, cell) => {
      const row = await readFolderCell(cell);

      expect(row.folderPath).toBe(GUARDIANS_PATH);
      expect(row.folder).toBe(GUARDIANS);
    }
  );
});

describe('readSheet: a one-segment Folder cell', () => {
  it('reads as before, its Folder path the key itself', async () => {
    const row = await readFolderCell('Heat (1995)');

    expect(row.folder).toBe('Heat (1995)');
    expect(row.folderPath).toBe('Heat (1995)');
  });

  it('gives a row with no Folder cell its spelled key as the Folder path', async () => {
    const { rows } = await readWithSkips([
      'Type,Folder,Title,Year',
      'Movie,,Heat,1995',
    ]);

    expect(rows[0].folder).toBe('Heat (1995)');
    expect(rows[0].folderPath).toBe('Heat (1995)');
  });
});

describe('readSheet: duplicates told apart by the Folder path', () => {
  it('reads two rows of one Folder path, however separated, as one title', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Title,Year,Rating',
      'Movie,Movies\\Heat (1995),Heat,1995,8',
      'Movie,Movies/Heat (1995),Heat,1995,3',
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(8);
    expect(skips).toEqual([expect.objectContaining({ kind: 'duplicate' })]);
  });

  it('reads two rows of one key under different Folder paths as two', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Title,Year',
      'Movie,Movies\\Heat (1995),Heat,1995',
      'Movie,Old films\\Heat (1995),Heat,1995',
    ]);

    expect(rows.map((row) => row.folderPath)).toEqual([
      'Movies/Heat (1995)',
      'Old films/Heat (1995)',
    ]);
    expect(skips).toEqual([]);
  });
});
