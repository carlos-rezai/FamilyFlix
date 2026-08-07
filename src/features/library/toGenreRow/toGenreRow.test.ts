import { describe, it, expect } from 'vitest';

import { toGenreRow } from './toGenreRow';
import { view } from '../view/view';
import type { Movie } from '@/types';

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'm1',
    tmdbId: null,
    title: 'Comet Season',
    year: 2018,
    runtimeMinutes: 90,
    synopsis: null,
    director: null,
    cast: [],
    rating: 8,
    isFavorite: false,
    watched: false,
    resumePositionSeconds: 0,
    status: 'unwatched',
    videoPath: 'Comet Season/comet.mp4',
    posterPath: null,
    backdropPath: null,
    genres: [],
    subtitles: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('toGenreRow — HomeRow → GenreRowModel mapper', () => {
  it('passes the genre through untouched', () => {
    expect(toGenreRow({ genre: 'Action', count: 3, movies: [] }).genre).toBe(
      'Action'
    );
  });

  it('keeps the genre’s true total, not the number of movies in the row', () => {
    const row = toGenreRow({
      genre: 'Action',
      count: 214,
      movies: [makeMovie({ id: 'a1' }), makeMovie({ id: 'a2' })],
    });

    expect(row.count).toBe(214);
    expect(row.movies).toHaveLength(2);
  });

  it('maps every movie through the card view mapper, in order', () => {
    const movies = [
      makeMovie({ id: 'a1', title: 'Northwind' }),
      makeMovie({ id: 'a2', title: 'Ironclad' }),
    ];

    const row = toGenreRow({ genre: 'Action', count: 2, movies });

    expect(row.movies).toEqual(movies.map(view));
  });

  it('maps an empty row to an empty row', () => {
    expect(
      toGenreRow({ genre: 'Action', count: 0, movies: [] }).movies
    ).toEqual([]);
  });
});
