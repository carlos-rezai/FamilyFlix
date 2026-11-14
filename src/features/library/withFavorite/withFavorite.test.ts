import { describe, it, expect } from 'vitest';

import { withFavorite, withFavoriteInList, withShelved } from './withFavorite';
import type { HomeRow, Movie, Series } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';

/** The same movie tagged with two genres, plus a bystander in each row. */
function rows(): HomeRow[] {
  return [
    {
      genre: 'Action',
      count: 2,
      movies: [
        makeMovie({ id: 'x1', title: 'Ironclad' }),
        makeMovie({ id: 'a2', title: 'Northwind' }),
      ],
    },
    {
      genre: 'Thriller',
      count: 2,
      movies: [
        makeMovie({ id: 't1', title: 'Quiet Harbor' }),
        makeMovie({ id: 'x1', title: 'Ironclad' }),
      ],
    },
  ];
}

/** Whether one movie reads as a favorite in one genre's row. */
function favoriteIn(next: HomeRow[], genre: string, id: string) {
  return next
    .find((row) => row.genre === genre)
    ?.movies.find((movie) => movie.id === id)?.isFavorite;
}

describe('withFavorite', () => {
  it('sets the flag in every row the movie appears in', () => {
    const next = withFavorite(rows(), 'x1', true);

    expect(favoriteIn(next, 'Action', 'x1')).toBe(true);
    expect(favoriteIn(next, 'Thriller', 'x1')).toBe(true);
  });

  it('clears the flag in every row the movie appears in', () => {
    const filled = withFavorite(rows(), 'x1', true);

    const next = withFavorite(filled, 'x1', false);

    expect(favoriteIn(next, 'Action', 'x1')).toBe(false);
    expect(favoriteIn(next, 'Thriller', 'x1')).toBe(false);
  });

  it('leaves every other movie alone', () => {
    const next = withFavorite(rows(), 'x1', true);

    expect(favoriteIn(next, 'Action', 'a2')).toBe(false);
    expect(favoriteIn(next, 'Thriller', 't1')).toBe(false);
  });

  it('leaves the genre and its true total untouched', () => {
    const next = withFavorite(rows(), 'x1', true);

    expect(next.map((row) => row.genre)).toEqual(['Action', 'Thriller']);
    expect(next.map((row) => row.count)).toEqual([2, 2]);
  });

  it('does not mutate the rows it is given', () => {
    const before = rows();

    withFavorite(before, 'x1', true);

    expect(favoriteIn(before, 'Action', 'x1')).toBe(false);
    expect(favoriteIn(before, 'Thriller', 'x1')).toBe(false);
  });

  it('is a no-op for a movie that is in no row', () => {
    const before = rows();

    expect(withFavorite(before, 'nope', true)).toEqual(before);
  });
});

/**
 * A genre page's worth of cards — one flat list, no rows around it, with one
 * of them already a favorite so both directions have something to move.
 */
function list(): Movie[] {
  return [
    makeMovie({ id: 'a1', title: 'Northwind' }),
    makeMovie({ id: 'a2', title: 'Ironclad', isFavorite: true }),
    makeMovie({ id: 'a3', title: 'Quiet Harbor' }),
  ];
}

/** Whether one movie reads as a favorite in a flat list. */
function favoriteOf(movies: Movie[], id: string) {
  return movies.find((movie) => movie.id === id)?.isFavorite;
}

describe('withFavoriteInList', () => {
  it('sets the flag on the movie whose id matches', () => {
    const next = withFavoriteInList(list(), 'a1', true);

    expect(favoriteOf(next, 'a1')).toBe(true);
  });

  it('clears the flag on the movie whose id matches', () => {
    const next = withFavoriteInList(list(), 'a2', false);

    expect(favoriteOf(next, 'a2')).toBe(false);
  });

  it('leaves every other movie alone', () => {
    const next = withFavoriteInList(list(), 'a1', true);

    expect(favoriteOf(next, 'a2')).toBe(true);
    expect(favoriteOf(next, 'a3')).toBe(false);
  });

  it('keeps the list it was given, in its order and at its length', () => {
    // The grid is the server's answer; a heart never adds, drops or reorders a
    // card in it.
    const next = withFavoriteInList(list(), 'a1', true);

    expect(next.map((movie) => movie.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('leaves the rest of the matched movie untouched', () => {
    const next = withFavoriteInList(list(), 'a1', true);

    expect(next[0]).toMatchObject({
      id: 'a1',
      title: 'Northwind',
      rating: 8,
      watched: false,
    });
  });

  it('does not mutate the list it is given', () => {
    // An optimistic value must be appliable and revertable from the same source
    // list, so nothing here may write through it.
    const before = list();

    withFavoriteInList(before, 'a1', true);

    expect(favoriteOf(before, 'a1')).toBe(false);
  });

  it('is a no-op for a movie that is not in the list', () => {
    const before = list();

    expect(withFavoriteInList(before, 'nope', true)).toEqual(before);
  });
});

/** A series record, every field the type asks for, the given ones over it. */
function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 's1',
    tmdbId: null,
    title: 'Harbor & Vine',
    year: 2021,
    endYear: null,
    synopsis: null,
    creator: null,
    cast: [],
    rating: null,
    isFavorite: false,
    posterPath: null,
    backdropPath: null,
    originalTitle: null,
    tmdbScore: null,
    genres: [],
    watched: false,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('withFavoriteInList: a series', () => {
  it('sets the flag on the series whose id matches, the rest untouched', () => {
    const next = withFavoriteInList(
      [makeSeries({ id: 's1' }), makeSeries({ id: 's2', title: 'Tidewater' })],
      's2',
      true
    );

    expect(next.map((series) => series.isFavorite)).toEqual([false, true]);
    expect(next[1].title).toBe('Tidewater');
  });
});

describe('withShelved', () => {
  it('flips a movie the shelf already holds, adding nothing', () => {
    const shelf = [makeMovie({ id: 'a2', isFavorite: true })];

    const next = withShelved(shelf, list(), 'a2', false);

    expect(next.map((movie) => [movie.id, movie.isFavorite])).toEqual([
      ['a2', false],
    ]);
  });

  it('puts a newly hearted movie at the shelf’s front, from the records', () => {
    const shelf = [makeMovie({ id: 'a2', isFavorite: true })];

    const next = withShelved(shelf, list(), 'a1', true);

    expect(next.map((movie) => movie.id)).toEqual(['a1', 'a2']);
    expect(next[0]).toMatchObject({ title: 'Northwind', isFavorite: true });
  });

  it('shelves nothing for a heart on a title none of the records carries', () => {
    const shelf = [makeMovie({ id: 'a2', isFavorite: true })];

    expect(withShelved(shelf, list(), 'nope', true)).toEqual(shelf);
  });

  it('puts a newly hearted series at the shelf’s front, from the records', () => {
    const shelf = [makeSeries({ id: 's1', isFavorite: true })];
    const records = [makeSeries({ id: 's2', title: 'Tidewater' })];

    const next = withShelved(shelf, records, 's2', true);

    expect(next.map((series) => [series.id, series.isFavorite])).toEqual([
      ['s2', true],
      ['s1', true],
    ]);
  });
});
