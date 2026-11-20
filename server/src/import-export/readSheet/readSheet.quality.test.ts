// @vitest-environment node
//
// 70, Video quality, Phase 9 (issue #672): the sheet read back.
//
// The **Sheet reader** reads a row's rung of the **Quality ladder** from the
// column headed `Quality` or `Resolution`, header and cell both case-folded,
// and answers it spelled as the ladder spells it (`4k` reads as `4K`, `1080P`
// as `1080p`). A filled cell off the ladder is an **Unread cell**, read as
// blank. A sheet written before step 52, which has no such column, reads as
// it always did: every row's quality blank, nothing reported.

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

const HEAT = 'Heat (1995)';
const TIDEWATER = 'Tidewater (2018)';

/** _Heat_'s Movie row, its quality cell `cell` under the header `header`. */
const heatUnder = (header: string, cell: string): string[] => [
  `Type,Folder,Title,${header}`,
  `Movie,${HEAT},Heat,${cell}`,
];

describe('readSheet: the Quality column', () => {
  it.each([
    ['4K', '4K'],
    ['1080p', '1080p'],
    ['720p', '720p'],
    ['480p', '480p'],
    ['SD', 'SD'],
  ] as const)('reads a Quality cell "%s" as %s', async (cell, quality) => {
    const { rows, skips } = await readWithSkips(heatUnder('Quality', cell));

    expect(rows[0].videoQuality).toBe(quality);
    expect(skips).toEqual([]);
  });

  it.each([
    ['4k', '4K'],
    ['1080P', '1080p'],
    ['720P', '720p'],
    ['sd', 'SD'],
    [' 480p ', '480p'],
  ] as const)(
    'reads a cell "%s" in any case as the ladder’s %s',
    async (cell, quality) => {
      const { rows, skips } = await readWithSkips(heatUnder('Quality', cell));

      expect(rows[0].videoQuality).toBe(quality);
      expect(skips).toEqual([]);
    }
  );

  it.each(['Quality', 'quality', 'QUALITY', 'Resolution', 'resolution'])(
    'reads the column under the header "%s"',
    async (header) => {
      const { rows, skips } = await readWithSkips(heatUnder(header, '4k'));

      expect(rows[0].videoQuality).toBe('4K');
      expect(skips).toEqual([]);
    }
  );

  it('reads an Episode row’s quality', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Season,Episode,Title,Quality',
      `Series,${TIDEWATER},,,Tidewater,`,
      `Episode,${TIDEWATER},1,1,Low Water,1080P`,
    ]);

    expect(rows[1].videoQuality).toBe('1080p');
    expect(skips).toEqual([]);
  });

  it('reads a blank cell as no quality, with no skip', async () => {
    const { rows, skips } = await readWithSkips(heatUnder('Quality', ''));

    expect(rows[0].videoQuality).toBeNull();
    expect(skips).toEqual([]);
  });
});

describe('readSheet: a Quality cell off the ladder', () => {
  it.each(['HD', '2160p', 'Full HD', '1080', '8K'])(
    'reads "%s" as blank, one Unread cell',
    async (cell) => {
      const { rows, skips } = await readWithSkips(heatUnder('Quality', cell));

      expect(rows[0].videoQuality).toBeNull();
      expect(skips).toEqual([
        { kind: 'unread-cell', label: HEAT, column: 'Quality', text: cell },
      ]);
    }
  );

  it('reports one under a Resolution header too', async () => {
    const { rows, skips } = await readWithSkips(heatUnder('Resolution', 'HD'));

    expect(rows[0].videoQuality).toBeNull();
    expect(skips).toEqual([
      { kind: 'unread-cell', label: HEAT, column: 'Quality', text: 'HD' },
    ]);
  });
});

describe('readSheet: a sheet written before step 52', () => {
  const BEFORE = [
    'Type,Folder,Season,Episode,Title,Year,Air date,Runtime,Genres,Rating,Status,Video',
    `Movie,${HEAT},,,Heat,1995,,170,Crime,8,Watched,${HEAT}/Heat.mkv`,
    `Series,${TIDEWATER},,,Tidewater,2018,,,Drama,7,,`,
    `Season,${TIDEWATER},1,,,,,,,,,`,
    `Episode,${TIDEWATER},1,1,Low Water,,2018-10-02,42,,,Unwatched,${TIDEWATER}/Season 01/Low.Water.mp4`,
  ];

  it('reads every row with no quality, the rest as before, and reports nothing', async () => {
    const { rows, skips } = await readWithSkips(BEFORE);

    expect(rows.map((row) => row.videoQuality)).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(skips).toEqual([]);
    expect(
      rows.map((row) => [row.type, row.title, row.runtime, row.watched])
    ).toEqual([
      ['Movie', 'Heat', 170, true],
      ['Series', 'Tidewater', null, false],
      ['Season', '', null, false],
      ['Episode', 'Low Water', 42, false],
    ]);
    expect(rows[0].video).toBe(`${HEAT}/Heat.mkv`);
  });
});
