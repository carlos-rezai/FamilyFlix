import { describe, it, expect } from 'vitest';

import { toGenreRow } from './toGenreRow';
import { view } from '../../view/view';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';

describe('toGenreRow — HomeRow → GenreRowModel mapper', () => {
  it('passes the genre through untouched', () => {
    expect(
      toGenreRow({ genre: 'Action', count: 3, movies: [] }, true).genre
    ).toBe('Action');
  });

  it('keeps the genre’s true total, not the number of movies in the row', () => {
    const row = toGenreRow(
      {
        genre: 'Action',
        count: 214,
        movies: [makeMovie({ id: 'a1' }), makeMovie({ id: 'a2' })],
      },
      true
    );

    expect(row.count).toBe(214);
    expect(row.movies).toHaveLength(2);
  });

  it('maps every movie through the card view mapper, in order', () => {
    const movies = [
      makeMovie({ id: 'a1', title: 'Northwind' }),
      makeMovie({ id: 'a2', title: 'Ironclad' }),
    ];

    const row = toGenreRow({ genre: 'Action', count: 2, movies }, true);

    expect(row.movies).toEqual(movies.map((movie) => view(movie, true)));
  });

  it('hands the preference on to the card view mapper', () => {
    const movies = [makeMovie({ id: 'a1', rating: null, tmdbScore: 7.4 })];

    const row = toGenreRow({ genre: 'Action', count: 1, movies }, false);

    expect(row.movies).toEqual(movies.map((movie) => view(movie, false)));
  });

  it('maps an empty row to an empty row', () => {
    expect(
      toGenreRow({ genre: 'Action', count: 0, movies: [] }, true).movies
    ).toEqual([]);
  });
});
