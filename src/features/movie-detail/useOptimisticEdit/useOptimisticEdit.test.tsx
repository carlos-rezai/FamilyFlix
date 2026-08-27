import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import type { MovieDetailModel } from '@/types';
import { useOptimisticEdit } from './useOptimisticEdit';

/** A save the test resolves itself, so "not yet answered" is a state to assert in. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Only the fields the three real edits touch matter here; the rest is inert. */
function aMovie(over: Partial<MovieDetailModel> = {}): MovieDetailModel {
  return {
    id: 'm1',
    title: 'Northwind',
    year: 2019,
    runtimeLabel: '2h 8m',
    ratingPercent: 80,
    isWatched: false,
    isFavorite: false,
    playLabel: 'Resume · 52:00',
    genres: ['Drama'],
    synopsis: null,
    hasCredits: false,
    director: '—',
    castText: '—',
    posterUrl: null,
    backdropUrl: null,
    hasArtwork: false,
    g1: '#000',
    g2: '#111',
    topTag: null,
    ...over,
  };
}

/**
 * The `editMovie` guard the hook must route through, wired to a real object so a
 * test can read what the page would be showing at any point.
 */
function screenHolding(movie: MovieDetailModel) {
  const held = { movie };
  const editMovie = (update: (movie: MovieDetailModel) => MovieDetailModel) => {
    held.movie = update(held.movie);
  };
  return { held, editMovie };
}

/** The rating edit: a captured value that may be `null`, restored as itself. */
function withRating(movie: MovieDetailModel, percent: number | null) {
  return { ...movie, ratingPercent: percent };
}

/** The favorite edit: a captured flag, restored as itself. */
function withFavorite(movie: MovieDetailModel, favorite: boolean) {
  return { ...movie, isFavorite: favorite };
}

describe('useOptimisticEdit', () => {
  it('shows the new value before the save has answered', () => {
    const { held, editMovie } = screenHolding(aMovie({ ratingPercent: 80 }));
    const pending = deferred<number | null>();
    const { result } = renderHook(() =>
      useOptimisticEdit(held.movie, editMovie)
    );

    act(() =>
      result.current({
        next: 30,
        capture: (movie) => movie.ratingPercent,
        apply: withRating,
        restore: withRating,
        save: () => pending.promise,
      })
    );

    expect(held.movie.ratingPercent).toBe(30);
  });

  it('leaves the shown value alone when the route echoes what was assumed', async () => {
    const { held, editMovie } = screenHolding(aMovie({ ratingPercent: 80 }));
    const apply = vi.fn(withRating);
    const { result } = renderHook(() =>
      useOptimisticEdit(held.movie, editMovie)
    );

    await act(async () =>
      result.current({
        next: 30,
        capture: (movie) => movie.ratingPercent,
        apply,
        restore: withRating,
        save: () => Promise.resolve(30),
      })
    );

    expect(apply).toHaveBeenCalledTimes(1);
    expect(held.movie.ratingPercent).toBe(30);
  });

  it('takes the route’s echo over what was assumed when the two disagree', async () => {
    const { held, editMovie } = screenHolding(aMovie({ ratingPercent: 80 }));
    const { result } = renderHook(() =>
      useOptimisticEdit(held.movie, editMovie)
    );

    await act(async () =>
      result.current({
        next: 30,
        capture: (movie) => movie.ratingPercent,
        apply: withRating,
        restore: withRating,
        save: () => Promise.resolve(50),
      })
    );

    expect(held.movie.ratingPercent).toBe(50);
  });

  it('hands the save the movie’s id and the value being written', async () => {
    const { held, editMovie } = screenHolding(
      aMovie({ id: 'm7', ratingPercent: null })
    );
    const save = vi.fn(() => Promise.resolve(30));
    const { result } = renderHook(() =>
      useOptimisticEdit(held.movie, editMovie)
    );

    await act(async () =>
      result.current({
        next: 30,
        capture: (movie) => movie.ratingPercent,
        apply: withRating,
        restore: withRating,
        save,
      })
    );

    expect(save).toHaveBeenCalledExactlyOnceWith('m7', 30);
  });

  it('does nothing at all when the page is not holding a movie', async () => {
    const { held, editMovie } = screenHolding(aMovie());
    const save = vi.fn(() => Promise.resolve(30));
    const { result } = renderHook(() => useOptimisticEdit(null, editMovie));

    await act(async () =>
      result.current({
        next: 30,
        capture: (movie) => movie.ratingPercent,
        apply: withRating,
        restore: withRating,
        save,
      })
    );

    expect(save).not.toHaveBeenCalled();
    expect(held.movie.ratingPercent).toBe(80);
  });

  describe('putting back what the edit cost', () => {
    it('restores a captured value when the save is refused', async () => {
      const { held, editMovie } = screenHolding(aMovie({ ratingPercent: 80 }));
      const { result } = renderHook(() =>
        useOptimisticEdit(held.movie, editMovie)
      );

      await act(async () =>
        result.current({
          next: 30,
          capture: (movie) => movie.ratingPercent,
          apply: withRating,
          restore: withRating,
          save: () => Promise.reject(new Error('refused')),
        })
      );

      expect(held.movie.ratingPercent).toBe(80);
    });

    it('restores a captured absence, which no derived revert could express', async () => {
      // The rating's own case: an unrated movie scored by mistake goes back to
      // unrated, not to nought. `!value` has nothing to say about this.
      const { held, editMovie } = screenHolding(
        aMovie({ ratingPercent: null })
      );
      const { result } = renderHook(() =>
        useOptimisticEdit(held.movie, editMovie)
      );

      await act(async () =>
        result.current({
          next: 30,
          capture: (movie) => movie.ratingPercent,
          apply: withRating,
          restore: withRating,
          save: () => Promise.reject(new Error('refused')),
        })
      );

      expect(held.movie.ratingPercent).toBeNull();
    });

    it('restores a flag to what it was, not to the opposite of what was sent', async () => {
      const { held, editMovie } = screenHolding(aMovie({ isFavorite: false }));
      const { result } = renderHook(() =>
        useOptimisticEdit(held.movie, editMovie)
      );

      await act(async () =>
        result.current({
          next: true,
          capture: (movie) => movie.isFavorite,
          apply: withFavorite,
          restore: withFavorite,
          save: () => Promise.reject(new Error('refused')),
        })
      );

      expect(held.movie.isFavorite).toBe(false);
    });

    it('restores a captured pair, so more than the written field comes back', async () => {
      // `toggleWatched`'s shape: marking watched drops the resume offer, and a
      // save that never landed never dropped it.
      const { held, editMovie } = screenHolding(
        aMovie({ isWatched: false, playLabel: 'Resume · 52:00' })
      );
      const { result } = renderHook(() =>
        useOptimisticEdit(held.movie, editMovie)
      );

      await act(async () =>
        result.current({
          next: true,
          capture: ({ isWatched, playLabel }) => ({ isWatched, playLabel }),
          apply: (movie, watched) => ({
            ...movie,
            isWatched: watched,
            playLabel: 'Play',
          }),
          restore: (movie, previous) => ({ ...movie, ...previous }),
          save: () => Promise.reject(new Error('refused')),
        })
      );

      expect(held.movie.isWatched).toBe(false);
      expect(held.movie.playLabel).toBe('Resume · 52:00');
    });

    it('captures what the edit cost before applying it, not after', async () => {
      const capture = vi.fn((movie: MovieDetailModel) => movie.ratingPercent);
      const { held, editMovie } = screenHolding(aMovie({ ratingPercent: 80 }));
      const { result } = renderHook(() =>
        useOptimisticEdit(held.movie, editMovie)
      );

      await act(async () =>
        result.current({
          next: 30,
          capture,
          apply: withRating,
          restore: withRating,
          save: () => Promise.reject(new Error('refused')),
        })
      );

      expect(capture).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ ratingPercent: 80 })
      );
    });

    it('reverts only after the failure lands, not before', async () => {
      const { held, editMovie } = screenHolding(aMovie({ ratingPercent: 80 }));
      const pending = deferred<number | null>();
      const { result } = renderHook(() =>
        useOptimisticEdit(held.movie, editMovie)
      );

      act(() =>
        result.current({
          next: 30,
          capture: (movie) => movie.ratingPercent,
          apply: withRating,
          restore: withRating,
          save: () => pending.promise,
        })
      );
      expect(held.movie.ratingPercent).toBe(30);

      await act(async () => {
        pending.reject(new Error('refused'));
      });

      await waitFor(() => expect(held.movie.ratingPercent).toBe(80));
    });
  });

  it('writes every value through the editMovie guard, never around it', async () => {
    // The guard is what stops an answer landing after the page has moved on
    // from resurrecting a movie the state has already dropped.
    const edits: string[] = [];
    const movie = aMovie({ ratingPercent: 80 });
    const editMovie = () => edits.push('edit');
    const { result } = renderHook(() => useOptimisticEdit(movie, editMovie));

    await act(async () =>
      result.current({
        next: 30,
        capture: (m) => m.ratingPercent,
        apply: withRating,
        restore: withRating,
        save: () => Promise.resolve(50),
      })
    );

    expect(edits).toEqual(['edit', 'edit']);
  });

  it('keeps one identity while the movie and the guard keep theirs', () => {
    const movie = aMovie();
    const editMovie = vi.fn();
    const { result, rerender } = renderHook(() =>
      useOptimisticEdit(movie, editMovie)
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
