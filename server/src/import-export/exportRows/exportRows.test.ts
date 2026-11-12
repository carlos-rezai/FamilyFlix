// @vitest-environment node
//
// 58, Folder layout, Phase 5 (issue #538): the one sheet's table.
//
// `exportRows(movies, series, cells)` answers one table, `table`: the
// `SHEET_COLUMNS` header, then a row per Movie, Series, Season and Episode,
// A to Z by **Folder key**, then season, then number. Every row carries its
// `Type` and its `Folder`; a Season row adds `Season`, an Episode row `Season`
// and `Episode`; a cell is blank where the type has no such field (log 58,
// Q13). The count columns are gone; `Air date`, `Runtime`, `TMDB rating`,
// `TMDB id` and `Favorite` are filled; resume positions, the Details state,
// the Still source and Import mode are never written.
//
// A cell is compared as text, `''` for an empty one.

import { describe, expect, it } from 'vitest';

import {
  ROW_TYPES,
  SHEET_COLUMNS,
  type Episode,
  type Movie,
  type SeriesDetail,
} from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { filePlan } from '../filePlan/filePlan';
import { exportRows, type LayoutPlace, type PathCells } from './exportRows';

const OFF = { images: false, subtitles: false };

const text = (cell: unknown): string =>
  cell === null || cell === undefined ? '' : String(cell);

/** The one table as text, header first. */
function table(
  movies: readonly Movie[],
  series: readonly SeriesDetail[]
): string[][] {
  return exportRows(movies, series, filePlan(OFF).cells, new Map()).table.map(
    (row) => row.map(text)
  );
}

/** Every row after the header, by column name. */
function rows(
  movies: readonly Movie[],
  series: readonly SeriesDetail[]
): Record<string, string>[] {
  const [header = [], ...body] = table(movies, series);
  return body.map((row) =>
    Object.fromEntries(header.map((name, index) => [name, row[index] ?? '']))
  );
}

/** A row's identity: its Type, Folder, Season and Episode cells. */
const identity = (row: Record<string, string>): string =>
  [row.Type, row.Folder, row.Season, row.Episode].join(' | ');

/** _Heat_ (1995), every field the sheet carries filled. */
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
  status: 'in-progress',
  watched: false,
  resumePositionSeconds: 4321,
  videoPath: 'heat-1995/Heat.1995.1080p.mkv',
  genres: [
    { id: 'g1', name: 'Crime' },
    { id: 'g2', name: 'Thriller' },
  ],
});

const AMELIE: Movie = makeMovie({
  id: 'amelie',
  title: 'Amelie',
  year: 2001,
  status: 'watched',
  watched: true,
  videoPath: 'amelie-2001/amelie.mp4',
});

const EXISTENZ: Movie = makeMovie({
  id: 'existenz',
  title: 'eXistenZ',
  year: 1999,
  videoPath: 'existenz-1999/existenz.mkv',
});

/** An episode with the fields an Episode row carries. */
const dressed = (episode: Episode): Episode => ({
  ...episode,
  title: `Episode ${episode.season}x${episode.number}`,
  airDate: `2022-0${episode.season}-1${episode.number}`,
  runtimeMinutes: 50 + episode.number,
  videoPath: `severance-2022/season-0${episode.season}/S0${episode.season}E0${episode.number}.mkv`,
  resumePositionSeconds: episode.status === 'in-progress' ? 777 : 0,
});

/**
 * _Severance_ (2022–): season 1 of two episodes, season 2 of one, each
 * season's episodes handed over in reverse and the seasons too, so the order
 * written is the sheet's own.
 */
const SEVERANCE: SeriesDetail = ((): SeriesDetail => {
  const detail = makeSeriesDetail([['watched', 'in-progress'], ['unwatched']], {
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
    genres: [{ id: 'g3', name: 'Drama' }],
  });
  return {
    ...detail,
    seasons: [...detail.seasons].reverse().map((season) => ({
      ...season,
      episodes: [...season.episodes].reverse().map(dressed),
    })),
  };
})();

describe('the Sheet columns and Row types', () => {
  it('spells the four row types once, in the shared types', () => {
    expect([...ROW_TYPES]).toEqual(['Movie', 'Series', 'Season', 'Episode']);
  });

  it('spells the twenty-two Sheet columns once, in order', () => {
    expect([...SHEET_COLUMNS]).toEqual([
      'Type',
      'Folder',
      'Season',
      'Episode',
      'Title',
      'Year',
      'Air date',
      'Runtime',
      'Genres',
      'Director',
      'Cast',
      'Synopsis',
      'Rating',
      'TMDB rating',
      'TMDB id',
      'Status',
      'Favorite',
      'Video',
      'Subtitles',
      'Poster',
      'Backdrop',
      'Still',
    ]);
  });
});

describe('exportRows: one table', () => {
  it('writes the Sheet columns as its header, whatever the options', () => {
    for (const include of [
      OFF,
      { images: true, subtitles: true },
      { images: true, subtitles: false },
    ]) {
      expect(
        exportRows([HEAT], [SEVERANCE], filePlan(include).cells, new Map())
          .table[0]
      ).toEqual([...SHEET_COLUMNS]);
    }
  });

  it('writes the header alone for a library of none', () => {
    expect(table([], [])).toEqual([[...SHEET_COLUMNS]]);
  });

  it('writes every row as wide as the header', () => {
    for (const row of table([HEAT, AMELIE], [SEVERANCE])) {
      expect(row).toHaveLength(SHEET_COLUMNS.length);
    }
  });

  it('writes a Movie, Series, Season and Episode row in one table', () => {
    expect(new Set(rows([HEAT], [SEVERANCE]).map((row) => row.Type))).toEqual(
      new Set(['Movie', 'Series', 'Season', 'Episode'])
    );
  });
});

describe('exportRows: the order', () => {
  it('runs A to Z by Folder key, then season, then number', () => {
    expect(rows([HEAT, EXISTENZ, AMELIE], [SEVERANCE]).map(identity)).toEqual([
      'Movie | Amelie (2001) |  | ',
      'Movie | eXistenZ (1999) |  | ',
      'Movie | Heat (1995) |  | ',
      'Series | Severance (2022) |  | ',
      'Season | Severance (2022) | 1 | ',
      'Episode | Severance (2022) | 1 | 1',
      'Episode | Severance (2022) | 1 | 2',
      'Season | Severance (2022) | 2 | ',
      'Episode | Severance (2022) | 2 | 1',
    ]);
  });

  it('sorts by the Folder key, not the title alone', () => {
    const later = makeMovie({
      id: 'heat-remake',
      title: 'Heat',
      year: 2030,
      videoPath: 'heat-2030/heat.mkv',
    });

    expect(rows([later, HEAT], []).map((row) => row.Folder)).toEqual([
      'Heat (1995)',
      'Heat (2030)',
    ]);
  });
});

describe('exportRows: a Movie row', () => {
  it('fills every column a film has, and leaves the rest blank', () => {
    const [heat] = rows([HEAT], []);

    expect(heat).toEqual({
      Type: 'Movie',
      Folder: 'Heat (1995)',
      Season: '',
      Episode: '',
      Title: 'Heat',
      Year: '1995',
      'Air date': '',
      Runtime: '170',
      Genres: 'Crime, Thriller',
      Director: 'Michael Mann',
      Cast: 'Al Pacino, Robert De Niro',
      Synopsis: 'A thief and a detective.',
      Rating: '9',
      'TMDB rating': '7.9',
      'TMDB id': '949',
      Status: 'In progress',
      Favorite: 'Yes',
      Video: 'Heat (1995)/Heat.1995.1080p.mkv',
      Subtitles: '',
      Poster: '',
      Backdrop: '',
      Still: '',
    });
  });

  it('writes each watch state’s word under Status', () => {
    const statuses = rows([HEAT, AMELIE, EXISTENZ], []).map((row) => [
      row.Folder,
      row.Status,
    ]);

    expect(statuses).toEqual([
      ['Amelie (2001)', 'Watched'],
      ['eXistenZ (1999)', 'Unwatched'],
      ['Heat (1995)', 'In progress'],
    ]);
  });

  it('leaves Favorite, TMDB rating and TMDB id blank when not held', () => {
    const [amelie] = rows([AMELIE], []);

    expect([
      amelie?.Favorite,
      amelie?.['TMDB rating'],
      amelie?.['TMDB id'],
    ]).toEqual(['', '', '']);
  });
});

describe('exportRows: a Series row', () => {
  it('fills a series’ columns, and leaves blank what its rows derive', () => {
    const series = rows([], [SEVERANCE]).find((row) => row.Type === 'Series');

    expect(series).toEqual({
      Type: 'Series',
      Folder: 'Severance (2022)',
      Season: '',
      Episode: '',
      Title: 'Severance',
      Year: '2022–',
      'Air date': '',
      Runtime: '',
      Genres: 'Drama',
      Director: 'Dan Erickson',
      Cast: 'Adam Scott, Britt Lower',
      Synopsis: 'Work and life, severed.',
      Rating: '8',
      'TMDB rating': '8.4',
      'TMDB id': '95396',
      Status: '',
      Favorite: 'Yes',
      Video: '',
      Subtitles: '',
      Poster: '',
      Backdrop: '',
      Still: '',
    });
  });
});

describe('exportRows: a Season row', () => {
  it('carries its Type, Folder and Season, and nothing else with no poster', () => {
    const season = rows([], [SEVERANCE]).find(
      (row) => row.Type === 'Season' && row.Season === '2'
    );

    expect(season).toEqual(
      Object.fromEntries(
        SHEET_COLUMNS.map((column) => [
          column,
          { Type: 'Season', Folder: 'Severance (2022)', Season: '2' }[
            column as 'Type' | 'Folder' | 'Season'
          ] ?? '',
        ])
      )
    );
  });
});

describe('exportRows: an Episode row', () => {
  it('fills an episode’s columns, and leaves the rest blank', () => {
    const episode = rows([], [SEVERANCE]).find(
      (row) =>
        row.Type === 'Episode' && row.Season === '1' && row.Episode === '2'
    );

    expect(episode).toEqual({
      Type: 'Episode',
      Folder: 'Severance (2022)',
      Season: '1',
      Episode: '2',
      Title: 'Episode 1x2',
      Year: '',
      'Air date': '2022-01-12',
      Runtime: '52',
      Genres: '',
      Director: '',
      Cast: '',
      Synopsis: '',
      Rating: '',
      'TMDB rating': '',
      'TMDB id': '',
      Status: 'In progress',
      Favorite: '',
      Video: 'Severance (2022)/Season 01/S01E02.mkv',
      Subtitles: '',
      Poster: '',
      Backdrop: '',
      Still: '',
    });
  });
});

describe('exportRows: what the sheet leaves out', () => {
  it('has no count columns and no bookkeeping columns', () => {
    const [header = []] = table([HEAT], [SEVERANCE]);

    for (const gone of [
      'Seasons',
      'Episodes',
      'Resume',
      'Resume position',
      'Details',
      'Still source',
      'Import mode',
    ]) {
      expect(header).not.toContain(gone);
    }
  });

  it('writes no resume position into any cell', () => {
    const cells = table([HEAT], [SEVERANCE]).flat();

    expect(cells).not.toContain('4321');
    expect(cells).not.toContain('777');
  });
});

// 59, Rebuild whole, Phase 5 (issue #552): `exportRows(movies, series, cells)`
// takes its path cells from the **Path cells** it is given, keyed by **Layout
// place**, not by spelled path: the Export hands it its **File plan**, the
// Library sheet its **Layout read**. Each path cell is what `cells` answers
// for that row's place.
describe('exportRows: the path cells it is given', () => {
  /** A place spelled out, so a fake's answer names the place it was asked. */
  function label(place: LayoutPlace): string {
    switch (place.kind) {
      case 'poster':
      case 'backdrop':
        return `${place.kind} of ${place.folder}`;
      case 'season-poster':
        return `poster of ${place.folder} season ${place.season}`;
      case 'still':
        return `still of ${place.folder} ${place.season}x${place.episode}`;
      case 'tracks':
        return `tracks of ${place.folder} ${place.season ?? '-'}x${place.episode ?? '-'}`;
      case 'video':
        return `video of ${place.folder} ${place.season ?? '-'} ${place.sourceFile ?? '-'}`;
    }
  }

  /** A fake `PathCells`: each cell its place's label and the stored path. */
  const FAKE: PathCells = {
    image: (place, storedPath) =>
      storedPath === null ? null : `${label(place)} <- ${storedPath}`,
    tracks: (place, subtitles) =>
      subtitles.map((subtitle) => `${label(place)} <- ${subtitle.path}`),
    video: (place, storedPath) =>
      storedPath ? `${label(place)} <- ${storedPath}` : null,
  };

  const FILM: Movie = makeMovie({
    id: 'heat',
    title: 'Heat',
    year: 1995,
    videoPath: 'heat-1995/heat.mkv',
    posterPath: 'heat-1995/poster.jpg',
    backdropPath: 'heat-1995/fanart.jpg',
    subtitles: [
      {
        id: 'h1',
        path: 'heat-1995/heat.en.srt',
        language: 'English',
        position: 0,
      },
    ],
  });

  /** _Severance_: S01E01 dressed with every file, held at a Source file. */
  const SHOW: SeriesDetail = ((): SeriesDetail => {
    const detail = makeSeriesDetail([['unwatched']], {
      id: 'severance',
      title: 'Severance',
      year: 2022,
      endYear: null,
      posterPath: 'severance-2022/poster.jpg',
      backdropPath: 'severance-2022/backdrop.jpg',
    });
    return {
      ...detail,
      seasons: detail.seasons.map((season) => ({
        ...season,
        posterPath: 'severance-2022/s1/poster.jpg',
        episodes: season.episodes.map((episode) => ({
          ...episode,
          videoPath: 'severance-2022/s1/e1.mkv',
          sourceFile: 'season 01/e1.mkv',
          stillPath: 'severance-2022/s1/still.jpg',
          subtitles: [
            {
              id: 'e1',
              path: 'severance-2022/s1/e1.en.srt',
              language: 'English',
              position: 0,
            },
          ],
        })),
      })),
    };
  })();

  /** The rows by column name, read through the fake. */
  function faked(): Record<string, string>[] {
    const [header = [], ...body] = exportRows(
      [FILM],
      [SHOW],
      FAKE,
      new Map()
    ).table;
    return body.map((row) =>
      Object.fromEntries(
        header.map((name, index) => [text(name), text(row[index])])
      )
    );
  }

  const pathCells = (row: Record<string, string> | undefined) => ({
    Video: row?.Video,
    Subtitles: row?.Subtitles,
    Poster: row?.Poster,
    Backdrop: row?.Backdrop,
    Still: row?.Still,
  });

  it('fills a Movie row’s path cells with what the cells answer for its places', () => {
    const film = faked().find((row) => row.Type === 'Movie');

    expect(pathCells(film)).toEqual({
      Video: 'video of Heat (1995) - - <- heat-1995/heat.mkv',
      Subtitles: 'tracks of Heat (1995) -x- <- heat-1995/heat.en.srt',
      Poster: 'poster of Heat (1995) <- heat-1995/poster.jpg',
      Backdrop: 'backdrop of Heat (1995) <- heat-1995/fanart.jpg',
      Still: '',
    });
  });

  it('fills a Series and a Season row’s image cells with what the cells answer', () => {
    const rows = faked();

    expect(pathCells(rows.find((row) => row.Type === 'Series'))).toEqual({
      Video: '',
      Subtitles: '',
      Poster: 'poster of Severance (2022) <- severance-2022/poster.jpg',
      Backdrop: 'backdrop of Severance (2022) <- severance-2022/backdrop.jpg',
      Still: '',
    });
    expect(pathCells(rows.find((row) => row.Type === 'Season'))).toEqual({
      Video: '',
      Subtitles: '',
      Poster:
        'poster of Severance (2022) season 1 <- severance-2022/s1/poster.jpg',
      Backdrop: '',
      Still: '',
    });
  });

  it('fills an Episode row’s path cells with what the cells answer, its video place carrying its Source file', () => {
    const episode = faked().find((row) => row.Type === 'Episode');

    expect(pathCells(episode)).toEqual({
      Video:
        'video of Severance (2022) 1 season 01/e1.mkv <- severance-2022/s1/e1.mkv',
      Subtitles:
        'tracks of Severance (2022) 1x1 <- severance-2022/s1/e1.en.srt',
      Poster: '',
      Backdrop: '',
      Still: 'still of Severance (2022) 1x1 <- severance-2022/s1/still.jpg',
    });
  });
});

// 61, Export round trip, Phase 5 (issue #586): `claimFolder` folds NFC, then
// lower case, so two Source folder keys spelling one name composed and
// decomposed are numbered as one key.
describe('exportRows: two keys differing only in NFC and NFD', () => {
  /** `Amélie (2001)` composed (NFC). */
  const NFC = 'Am\u00e9lie (2001)';
  /** `Amélie (2001)` decomposed (NFD). */
  const NFD = 'Ame\u0301lie (2001)';

  const SOURCE = new Map([
    ['composed', NFC],
    ['decomposed', NFD],
  ]);

  const exported = exportRows(
    [
      makeMovie({ id: 'composed', title: 'Amelie', year: 2001 }),
      makeMovie({ id: 'decomposed', title: 'Amelie', year: 2001 }),
    ],
    [],
    filePlan(OFF).cells,
    SOURCE
  );

  /** The Folder cell of each Movie row. */
  const folders = ((): string[] => {
    const [header = [], ...body] = exported.table.map((row) => row.map(text));
    const column = header.indexOf('Folder');
    return body.map((row) => row[column] ?? '');
  })();

  it('numbers the second as (1), as one key', () => {
    expect(folders).toHaveLength(2);
    expect(folders.filter((folder) => folder.endsWith(' (1)'))).toHaveLength(1);
  });

  it('logs one Warning line for the shared key', () => {
    expect(exported.warnings).toHaveLength(1);
    expect(exported.warnings[0]).toMatch(/^⚠ Two titles share the folder /);
  });
});
