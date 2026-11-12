// @vitest-environment node
//
// 60, Rebuild edges, Phase 5 (issue #568): an Export is always `,`.
//
// The **Library sheet writer** keeps a Library sheet's **Sheet dialect**; an
// **Export** does not look at it. Exported into a Library folder whose
// `Meta/familyflix-library.csv` is `;`-separated, the Export's own sheet is
// `,`, its decimals written with a point, UTF-8 behind a BOM (log 60, Q6).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SHEET_COLUMNS } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { createMedia } from '../../media/createMedia/createMedia';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { writeExport } from './writeExport';

const NAME = 'familyflix-collection_10-11-2026';

describe('writeExport: the Sheet dialect', () => {
  it('writes `,` into a folder whose Library sheet is `;`', async () => {
    const dir = sandboxRoot('familyflix-export-dialect-');
    const mediaPath = join(dir, 'media');
    const destination = join(dir, 'Movies');
    mkdirSync(mediaPath);
    mkdirSync(join(destination, 'Meta'), { recursive: true });
    const librarySheet = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(`${SHEET_COLUMNS.join(';')}\nMovie;Heat (1995);Heat\n`),
    ]);
    writeFileSync(
      join(destination, 'Meta', 'familyflix-library.csv'),
      librarySheet
    );

    const outcome = await writeExport(
      createMedia(mediaPath),
      {
        format: 'csv',
        destination,
        images: false,
        subtitles: false,
        name: NAME,
      },
      {
        movies: [makeMovie({ id: 'heat', title: 'Heat', tmdbScore: 7.9 })],
        series: [],
        sourceFolders: new Map(),
      }
    );

    expect(outcome.kind).toBe('written');
    const bytes = readFileSync(
      join(destination, NAME, 'Meta', 'familyflix-library.csv')
    );
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const [header, ...rows] = bytes
      .subarray(3)
      .toString('utf8')
      .split(/\r?\n/)
      .filter((line) => line !== '');
    expect(header).toBe(SHEET_COLUMNS.join(','));
    expect(rows.find((line) => line.includes('Heat'))?.split(',')).toContain(
      '7.9'
    );
    // The Library sheet itself is left as it was.
    expect(
      readFileSync(join(destination, 'Meta', 'familyflix-library.csv')).equals(
        librarySheet
      )
    ).toBe(true);
  });
});
