// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { seedGenre } from './seedGenre';
import { freshStorage } from '../freshStorage/freshStorage';

describe('seedGenre', () => {
  it('tags every movie it adds with the genre asked for', () => {
    const storage = freshStorage();

    seedGenre(storage, 'Drama', 3);

    expect(
      storage
        .listMovies({ sort: 'a-z' })
        .map((movie) => movie.genres.map((genre) => genre.name))
    ).toEqual([['Drama'], ['Drama'], ['Drama']]);
  });

  it('titles them from the genre, oldest first, zero-padded', () => {
    const storage = freshStorage();

    seedGenre(storage, 'Horror', 2);

    expect(
      storage.listMovies({ sort: 'recently-added' }).map((m) => m.title)
    ).toEqual(['Horror 02', 'Horror 01']);
  });

  it('inherits the distinct creation instants seedByAge guarantees', () => {
    const storage = freshStorage();

    seedGenre(storage, 'Action', 3);

    const stamps = storage.listMovies({ sort: 'a-z' }).map((m) => m.createdAt);

    expect(new Set(stamps).size).toBe(3);
  });

  it('leaves other genres empty', () => {
    const storage = freshStorage();

    seedGenre(storage, 'Comedy', 2);

    expect(storage.listGenres().map((genre) => genre.name)).toEqual(['Comedy']);
  });
});
