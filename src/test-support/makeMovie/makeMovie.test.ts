import { describe, it, expect } from 'vitest';

import { makeMovie } from './makeMovie';
import type { Movie } from '@/types';

/**
 * Every key `Movie` declares, written out by hand rather than derived from the
 * type — a type cannot be enumerated at runtime, and deriving this list from
 * the builder would only assert the builder against itself.
 */
const MOVIE_KEYS: Array<keyof Movie> = [
  'id',
  'tmdbId',
  'title',
  'year',
  'runtimeMinutes',
  'synopsis',
  'director',
  'cast',
  'rating',
  'isFavorite',
  'watched',
  'resumePositionSeconds',
  'status',
  'videoPath',
  'posterPath',
  'backdropPath',
  'genres',
  'subtitles',
  'createdAt',
  'updatedAt',
  'lastWatchedAt',
];

describe('makeMovie — the default record', () => {
  it('builds every field the type declares, none missing', () => {
    expect(Object.keys(makeMovie()).sort()).toEqual([...MOVIE_KEYS].sort());
  });

  it('builds nothing the type does not declare', () => {
    // A stray key would type-check away happily on a `Partial` spread and then
    // travel into twenty test files as a fixture nobody meant to write.
    for (const key of Object.keys(makeMovie())) {
      expect(MOVIE_KEYS).toContain(key);
    }
  });

  it('builds an unwatched movie, the ordinary case in the library', () => {
    const movie = makeMovie();

    expect(movie.status).toBe('unwatched');
    expect(movie.watched).toBe(false);
    expect(movie.resumePositionSeconds).toBe(0);
    expect(movie.lastWatchedAt).toBeNull();
  });

  it('builds the same record twice, with no shared arrays between them', () => {
    // Two callers holding one `cast` array is the kind of fixture bleed that
    // shows up as a test passing alone and failing in a suite.
    const first = makeMovie();
    const second = makeMovie();

    expect(first).toEqual(second);
    expect(first.cast).not.toBe(second.cast);
    expect(first.genres).not.toBe(second.genres);
    expect(first.subtitles).not.toBe(second.subtitles);
  });
});

describe('makeMovie — overrides', () => {
  it('replaces exactly the field named', () => {
    const movie = makeMovie({ title: 'Northwind' });

    expect(movie.title).toBe('Northwind');
    expect(movie).toEqual({ ...makeMovie(), title: 'Northwind' });
  });

  it('replaces several fields at once, leaving the rest at their defaults', () => {
    const movie = makeMovie({
      resumePositionSeconds: 600,
      status: 'in-progress',
    });

    expect(movie).toEqual({
      ...makeMovie(),
      resumePositionSeconds: 600,
      status: 'in-progress',
    });
  });

  it('lets an override write a null over a default that has a value', () => {
    expect(makeMovie({ rating: null }).rating).toBeNull();
  });
});
