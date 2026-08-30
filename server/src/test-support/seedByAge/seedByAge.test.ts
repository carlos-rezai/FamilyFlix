// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { seedByAge } from './seedByAge';
import { freshStorage } from '../freshStorage/freshStorage';

describe('seedByAge — what it guarantees', () => {
  it('gives every movie a creation instant of its own, a day apart', () => {
    // This is the guarantee the helper exists for. Without it every
    // recently-added assertion in the suite is tie-dependent.
    const storage = freshStorage();

    seedByAge(storage, 3, (label) => ({ title: `Movie ${label}` }));

    const stamps = storage
      .listMovies({ sort: 'a-z' })
      .map((movie) => movie.createdAt);

    expect(new Set(stamps).size).toBe(3);
    expect([...stamps].sort()).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
    ]);
  });

  it('numbers movie 1 as the oldest and movie `count` as the newest', () => {
    const storage = freshStorage();

    seedByAge(storage, 3, (label) => ({ title: `Movie ${label}` }));

    expect(
      storage.listMovies({ sort: 'recently-added' }).map((m) => m.title)
    ).toEqual(['Movie 03', 'Movie 02', 'Movie 01']);
  });

  it('zero-pads the label so titles sort the same way A–Z as by age', () => {
    const storage = freshStorage();

    seedByAge(storage, 10, (label) => ({ title: `Movie ${label}` }));

    const byName = storage.listMovies({ sort: 'a-z' }).map((m) => m.title);

    expect(byName[0]).toBe('Movie 01');
    expect(byName[9]).toBe('Movie 10');
  });

  it('hands the rest of the record to `build`, not to a fixed shape', () => {
    const storage = freshStorage();

    seedByAge(storage, 2, (label) => ({
      title: `Loved ${label}`,
      isFavorite: true,
    }));

    expect(
      storage.listMovies({ sort: 'a-z' }).every((movie) => movie.isFavorite)
    ).toBe(true);
  });

  it('leaves real timers running for the test that called it', () => {
    const storage = freshStorage();

    seedByAge(storage, 1, () => ({}));

    // A helper that left fake timers installed would silently freeze whatever
    // the calling test did next.
    expect(Date.now()).toBeGreaterThan(Date.UTC(2026, 0, 2));
  });
});
