// @vitest-environment node
//
// Phase 2 — the read path: row→model assembly and derived watch status (issue #3).
//
// These tests exercise a REAL in-memory SQLite database through the `library/`
// repository's public `LibraryStorage` interface — `getMovie` (and the `addMovie`
// used only to seed a row to read back). Nothing is mocked: the row→model
// assembly (ordered genres, parsed cast, ordered subtitles) and the derived
// status are all exercised for real, per the PRD's "real in-memory SQLite, not a
// mock" testing decision. A fresh, isolated `:memory:` DB is used per test.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';

// --- helpers -------------------------------------------------------------------

// --- tests ---------------------------------------------------------------------

describe('library: getMovie assembly', () => {
  it('assembles the full model: ordered genres, parsed cast, ordered subtitles', () => {
    const storage = freshStorage();

    const added = storage.addMovie(
      newMovie({
        tmdbId: 12345,
        year: 2018,
        runtimeMinutes: 121,
        synopsis: 'A storm chaser races an unnatural front.',
        director: 'Jane Roe',
        cast: ['Alice Stone', 'Bob Vance', 'Carol Lin'],
        rating: 8,
        isFavorite: true,
        posterPath: 'northwind/poster.jpg',
        backdropPath: 'northwind/backdrop.jpg',
        genres: ['Action', 'Sci-Fi', 'Thriller'],
        subtitles: [
          { path: 'Northwind (2018)/en.srt', language: 'English' },
          { path: 'Northwind (2018)/de.srt', language: 'German' },
        ],
      })
    );

    const got = storage.getMovie(added.id);
    expect(got).not.toBeNull();
    const movie = got as NonNullable<typeof got>;

    // Scalar metadata round-trips.
    expect(movie.title).toBe('Northwind');
    expect(movie.tmdbId).toBe(12345);
    expect(movie.year).toBe(2018);
    expect(movie.runtimeMinutes).toBe(121);
    expect(movie.director).toBe('Jane Roe');
    expect(movie.rating).toBe(8);
    expect(movie.isFavorite).toBe(true);
    expect(movie.videoPath).toBe('Northwind (2018)/northwind.mkv');
    expect(movie.posterPath).toBe('northwind/poster.jpg');
    expect(movie.backdropPath).toBe('northwind/backdrop.jpg');

    // Genres preserve input order (genres[0] = primary) and carry resolved ids.
    expect(movie.genres.map((g) => g.name)).toEqual([
      'Action',
      'Sci-Fi',
      'Thriller',
    ]);
    expect(movie.genres.every((g) => typeof g.id === 'string' && g.id)).toBe(
      true
    );

    // Cast is an ordered string[] (display order preserved).
    expect(movie.cast).toEqual(['Alice Stone', 'Bob Vance', 'Carol Lin']);

    // Subtitles attach in track order, with strictly-ascending positions.
    expect(movie.subtitles.map((s) => s.language)).toEqual([
      'English',
      'German',
    ]);
    expect(movie.subtitles.map((s) => s.path)).toEqual([
      'Northwind (2018)/en.srt',
      'Northwind (2018)/de.srt',
    ]);
    const positions = movie.subtitles.map((s) => s.position);
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(movie.subtitles.every((s) => typeof s.id === 'string' && s.id)).toBe(
      true
    );
  });

  it('returns null for an unknown id (does not throw)', () => {
    const storage = freshStorage();

    expect(() =>
      storage.getMovie('00000000-0000-4000-8000-000000000000')
    ).not.toThrow();
    expect(storage.getMovie('00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});

describe('library: derived watch status', () => {
  it("is 'unwatched' when not watched and resume position is 0", () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie());

    expect(added.watched).toBe(false);
    expect(added.resumePositionSeconds).toBe(0);
    expect(added.status).toBe('unwatched');
  });

  it("is 'in-progress' when resume position > 0 and not watched", () => {
    const storage = freshStorage();
    const added = storage.addMovie(
      newMovie({ resumePositionSeconds: 600, watched: false })
    );

    expect(added.status).toBe('in-progress');
  });

  it("is 'watched' when watched is set (regardless of resume position)", () => {
    const storage = freshStorage();
    const added = storage.addMovie(
      newMovie({ watched: true, resumePositionSeconds: 600 })
    );

    expect(added.status).toBe('watched');
  });
});
