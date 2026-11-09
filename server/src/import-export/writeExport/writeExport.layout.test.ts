// @vitest-environment node
//
// 58, Folder layout, Phase 5 (issue #538): the Export writes the layout and
// the one sheet.
//
// `writeExport` makes an **Export folder** that is the **Folder layout**
// less the videos (log 58, Q19): `Meta/familyflix-library.<csv|xlsx>`
// whatever the **Export name**, and a Title folder per title carrying
// something, each file in its layout place, named as the **Layout fill**
// names it. The sheet carries every row of the library; a path cell names
// the file that travelled, `Video` where the video goes, and a cell is blank
// when its file did not travel. Two titles sharing a **Folder key** are
// numbered with a Warning line, and nothing outside the new folder is
// written.
//
// Over a sandbox and a real `createMedia`, the stored files written into the
// media root by hand; asserted as the tree and bytes on disk, the sheet's
// cells and the outcome's value.

import ExcelJS from 'exceljs';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { SHEET_COLUMNS } from '@/types';
import type { Episode, Movie, SeriesDetail, StartExport } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { writeExport } from './writeExport';

const NAME = 'familyflix-collection_08-11-2026';

/** Each stored file and the bytes it holds, the videos among them. */
const STORED: Record<string, string> = {
  'heat-1995/Heat.1995.1080p.mkv': 'heat video',
  'heat-1995/poster.jpg': 'heat poster',
  'heat-1995/fanart.png': 'heat backdrop',
  'heat-1995/heat.en.srt': 'heat english',
  'severance-2022/poster.jpg': 'severance poster',
  'severance-2022/season-01/poster.jpg': 'severance season 1 poster',
  'severance-2022/season-01/e1.mkv': 'severance video 1',
  'severance-2022/season-01/e2.mkv': 'severance video 2',
  'severance-2022/stills/s1e1.jpg': 'severance still 1',
  'severance-2022/season-01/e1.en.srt': 'severance english',
};

const HEAT: Movie = makeMovie({
  id: 'heat',
  title: 'Heat',
  year: 1995,
  videoPath: 'heat-1995/Heat.1995.1080p.mkv',
  posterPath: 'heat-1995/poster.jpg',
  backdropPath: 'heat-1995/fanart.png',
  subtitles: [
    {
      id: 'heat-en',
      path: 'heat-1995/heat.en.srt',
      language: 'English',
      position: 0,
    },
  ],
});

const SEVERANCE: SeriesDetail = ((): SeriesDetail => {
  const detail = makeSeriesDetail([['watched', 'unwatched']], {
    id: 'severance',
    title: 'Severance',
    year: 2022,
    endYear: null,
    posterPath: 'severance-2022/poster.jpg',
  });
  const stored = (episode: Episode): Episode => ({
    ...episode,
    videoPath: `severance-2022/season-01/e${episode.number}.mkv`,
    stillPath: episode.number === 1 ? 'severance-2022/stills/s1e1.jpg' : null,
    subtitles:
      episode.number === 1
        ? [
            {
              id: 'sev-e1-en',
              path: 'severance-2022/season-01/e1.en.srt',
              language: 'English',
              position: 0,
            },
          ]
        : [],
  });
  return {
    ...detail,
    seasons: detail.seasons.map((season) => ({
      ...season,
      posterPath: 'severance-2022/season-01/poster.jpg',
      episodes: season.episodes.map(stored),
    })),
  };
})();

const CONTENT = { movies: [HEAT], series: [SEVERANCE] };

interface Sandbox {
  media: Media;
  dir: string;
  mediaPath: string;
  destination: string;
}

/** A media root holding {@link STORED}, and an empty destination beside it. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-write-export-layout-');
  const mediaPath = join(dir, 'media');
  const destination = join(dir, 'Backups');
  mkdirSync(mediaPath);
  mkdirSync(destination);
  for (const [stored, bytes] of Object.entries(STORED)) {
    const file = join(mediaPath, ...stored.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  return { media: createMedia(mediaPath), dir, mediaPath, destination };
}

const request = (
  destination: string,
  overrides: Partial<StartExport> = {}
): StartExport => ({
  format: 'csv',
  destination,
  images: true,
  subtitles: true,
  name: NAME,
  ...overrides,
});

/** Every file under a folder, by its forward-slash path relative to it, and its text. */
function tree(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else {
        files[relative(root, path).split(sep).join('/')] = readFileSync(
          path,
          'utf8'
        );
      }
    }
  };
  walk(root);
  return files;
}

const text = (cell: unknown): string => {
  if (typeof cell === 'object' && cell !== null && 'text' in cell) {
    return String((cell as { text: unknown }).text);
  }
  return cell === null || cell === undefined ? '' : String(cell);
};

/** The sheet's rows by column name, header dropped, read as csv or xlsx. */
async function sheetRows(
  path: string,
  format: 'csv' | 'xlsx'
): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  if (format === 'xlsx') {
    await workbook.xlsx.load(readFileSync(path) as unknown as ArrayBuffer);
  } else {
    await workbook.csv.read(
      Readable.from([readFileSync(path, 'utf8').replace(/^\uFEFF/, '')]),
      { map: (value: string) => value }
    );
  }
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

const find = (
  rows: Record<string, string>[],
  type: string,
  season = '',
  episode = ''
): Record<string, string> | undefined =>
  rows.find(
    (row) =>
      row.Type === type && row.Season === season && row.Episode === episode
  );

describe('writeExport: the Export folder mirrors the layout less the videos', () => {
  it('writes every file in its layout place, and no video', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), CONTENT);

    const files = tree(join(destination, NAME));
    delete files['Meta/familyflix-library.csv'];
    expect(files).toEqual({
      'Heat (1995)/Images/poster.jpg': 'heat poster',
      'Heat (1995)/Images/backdrop.png': 'heat backdrop',
      'Heat (1995)/Subtitles/English.srt': 'heat english',
      'Severance (2022)/Images/poster.jpg': 'severance poster',
      'Severance (2022)/Season 01/Images/poster.jpg':
        'severance season 1 poster',
      'Severance (2022)/Season 01/Images/Stills/S01E01.jpg':
        'severance still 1',
      'Severance (2022)/Season 01/Subtitles/S01E01/English.srt':
        'severance english',
    });
  });

  it('writes only the sheet in Meta with both toggles off', async () => {
    const { media, destination } = sandbox();

    await writeExport(
      media,
      request(destination, { images: false, subtitles: false }),
      CONTENT
    );

    expect(Object.keys(tree(join(destination, NAME)))).toEqual([
      'Meta/familyflix-library.csv',
    ]);
  });
});

describe('writeExport: the sheet in Meta', () => {
  it.each(['csv', 'xlsx'] as const)(
    'is Meta/familyflix-library.%s whatever the Export name',
    async (format) => {
      const { media, destination } = sandbox();

      await writeExport(
        media,
        request(destination, { format, name: 'Family films' }),
        CONTENT
      );

      const folder = join(destination, 'Family films');
      expect(readdirSync(join(folder, 'Meta'))).toEqual([
        `familyflix-library.${format}`,
      ]);
      expect(readdirSync(folder)).not.toContain(`Family films.${format}`);
    }
  );

  it('is one worksheet named Library as xlsx', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination, { format: 'xlsx' }), CONTENT);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      readFileSync(
        join(destination, NAME, 'Meta', 'familyflix-library.xlsx')
      ) as unknown as ArrayBuffer
    );
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Library']);
  });

  it('is one csv file behind its BOM', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), CONTENT);

    const bytes = readFileSync(
      join(destination, NAME, 'Meta', 'familyflix-library.csv')
    );
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('carries every row of the library, each path cell naming its file in the Export', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), CONTENT);

    const rows = await sheetRows(
      join(destination, NAME, 'Meta', 'familyflix-library.csv'),
      'csv'
    );
    expect(rows.map((row) => row.Type)).toEqual([
      'Movie',
      'Series',
      'Season',
      'Episode',
      'Episode',
    ]);
    expect(find(rows, 'Movie')).toMatchObject({
      Folder: 'Heat (1995)',
      Video: 'Heat (1995)/Heat.1995.1080p.mkv',
      Poster: 'Heat (1995)/Images/poster.jpg',
      Backdrop: 'Heat (1995)/Images/backdrop.png',
      Subtitles: 'Heat (1995)/Subtitles/English.srt',
    });
    expect(find(rows, 'Season', '1')?.Poster).toBe(
      'Severance (2022)/Season 01/Images/poster.jpg'
    );
    expect(find(rows, 'Episode', '1', '1')).toMatchObject({
      Video: 'Severance (2022)/Season 01/e1.mkv',
      Still: 'Severance (2022)/Season 01/Images/Stills/S01E01.jpg',
      Subtitles: 'Severance (2022)/Season 01/Subtitles/S01E01/English.srt',
    });
  });

  it('names in its path cells only files that are there, Video aside', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), CONTENT);

    const folder = join(destination, NAME);
    const files = new Set(Object.keys(tree(folder)));
    const rows = await sheetRows(
      join(folder, 'Meta', 'familyflix-library.csv'),
      'csv'
    );
    const named = rows.flatMap((row) =>
      [row.Subtitles, row.Poster, row.Backdrop, row.Still]
        .flatMap((cell) => (cell ?? '').split('|'))
        .filter((path) => path !== '')
    );
    expect(named.length).toBeGreaterThan(0);
    for (const path of named) {
      expect(files).toContain(path);
    }
  });

  it('blanks a cell whose file did not travel, and keeps the rest', async () => {
    const { media, destination } = sandbox();
    // Heat's poster is recorded, but no such file is in managed storage.
    const gone = { ...HEAT, posterPath: 'heat-1995/missing-poster.jpg' };

    await writeExport(media, request(destination), {
      movies: [gone],
      series: [SEVERANCE],
    });

    const rows = await sheetRows(
      join(destination, NAME, 'Meta', 'familyflix-library.csv'),
      'csv'
    );
    expect(find(rows, 'Movie')?.Poster).toBe('');
    expect(find(rows, 'Movie')?.Backdrop).toBe(
      'Heat (1995)/Images/backdrop.png'
    );
  });
});

describe('writeExport: two titles sharing a Folder key', () => {
  const OTHER_HEAT: Movie = makeMovie({
    id: 'heat-tv-cut',
    title: 'Heat',
    year: 1995,
    videoPath: 'heat-tv/heat-tv.mkv',
    posterPath: 'heat-1995/fanart.png',
  });

  it('numbers the second Title folder apart', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), {
      movies: [HEAT, OTHER_HEAT],
      series: [],
    });

    expect(readdirSync(join(destination, NAME)).sort()).toEqual(
      ['Heat (1995)', 'Heat (1995) (1)', 'Meta'].sort()
    );
  });

  it('answers written with one Warning line naming the numbered folder', async () => {
    const { media, destination } = sandbox();

    const outcome = await writeExport(media, request(destination), {
      movies: [HEAT, OTHER_HEAT],
      series: [],
    });

    expect(outcome.kind).toBe('written');
    const warnings = outcome.kind === 'written' ? outcome.warnings : [];
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Heat (1995) (1)');
  });

  it('answers no Warning line when every Folder key is its own', async () => {
    const { media, destination } = sandbox();

    const outcome = await writeExport(media, request(destination), CONTENT);

    expect(outcome).toMatchObject({ kind: 'written', warnings: [] });
  });
});

describe('writeExport: nothing outside the new Export folder is written', () => {
  it('leaves the destination with the new folder alone beside what was there', async () => {
    const { media, destination, dir, mediaPath } = sandbox();
    writeFileSync(join(destination, 'kept.txt'), 'kept');
    const before = tree(mediaPath);

    await writeExport(media, request(destination), CONTENT);

    expect(readdirSync(destination).sort()).toEqual([NAME, 'kept.txt'].sort());
    expect(readFileSync(join(destination, 'kept.txt'), 'utf8')).toBe('kept');
    expect(tree(mediaPath)).toEqual(before);
    expect(readdirSync(dir).sort()).toEqual(['Backups', 'media']);
  });

  it('makes a taken name’s folder apart and leaves the first as it was', async () => {
    const { media, destination } = sandbox();
    mkdirSync(join(destination, NAME));
    writeFileSync(join(destination, NAME, 'kept.txt'), 'kept');

    const outcome = await writeExport(media, request(destination), CONTENT);

    expect(outcome).toMatchObject({
      kind: 'written',
      folder: join(destination, `${NAME} (1)`),
    });
    expect(tree(join(destination, NAME))).toEqual({ 'kept.txt': 'kept' });
  });
});
