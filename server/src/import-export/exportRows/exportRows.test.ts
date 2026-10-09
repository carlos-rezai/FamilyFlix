// @vitest-environment node
//
// 31 — Export options, Phase 1: "the tracer" (issue #276).
//
// `exportRows(movies, series, include)` — the deep module of the initiative:
// the library in, the tables an **Export** is written from out. Every cell
// rule lives here, moved out of the **Sheet writer**, and is spelled once.
// Phase 1 is films only: the Titles table's sixteen columns, A–Z, with Seasons
// and Episodes blank (a film has neither) and Poster and Backdrop blank
// (Images arrives in Phase 3). Every column is written whatever the options.
//
// The Titles table is read here as `tables.titles`: its first row is the
// header, and each row after it one title. A cell is compared as text — `''`
// for an empty one — so a test about a rule is not also a test about whether
// a blank is `null` or `''`.

import { describe, expect, it } from 'vitest';

import { EXPORT_COLUMNS, type Movie, type Subtitle } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { exportRows } from './exportRows';

/** The sixteen Titles columns, in the PRD's order. */
const HEADER = [
  'Type',
  'Title',
  'Year',
  'Runtime',
  'Genres',
  'Director',
  'Cast',
  'Synopsis',
  'Rating',
  'Status',
  'Favorite',
  'Seasons',
  'Episodes',
  'Subtitles',
  'Poster',
  'Backdrop',
];

const OFF = { images: false, subtitles: false };
const ON = { images: true, subtitles: true };

/** A subtitle track at a position, for the order the Subtitles cell keeps. */
const track = (language: string, position: number): Subtitle => ({
  id: `s${position}`,
  path: `Die Hard (1988)/${language}.srt`,
  language,
  position,
});

/** One film with every exported column populated. */
function fullMovie(overrides: Partial<Movie> = {}): Movie {
  return makeMovie({
    id: 'm1',
    title: 'Die Hard',
    year: 1988,
    runtimeMinutes: 132,
    synopsis:
      'A New York cop takes on a tower full of thieves on Christmas Eve.',
    director: 'John McTiernan',
    cast: ['Bruce Willis', 'Alan Rickman'],
    rating: 8,
    isFavorite: true,
    watched: true,
    status: 'watched',
    videoPath: 'Die Hard (1988)/die-hard.mkv',
    posterPath: 'Die Hard (1988)/poster.jpg',
    backdropPath: 'Die Hard (1988)/backdrop.png',
    genres: [
      { id: 'g1', name: 'Action' },
      { id: 'g2', name: 'Thriller' },
    ],
    subtitles: [track('en', 0), track('de', 1)],
    ...overrides,
  });
}

const text = (cell: unknown): string =>
  cell === null || cell === undefined ? '' : String(cell);

/** The Titles table as text, header first. */
function titles(movies: Movie[], include = OFF): string[][] {
  const { tables } = exportRows(movies, [], include);
  return tables.titles.map((row: readonly unknown[]) => row.map(text));
}

/** The one film's row, by column name. */
function rowOf(movie: Movie, include = OFF): Record<string, string> {
  const [header, row] = titles([movie], include);
  return Object.fromEntries(
    header.map((name, index) => [name, row[index] ?? ''])
  );
}

describe('exportRows — the Titles header', () => {
  it('spells the sixteen columns once, in the shared types', () => {
    expect([...EXPORT_COLUMNS]).toEqual(HEADER);
  });

  it('writes the sixteen-column header first', () => {
    expect(titles([fullMovie()])[0]).toEqual(HEADER);
  });

  it('writes the header alone for a library of none', () => {
    expect(titles([])).toEqual([HEADER]);
  });

  it('writes every column of every row, sixteen cells wide', () => {
    const rows = titles([
      fullMovie(),
      fullMovie({ id: 'm2', title: 'Amélie' }),
    ]);

    expect(rows).toHaveLength(3);
    rows.forEach((row) => expect(row).toHaveLength(HEADER.length));
  });
});

describe('exportRows — the order', () => {
  it('sorts the films A–Z by title, whatever order they came in', () => {
    const rows = titles([
      fullMovie({ id: 'm1', title: 'Zephyr' }),
      fullMovie({ id: 'm2', title: 'Backwater' }),
      fullMovie({ id: 'm3', title: 'Meridian' }),
    ]);

    expect(rows.slice(1).map((row) => row[1])).toEqual([
      'Backwater',
      'Meridian',
      'Zephyr',
    ]);
  });

  it('sorts without regard to case', () => {
    const rows = titles([
      fullMovie({ id: 'm1', title: 'Zephyr' }),
      fullMovie({ id: 'm2', title: 'apple Grove' }),
      fullMovie({ id: 'm3', title: 'Backwater' }),
    ]);

    expect(rows.slice(1).map((row) => row[1])).toEqual([
      'apple Grove',
      'Backwater',
      'Zephyr',
    ]);
  });
});

describe('exportRows — every film cell rule', () => {
  it('writes every column of a fully populated film', () => {
    expect(rowOf(fullMovie())).toEqual({
      Type: 'Movie',
      Title: 'Die Hard',
      Year: '1988',
      Runtime: '132',
      Genres: 'Action, Thriller',
      Director: 'John McTiernan',
      Cast: 'Bruce Willis, Alan Rickman',
      Synopsis:
        'A New York cop takes on a tower full of thieves on Christmas Eve.',
      Rating: '8',
      Status: 'Watched',
      Favorite: 'Yes',
      Seasons: '',
      Episodes: '',
      Subtitles: 'en, de',
      Poster: '',
      Backdrop: '',
    });
  });

  it('types every film as Movie', () => {
    expect(rowOf(fullMovie()).Type).toBe('Movie');
  });

  it('writes the title as stored', () => {
    expect(rowOf(fullMovie({ title: '  Die.Hard  ' })).Title).toBe(
      '  Die.Hard  '
    );
  });

  it('writes the runtime in minutes, and leaves an unknown one blank', () => {
    expect(rowOf(fullMovie({ runtimeMinutes: 97 })).Runtime).toBe('97');
    expect(rowOf(fullMovie({ runtimeMinutes: null })).Runtime).toBe('');
  });

  it('leaves a null year, director, synopsis and rating blank', () => {
    const row = rowOf(
      fullMovie({ year: null, director: null, synopsis: null, rating: null })
    );

    expect(row.Year).toBe('');
    expect(row.Director).toBe('');
    expect(row.Synopsis).toBe('');
    expect(row.Rating).toBe('');
  });

  it('joins the genres with a comma and a space, in stored order', () => {
    const row = rowOf(
      fullMovie({
        genres: [
          { id: 'g2', name: 'Thriller' },
          { id: 'g1', name: 'Action' },
          { id: 'g3', name: 'Comedy' },
        ],
      })
    );

    expect(row.Genres).toBe('Thriller, Action, Comedy');
    expect(rowOf(fullMovie({ genres: [] })).Genres).toBe('');
  });

  it('joins the cast with a comma and a space, in stored order', () => {
    const row = rowOf(
      fullMovie({ cast: ['Alan Rickman', 'Bruce Willis', 'Bonnie Bedelia'] })
    );

    expect(row.Cast).toBe('Alan Rickman, Bruce Willis, Bonnie Bedelia');
    expect(rowOf(fullMovie({ cast: [] })).Cast).toBe('');
  });

  it('writes the synopsis as stored', () => {
    expect(
      rowOf(fullMovie({ synopsis: 'Short, and "quoted".' })).Synopsis
    ).toBe('Short, and "quoted".');
  });

  it('writes the rating as the stored value', () => {
    expect(rowOf(fullMovie({ rating: 10 })).Rating).toBe('10');
    expect(rowOf(fullMovie({ rating: 0 })).Rating).toBe('0');
    expect(rowOf(fullMovie({ rating: 7 })).Rating).toBe('7');
  });

  it.each([
    ['watched', 'Watched'],
    ['in-progress', 'In progress'],
    ['unwatched', 'Unwatched'],
  ] as const)('writes the %s state as “%s”', (status, cell) => {
    const row = rowOf(
      fullMovie({
        status,
        watched: status === 'watched',
        resumePositionSeconds: status === 'in-progress' ? 600 : 0,
      })
    );

    expect(row.Status).toBe(cell);
  });

  it('writes Favorite as Yes for a hearted film, and blank otherwise', () => {
    expect(rowOf(fullMovie({ isFavorite: true })).Favorite).toBe('Yes');
    expect(rowOf(fullMovie({ isFavorite: false })).Favorite).toBe('');
  });

  it('leaves Seasons and Episodes blank for a film', () => {
    const row = rowOf(fullMovie());

    expect(row.Seasons).toBe('');
    expect(row.Episodes).toBe('');
  });

  it('joins the subtitle languages in track order, not stored order', () => {
    const row = rowOf(
      fullMovie({ subtitles: [track('fr', 2), track('en', 0), track('de', 1)] })
    );

    expect(row.Subtitles).toBe('en, de, fr');
    expect(rowOf(fullMovie({ subtitles: [] })).Subtitles).toBe('');
  });
});

describe('exportRows — Poster and Backdrop', () => {
  it('leaves Poster and Backdrop blank for a film with art', () => {
    const row = rowOf(fullMovie());

    expect(row.Poster).toBe('');
    expect(row.Backdrop).toBe('');
  });

  it('leaves Poster and Backdrop blank for a film with none', () => {
    const row = rowOf(fullMovie({ posterPath: null, backdropPath: null }));

    expect(row.Poster).toBe('');
    expect(row.Backdrop).toBe('');
  });
});

describe('exportRows — every column whatever the options', () => {
  it('writes the same sixteen-column header with every option on', () => {
    expect(titles([fullMovie()], ON)[0]).toEqual(HEADER);
  });

  it('writes the same sixteen-column header with every option off', () => {
    expect(titles([fullMovie()], OFF)[0]).toEqual(HEADER);
  });

  it('writes the subtitle languages with the subtitles option off', () => {
    expect(rowOf(fullMovie(), OFF).Subtitles).toBe('en, de');
  });

  it('never writes the video path, in any cell', () => {
    const cells = titles([fullMovie()], ON).flat().join('\n');

    expect(cells).not.toContain('die-hard.mkv');
  });
});
