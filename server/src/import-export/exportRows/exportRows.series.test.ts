// @vitest-environment node
//
// 31 — Export options, Phase 2: series and episodes (issue #277).
//
// `exportRows(movies, series, include)` takes each series' detail beside the
// films. Series join the Titles table, merged A–Z with the films by title, and
// a second table, `tables.episodes`, carries every episode under
// `EXPORT_EPISODE_COLUMNS`, ordered by series A–Z, then season, then number.
//
// A series row: Type `Series`; Year its **Year range** (`2022`, `2019–2023`,
// `2021–`); Runtime blank; the creator under Director; Status off its
// episodes (all watched → `Watched`, none watched or started → `Unwatched`,
// anything else → `In progress`); its Seasons and Episodes counts; Favorite
// as the series heart. Still is blank until the images slice.
//
// A cell is compared as text — `''` for an empty one — as in the films' suite.

import { describe, expect, it } from 'vitest';

import {
  EXPORT_COLUMNS,
  EXPORT_EPISODE_COLUMNS,
  type Episode,
  type Movie,
  type Series,
  type SeriesDetail,
  type Subtitle,
  type WatchStatus,
} from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  makeEpisode,
  makeSeries,
  makeSeriesDetail,
} from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { exportRows } from './exportRows';

/** The nine Episodes columns, in the PRD's order. */
const EPISODE_HEADER = [
  'Series',
  'Season',
  'Episode',
  'Title',
  'Air date',
  'Runtime',
  'Status',
  'Subtitles',
  'Still',
];

const OFF = { images: false, subtitles: false };

const text = (cell: unknown): string =>
  cell === null || cell === undefined ? '' : String(cell);

const asText = (table: readonly (readonly unknown[])[]): string[][] =>
  table.map((row) => row.map(text));

/** A film, _Heat_ unless overridden. */
const film = (overrides: Partial<Movie> = {}): Movie =>
  makeMovie({ id: 'heat', title: 'Heat', year: 1995, ...overrides });

/** _Severance_, 2022–, its seasons' episodes by watch state. */
function show(
  seasons: WatchStatus[][] = [['unwatched', 'unwatched']],
  series: Partial<Series> = {}
): SeriesDetail {
  return makeSeriesDetail(seasons, {
    id: 'severance',
    title: 'Severance',
    year: 2022,
    endYear: null,
    ...series,
  });
}

/** The Titles table as text, header first. */
function titles(movies: Movie[], series: SeriesDetail[]): string[][] {
  return asText(exportRows(movies, series, OFF).tables.titles);
}

/** The Episodes table as text, header first. */
function episodes(series: SeriesDetail[], movies: Movie[] = []): string[][] {
  return asText(exportRows(movies, series, OFF).tables.episodes);
}

/** The one series' Titles row, by column name. */
function seriesRow(detail: SeriesDetail): Record<string, string> {
  const [header, row] = titles([], [detail]);
  return Object.fromEntries(
    header.map((name, index) => [name, row[index] ?? ''])
  );
}

/** An Episodes row, by column name. */
function episodeRowAt(
  series: SeriesDetail[],
  index: number
): Record<string, string> {
  const [header, ...rows] = episodes(series);
  return Object.fromEntries(
    header.map((name, column) => [name, rows[index]?.[column] ?? ''])
  );
}

const track = (language: string, position: number): Subtitle => ({
  id: `t${position}`,
  path: `severance-2022/season-01/${language}.srt`,
  language,
  position,
});

describe('EXPORT_EPISODE_COLUMNS', () => {
  it('spells the nine Episodes columns once, in the shared types', () => {
    expect([...EXPORT_EPISODE_COLUMNS]).toEqual(EPISODE_HEADER);
  });
});

describe('exportRows — films and series merged A–Z', () => {
  it('lists Heat and Severance in one A–Z Titles table', () => {
    const rows = titles([film()], [show()]);

    expect(rows[0]).toEqual([...EXPORT_COLUMNS]);
    expect(rows.slice(1).map((row) => [row[0], row[1]])).toEqual([
      ['Movie', 'Heat'],
      ['Series', 'Severance'],
    ]);
  });

  it('interleaves the two kinds by title, without regard to case', () => {
    const rows = titles(
      [
        film({ id: 'm1', title: 'Zephyr' }),
        film({ id: 'm2', title: 'Backwater' }),
      ],
      [
        show(undefined, { id: 's1', title: 'meridian Bay' }),
        show(undefined, { id: 's2', title: 'Arbor Hill' }),
      ]
    );

    expect(rows.slice(1).map((row) => row[1])).toEqual([
      'Arbor Hill',
      'Backwater',
      'meridian Bay',
      'Zephyr',
    ]);
  });

  it('writes every series row sixteen cells wide', () => {
    const rows = titles([film()], [show()]);

    expect(rows).toHaveLength(3);
    rows.forEach((row) => expect(row).toHaveLength(EXPORT_COLUMNS.length));
  });
});

describe('exportRows — every series cell rule', () => {
  it('writes every column of a fully populated series', () => {
    const detail = show([['watched', 'watched', 'watched'], ['unwatched']], {
      year: 2019,
      endYear: 2023,
      creator: 'Dan Erickson',
      cast: ['Adam Scott', 'Britt Lower'],
      synopsis: 'Office workers have their memories split.',
      rating: 9,
      isFavorite: true,
      genres: [
        { id: 'g1', name: 'Drama' },
        { id: 'g2', name: 'Sci-Fi' },
      ],
    });

    expect(seriesRow(detail)).toMatchObject({
      Type: 'Series',
      Title: 'Severance',
      Year: '2019–2023',
      Runtime: '',
      Genres: 'Drama, Sci-Fi',
      Director: 'Dan Erickson',
      Cast: 'Adam Scott, Britt Lower',
      Synopsis: 'Office workers have their memories split.',
      Rating: '9',
      Status: 'In progress',
      Favorite: 'Yes',
      Seasons: '2',
      Episodes: '4',
      Poster: '',
      Backdrop: '',
    });
  });

  it('types every series as Series', () => {
    expect(seriesRow(show()).Type).toBe('Series');
  });

  it.each([
    ['a run of one year', 2022, 2022, '2022'],
    ['a finished run', 2019, 2023, '2019–2023'],
    ['a run still open', 2021, null, '2021–'],
  ])('writes %s as its Year range, %s', (_, year, endYear, cell) => {
    expect(seriesRow(show(undefined, { year, endYear })).Year).toBe(cell);
  });

  it('leaves the Runtime blank, whatever its episodes run', () => {
    const detail = show([['unwatched']]);
    detail.seasons[0].episodes[0] = {
      ...detail.seasons[0].episodes[0],
      runtimeMinutes: 50,
    };

    expect(seriesRow(detail).Runtime).toBe('');
  });

  it('writes the creator under Director, and blank with none', () => {
    expect(
      seriesRow(show(undefined, { creator: 'Dan Erickson' })).Director
    ).toBe('Dan Erickson');
    expect(seriesRow(show(undefined, { creator: null })).Director).toBe('');
  });

  it('writes Favorite as Yes for a hearted series, and blank otherwise', () => {
    expect(seriesRow(show(undefined, { isFavorite: true })).Favorite).toBe(
      'Yes'
    );
    expect(seriesRow(show(undefined, { isFavorite: false })).Favorite).toBe('');
  });

  it('counts its seasons and its episodes across every season', () => {
    const row = seriesRow(
      show([
        ['unwatched', 'unwatched'],
        ['unwatched', 'unwatched', 'unwatched'],
        ['unwatched'],
      ])
    );

    expect(row.Seasons).toBe('3');
    expect(row.Episodes).toBe('6');
  });
});

describe('exportRows — a series’ Status, off its episodes', () => {
  it('is Watched when every episode is watched', () => {
    expect(seriesRow(show([['watched', 'watched'], ['watched']])).Status).toBe(
      'Watched'
    );
  });

  it('is Unwatched when none is watched or started', () => {
    expect(
      seriesRow(show([['unwatched', 'unwatched'], ['unwatched']])).Status
    ).toBe('Unwatched');
  });

  it('is In progress when some are watched and some are not', () => {
    expect(
      seriesRow(show([['watched', 'watched'], ['unwatched']])).Status
    ).toBe('In progress');
  });

  it('is In progress when one is started and none is watched', () => {
    expect(
      seriesRow(show([['unwatched', 'in-progress', 'unwatched']])).Status
    ).toBe('In progress');
  });
});

describe('exportRows — the Episodes table', () => {
  it('writes the nine-column episode header first', () => {
    expect(episodes([show()])[0]).toEqual(EPISODE_HEADER);
  });

  it('writes the header alone for a library with no series', () => {
    expect(episodes([], [film()])).toEqual([EPISODE_HEADER]);
  });

  it('writes one row per episode, nine cells wide, and none for a film', () => {
    const rows = episodes(
      [show([['unwatched', 'unwatched'], ['watched']])],
      [film()]
    );

    expect(rows).toHaveLength(4);
    rows.forEach((row) => expect(row).toHaveLength(EPISODE_HEADER.length));
  });

  it('writes every column of a populated episode, Still blank', () => {
    const detail = show([['unwatched', 'unwatched', 'in-progress']]);
    const third: Episode = {
      ...makeEpisode(1, 3, 'in-progress'),
      seriesId: 'severance',
      title: 'In Perpetuity',
      airDate: '2022-02-25',
      runtimeMinutes: 50,
      stillPath: 'severance-2022/season-01/s01e03.jpg',
      subtitles: [track('de', 1), track('en', 0)],
    };
    detail.seasons[0].episodes[2] = third;

    expect(episodeRowAt([detail], 2)).toEqual({
      Series: 'Severance',
      Season: '1',
      Episode: '3',
      Title: 'In Perpetuity',
      'Air date': '2022-02-25',
      Runtime: '50',
      Status: 'In progress',
      Subtitles: 'en, de',
      Still: '',
    });
  });

  it.each([
    ['watched', 'Watched'],
    ['in-progress', 'In progress'],
    ['unwatched', 'Unwatched'],
  ] as const)('writes a %s episode’s Status as “%s”', (status, cell) => {
    expect(episodeRowAt([show([[status]])], 0).Status).toBe(cell);
  });

  it('leaves an untitled, undated, untimed episode’s cells blank', () => {
    const row = episodeRowAt([show([['unwatched']])], 0);

    expect(row.Title).toBe('');
    expect(row['Air date']).toBe('');
    expect(row.Runtime).toBe('');
    expect(row.Subtitles).toBe('');
  });

  it('orders the episodes by season, then number, whatever order they came in', () => {
    const detail = show([
      ['unwatched', 'unwatched', 'unwatched'],
      ['unwatched', 'unwatched'],
    ]);
    const shuffled: SeriesDetail = {
      ...detail,
      seasons: [...detail.seasons].reverse().map((season) => ({
        ...season,
        episodes: [...season.episodes].reverse(),
      })),
    };

    const rows = episodes([shuffled]).slice(1);

    expect(rows.map((row) => [row[1], row[2]])).toEqual([
      ['1', '1'],
      ['1', '2'],
      ['1', '3'],
      ['2', '1'],
      ['2', '2'],
    ]);
  });

  it('orders the series A–Z, whatever order they came in', () => {
    const rows = episodes([
      show([['unwatched', 'unwatched']], { id: 'z', title: 'Zephyr Line' }),
      show([['unwatched']], { id: 'a', title: 'arbor Hill' }),
      show([['unwatched']], { id: 'm', title: 'Meridian Bay' }),
    ]).slice(1);

    expect(rows.map((row) => [row[0], row[1], row[2]])).toEqual([
      ['arbor Hill', '1', '1'],
      ['Meridian Bay', '1', '1'],
      ['Zephyr Line', '1', '1'],
      ['Zephyr Line', '1', '2'],
    ]);
  });

  it('writes each episode under its own series’ title', () => {
    const rows = episodes([
      show([['unwatched']], { id: 'b', title: 'Backwater' }),
      { ...show([['unwatched']]), series: makeSeries({ title: 'Tidewater' }) },
    ]).slice(1);

    expect(rows.map((row) => row[0])).toEqual(['Backwater', 'Tidewater']);
  });
});
