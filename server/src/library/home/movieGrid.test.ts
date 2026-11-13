// @vitest-environment node
//
// 63, Row view, Phase 3 (issue #610): Movies as one grid.
//
// `getMovieGrid(query)` answers `MovieGridPayload`: the browse query uncapped
// in the caller's sort, genre-less movies included, and the continue section
// built as `getHome` builds it. Asserted through `LibraryStorage` over a real,
// fully migrated `:memory:` database, as `home.test.ts` is.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { seedByAge } from '../../test-support/seedByAge/seedByAge';
import { seedGenre } from '../../test-support/seedGenre/seedGenre';

afterEach(() => {
  vi.useRealTimers();
});

describe('library: getMovieGrid', () => {
  it('returns every movie, more than the 15 a home row carries', () => {
    const storage = freshStorage();
    seedGenre(storage, 'Drama', 20);

    const { movies } = storage.getMovieGrid({ sort: 'recently-added' });

    expect(movies).toHaveLength(20);
  });

  it('includes the movies with no genre', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Tagged', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Untagged', genres: [] }));

    const { movies } = storage.getMovieGrid({ sort: 'a-z' });

    expect(movies.map((m) => m.title)).toEqual(['Tagged', 'Untagged']);
  });

  it('comes back in the sort the query asked for', () => {
    const storage = freshStorage();
    seedByAge(storage, 3, (label) => ({ title: `Film ${label}` }));

    expect(
      storage.getMovieGrid({ sort: 'a-z' }).movies.map((m) => m.title)
    ).toEqual(['Film 01', 'Film 02', 'Film 03']);
    expect(
      storage
        .getMovieGrid({ sort: 'recently-added' })
        .movies.map((m) => m.title)
    ).toEqual(['Film 03', 'Film 02', 'Film 01']);
  });

  it('is narrowed by the search term', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Comic Caper' }));
    storage.addMovie(newMovie({ title: 'Weepie' }));

    const { movies } = storage.getMovieGrid({
      sort: 'recently-added',
      search: 'comic',
    });

    expect(movies.map((m) => m.title)).toEqual(['Comic Caper']);
  });

  it('is narrowed by the genre', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'A Comedy', genres: ['Comedy'] }));
    storage.addMovie(newMovie({ title: 'A Drama', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Untagged', genres: [] }));

    const { movies } = storage.getMovieGrid({
      sort: 'recently-added',
      genre: 'Drama',
    });

    expect(movies.map((m) => m.title)).toEqual(['A Drama']);
  });

  it('is narrowed by the rating minimum', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Adored', rating: 9 }));
    storage.addMovie(newMovie({ title: 'Liked', rating: 4 }));
    storage.addMovie(newMovie({ title: 'Unrated' }));

    const { movies } = storage.getMovieGrid({
      sort: 'recently-added',
      minRating: 8,
    });

    expect(movies.map((m) => m.title)).toEqual(['Adored']);
  });

  it('builds its continue section exactly as getHome builds it', () => {
    const storage = freshStorage();
    seedByAge(storage, 18, (label) => ({
      title: `Started ${label}`,
      genres: Number(label) % 2 === 0 ? ['Drama'] : [],
      rating: Number(label) % 3 === 0 ? 9 : 5,
      resumePositionSeconds: 600,
      lastWatchedAt: `2026-06-${label}T00:00:00.000Z`,
    }));
    storage.addMovie(newMovie({ title: 'Unstarted' }));

    for (const query of [
      { sort: 'a-z' as const },
      { sort: 'recently-added' as const, genre: 'Drama' },
      { sort: 'year' as const, minRating: 8 },
      { sort: 'a-z' as const, search: 'started 1' },
    ]) {
      expect(storage.getMovieGrid(query).continueWatching).toEqual(
        storage.getHome(query).continueWatching
      );
    }
    expect(
      storage.getMovieGrid({ sort: 'a-z' }).continueWatching.length
    ).toBeGreaterThan(0);
  });
});
