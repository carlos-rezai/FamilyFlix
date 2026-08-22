import { describe, it, expect } from 'vitest';

import { withFavorite, withFavoriteInList } from './withFavorite';
import type { GenreRowModel, PosterCardMovie } from '@/types';

function makeCard(overrides: Partial<PosterCardMovie> = {}): PosterCardMovie {
  return {
    id: 'm1',
    title: 'Comet Season',
    posterUrl: null,
    g1: '#111111',
    g2: '#222222',
    rating: 80,
    watched: false,
    progress: 0,
    favorite: false,
    ...overrides,
  };
}

/** The same movie tagged with two genres, plus a bystander in each row. */
function rows(): GenreRowModel[] {
  return [
    {
      genre: 'Action',
      count: 2,
      movies: [
        makeCard({ id: 'x1', title: 'Ironclad' }),
        makeCard({ id: 'a2', title: 'Northwind' }),
      ],
    },
    {
      genre: 'Thriller',
      count: 2,
      movies: [
        makeCard({ id: 't1', title: 'Quiet Harbor' }),
        makeCard({ id: 'x1', title: 'Ironclad' }),
      ],
    },
  ];
}

/** Whether one movie reads as a favorite in one genre's row. */
function favoriteIn(next: GenreRowModel[], genre: string, id: string) {
  return next
    .find((row) => row.genre === genre)
    ?.movies.find((movie) => movie.id === id)?.favorite;
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
function list(): PosterCardMovie[] {
  return [
    makeCard({ id: 'a1', title: 'Northwind' }),
    makeCard({ id: 'a2', title: 'Ironclad', favorite: true }),
    makeCard({ id: 'a3', title: 'Quiet Harbor' }),
  ];
}

/** Whether one movie reads as a favorite in a flat list. */
function favoriteOf(movies: PosterCardMovie[], id: string) {
  return movies.find((movie) => movie.id === id)?.favorite;
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
      rating: 80,
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
