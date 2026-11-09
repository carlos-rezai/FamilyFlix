// @vitest-environment node
//
// 58, Folder layout, Phase 6 (issue #539): the one sheet read back.
//
// `readSheet` reads the one table, every **Row type**, into **Sheet rows**
// carrying their new fields: `type`, `folder`, `season`, `episode`,
// `airDate`, `runtime`, `tmdbScore`, `tmdbId`, `favorite`, `video`,
// `subtitles`, `poster`, `backdrop` and `still`. A path cell is read as the
// sheet spells it, relative and with forward slashes, several tracks split on
// `|`; the matcher resolves it. A sheet with no `Type` column reads every row
// as a Movie; with no `Folder` column, or a blank cell, `folder` is the
// **Folder key** spelled `Title (Year)` from the row's Title and Year.
//
// The round trip is the library itself: `exportRows` and `writeSheet` write
// the one sheet, in CSV and xlsx, and the reader must hand back every field.
// The fixtures' `library.csv` and `library.xlsx` are the one sheet too.

import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  EXPORT_FORMATS,
  SHEET_COLUMNS,
  type Movie,
  type SeriesDetail,
} from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { exportRows } from '../exportRows/exportRows';
import { filePlan } from '../filePlan/filePlan';
import { writeSheet } from '../writeSheet/writeSheet';
import { isTitleRow, readSheet, type SheetRow } from './readSheet';

/** The film fixture's sheet pair. */
const FILM_FIXTURE = fileURLToPath(
  new URL('../createImporter/fixture/', import.meta.url)
);

/** The series fixture's sheet pair. */
const SERIES_FIXTURE = fileURLToPath(
  new URL('../createImporter/seriesFixture/', import.meta.url)
);

/** A sheet typed in place, as the bytes a CSV file would hold. */
const csv = (lines: string[]): Buffer =>
  Buffer.from(`${lines.join('\n')}\n`, 'utf8');

/** _Heat_ (1995), every field a Movie row carries filled. */
const HEAT: Movie = makeMovie({
  id: 'heat',
  tmdbId: 949,
  title: 'Heat',
  year: 1995,
  runtimeMinutes: 170,
  synopsis: 'A thief and a detective.',
  director: 'Michael Mann',
  cast: ['Al Pacino', 'Robert De Niro'],
  rating: 9,
  tmdbScore: 7.9,
  isFavorite: true,
  status: 'watched',
  watched: true,
  videoPath: 'heat-1995/Heat.1995.1080p.mkv',
  posterPath: 'heat-1995/poster.jpg',
  backdropPath: 'heat-1995/backdrop.jpg',
  subtitles: [
    { id: 't1', path: 'heat-1995/heat.en.srt', language: 'en', position: 0 },
    { id: 't2', path: 'heat-1995/heat.nl.srt', language: 'nl', position: 1 },
  ],
  genres: [
    { id: 'g1', name: 'Crime' },
    { id: 'g2', name: 'Thriller' },
  ],
});

/**
 * _Severance_ (2022–): one season of two episodes, the first watched, with a
 * Still and a track; a series poster and a season poster.
 */
const SEVERANCE: SeriesDetail = ((): SeriesDetail => {
  const detail = makeSeriesDetail([['watched', 'unwatched']], {
    id: 'severance',
    tmdbId: 95396,
    title: 'Severance',
    year: 2022,
    endYear: null,
    creator: 'Dan Erickson',
    cast: ['Adam Scott', 'Britt Lower'],
    synopsis: 'Work and life, severed.',
    rating: 8,
    tmdbScore: 8.4,
    isFavorite: true,
    posterPath: 'severance-2022/poster.jpg',
    genres: [{ id: 'g3', name: 'Drama' }],
  });
  const [season] = detail.seasons;
  const [first, second] = season.episodes;
  return {
    ...detail,
    seasons: [
      {
        ...season,
        posterPath: 'severance-2022/season-01/poster.jpg',
        episodes: [
          {
            ...first,
            title: 'Good News About Hell',
            airDate: '2022-02-18',
            runtimeMinutes: 57,
            videoPath: 'severance-2022/season-01/S01E01.mkv',
            stillPath: 'severance-2022/stills/s01e01.jpg',
            subtitles: [
              {
                id: 't3',
                path: 'severance-2022/s01e01.en.srt',
                language: 'en',
                position: 0,
              },
            ],
          },
          {
            ...second,
            title: 'Half Loop',
            airDate: '2022-02-25',
            runtimeMinutes: 53,
            videoPath: 'severance-2022/season-01/S01E02.mkv',
          },
        ],
      },
    ],
  };
})();

/** The fields no row of a type carries, as the reader answers them. */
const BLANK = {
  season: null,
  episode: null,
  year: null,
  endYear: null,
  airDate: null,
  runtime: null,
  genres: [],
  director: null,
  cast: [],
  synopsis: null,
  rating: null,
  tmdbScore: null,
  tmdbId: null,
  watched: false,
  favorite: false,
  video: null,
  subtitles: [],
  poster: null,
  backdrop: null,
  still: null,
};

const HEAT_ROW: SheetRow = {
  ...BLANK,
  type: 'Movie',
  folder: 'Heat (1995)',
  title: 'Heat',
  year: 1995,
  endYear: 1995,
  runtime: 170,
  genres: ['Crime', 'Thriller'],
  director: 'Michael Mann',
  cast: ['Al Pacino', 'Robert De Niro'],
  synopsis: 'A thief and a detective.',
  rating: 9,
  tmdbScore: 7.9,
  tmdbId: 949,
  watched: true,
  favorite: true,
  video: 'Heat (1995)/Heat.1995.1080p.mkv',
  subtitles: ['Heat (1995)/Subtitles/en.srt', 'Heat (1995)/Subtitles/nl.srt'],
  poster: 'Heat (1995)/Images/poster.jpg',
  backdrop: 'Heat (1995)/Images/backdrop.jpg',
};

const SEVERANCE_ROW: SheetRow = {
  ...BLANK,
  type: 'Series',
  folder: 'Severance (2022)',
  title: 'Severance',
  year: 2022,
  endYear: null,
  genres: ['Drama'],
  director: 'Dan Erickson',
  cast: ['Adam Scott', 'Britt Lower'],
  synopsis: 'Work and life, severed.',
  rating: 8,
  tmdbScore: 8.4,
  tmdbId: 95396,
  favorite: true,
  poster: 'Severance (2022)/Images/poster.jpg',
};

const EPISODE_ROWS: SheetRow[] = [
  {
    ...BLANK,
    type: 'Episode',
    folder: 'Severance (2022)',
    season: 1,
    episode: 1,
    title: 'Good News About Hell',
    airDate: '2022-02-18',
    runtime: 57,
    watched: true,
    video: 'Severance (2022)/Season 01/S01E01.mkv',
    subtitles: ['Severance (2022)/Season 01/Subtitles/S01E01/en.srt'],
    still: 'Severance (2022)/Season 01/Images/Stills/S01E01.jpg',
  },
  {
    ...BLANK,
    type: 'Episode',
    folder: 'Severance (2022)',
    season: 1,
    episode: 2,
    title: 'Half Loop',
    airDate: '2022-02-25',
    runtime: 53,
    video: 'Severance (2022)/Season 01/S01E02.mkv',
  },
];

describe.each([...EXPORT_FORMATS])(
  'readSheet: the round trip from the library (%s)',
  (format) => {
    /** The library written as the one sheet, then read back. */
    async function roundTrip(): Promise<{
      rows: SheetRow[];
      blank: number[];
      written: number;
    }> {
      const { table } = exportRows(
        [HEAT],
        [SEVERANCE],
        filePlan({ images: true, subtitles: true }).cells
      );
      const bytes = await writeSheet(table, format);
      const blank: number[] = [];
      const rows = await readSheet(bytes, `library.${format}`, (row) =>
        blank.push(row)
      );
      return { rows, blank, written: table.length - 1 };
    }

    it('reads every row the sheet holds, a Season row with no title among them', async () => {
      const { rows, blank, written } = await roundTrip();

      expect(rows).toHaveLength(written);
      expect(blank).toEqual([]);
      expect(rows.map((row) => row.type)).toEqual([
        'Movie',
        'Series',
        'Season',
        'Episode',
        'Episode',
      ]);
    });

    it('keeps every field of a Movie row', async () => {
      const { rows } = await roundTrip();

      expect(rows[0]).toEqual(HEAT_ROW);
    });

    it('keeps every field of a Series row, its open range as no last year', async () => {
      const { rows } = await roundTrip();

      expect(rows[1]).toEqual(SEVERANCE_ROW);
    });

    it('keeps a Season row’s Folder key, number and poster', async () => {
      const { rows } = await roundTrip();

      expect(rows[2]).toEqual(
        expect.objectContaining({
          type: 'Season',
          folder: 'Severance (2022)',
          season: 1,
          episode: null,
          video: null,
          subtitles: [],
          poster: 'Severance (2022)/Season 01/Images/poster.jpg',
          backdrop: null,
          still: null,
        })
      );
    });

    it('keeps every field of the Episode rows', async () => {
      const { rows } = await roundTrip();

      expect(rows.slice(3)).toEqual(EPISODE_ROWS);
    });
  }
);

describe('readSheet: a sheet with no Type column', () => {
  it('reads every row as a Movie', async () => {
    const rows = await readSheet(
      csv(['Title,Year', 'Heat,1995', 'Amélie,2001']),
      'library.csv'
    );

    expect(rows.map((row) => row.type)).toEqual(['Movie', 'Movie']);
  });

  it('reads a blank Type cell as a Movie too', async () => {
    const rows = await readSheet(
      csv(['Type,Folder,Title,Year', ',Heat (1995),Heat,1995']),
      'library.csv'
    );

    expect(rows[0].type).toBe('Movie');
  });
});

describe('isTitleRow: a row that names a title', () => {
  it('answers true for a Movie and a Series row, false for a Season and an Episode row', async () => {
    const rows = await readSheet(
      csv([
        'Type,Folder,Season,Episode,Title,Year',
        'Movie,Heat (1995),,,Heat,1995',
        'Series,Tidewater (2018),,,Tidewater,2018',
        'Season,Tidewater (2018),1,,,',
        'Episode,Tidewater (2018),1,1,Pilot,',
      ]),
      'library.csv'
    );

    expect(rows.map((row) => [row.type, isTitleRow(row)])).toEqual([
      ['Movie', true],
      ['Series', true],
      ['Season', false],
      ['Episode', false],
    ]);
  });
});

describe('readSheet: the Folder cell', () => {
  it('reads the Folder cell as the row’s Folder key, whatever the title', async () => {
    const rows = await readSheet(
      csv([
        'Type,Folder,Title,Year',
        'Movie,Amelie (2001),Le Fabuleux Destin d’Amélie Poulain,2001',
      ]),
      'library.csv'
    );

    expect(rows[0]).toMatchObject({
      folder: 'Amelie (2001)',
      title: 'Le Fabuleux Destin d’Amélie Poulain',
    });
  });

  it('spells Title (Year) when the sheet has no Folder column', async () => {
    const rows = await readSheet(
      csv(['Title,Year', 'Heat,1995']),
      'library.csv'
    );

    expect(rows[0].folder).toBe('Heat (1995)');
  });

  it('spells Title (Year) for a blank Folder cell', async () => {
    const rows = await readSheet(
      csv(['Type,Folder,Title,Year', 'Movie,,Heat,1995']),
      'library.csv'
    );

    expect(rows[0].folder).toBe('Heat (1995)');
  });

  it('spells a series’ key from its first year when its Year cell is a range', async () => {
    const rows = await readSheet(
      csv(['Type,Title,Year', 'Series,Severance,2022–']),
      'library.csv'
    );

    expect(rows[0]).toMatchObject({
      type: 'Series',
      folder: 'Severance (2022)',
    });
  });
});

// --- the fixtures ------------------------------------------------------------

/** A fixture sheet's header row, as text, whichever its format. */
async function headerOf(dir: string, name: string): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  if (name.endsWith('.xlsx')) {
    await workbook.xlsx.load(
      readFileSync(join(dir, name)) as unknown as ArrayBuffer
    );
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Library']);
  } else {
    const text = readFileSync(join(dir, name), 'utf8').replace(/^\uFEFF/, '');
    return text.split(/\r?\n/)[0].split(',');
  }
  const header: string[] = [];
  workbook.worksheets[0].getRow(1).eachCell((cell) => {
    header.push(String(cell.value));
  });
  return header;
}

/** A fixture sheet read through the reader. */
const fixtureRows = (dir: string, name: string): Promise<SheetRow[]> =>
  readSheet(readFileSync(join(dir, name)), name);

/** A row's identity: its type, Folder key, season and episode. */
const identity = (row: SheetRow): string =>
  [row.type, row.folder, row.season ?? '', row.episode ?? ''].join(' | ');

describe.each([['library.csv'], ['library.xlsx']])(
  'readSheet: the fixtures’ %s is the one sheet',
  (name) => {
    it('carries the Sheet columns as its header, in the film fixture', async () => {
      expect(await headerOf(FILM_FIXTURE, name)).toEqual([...SHEET_COLUMNS]);
    });

    it('carries the Sheet columns as its header, in the series fixture', async () => {
      expect(await headerOf(SERIES_FIXTURE, name)).toEqual([...SHEET_COLUMNS]);
    });

    it('reads the film fixture as two Movie rows keyed by their folders', async () => {
      const rows = await fixtureRows(FILM_FIXTURE, name);

      expect(rows.map(identity)).toEqual([
        'Movie | Amelie (2001) |  | ',
        'Movie | Die Hard (1988) |  | ',
      ]);
    });

    it('reads the series fixture as each series, its season and its episodes', async () => {
      const rows = await fixtureRows(SERIES_FIXTURE, name);

      expect(rows.map(identity)).toEqual([
        'Series | Harbor & Vine (2021) |  | ',
        'Season | Harbor & Vine (2021) | 1 | ',
        'Episode | Harbor & Vine (2021) | 1 | 1',
        'Episode | Harbor & Vine (2021) | 1 | 2',
        'Series | Tidewater (2018) |  | ',
        'Season | Tidewater (2018) | 1 | ',
        'Episode | Tidewater (2018) | 1 | 1',
        'Episode | Tidewater (2018) | 1 | 2',
      ]);
    });

    it('gives every Episode row of the series fixture its title and air date', async () => {
      const episodes = (await fixtureRows(SERIES_FIXTURE, name)).filter(
        (row) => row.type === 'Episode'
      );

      expect(episodes).toHaveLength(4);
      for (const episode of episodes) {
        expect(episode.title).not.toBe('');
        expect(episode.airDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  }
);
