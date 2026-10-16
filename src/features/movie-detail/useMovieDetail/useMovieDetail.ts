import { useCallback, useEffect, useState } from 'react';

import type { Movie, MovieDetailModel } from '@/types';
import { fetchMovie } from '@/api/fetchMovie/fetchMovie';
import { saveFavorite } from '@/api/saveFavorite/saveFavorite';
import { saveWatched } from '@/api/saveWatched/saveWatched';
import { toRatingUnits } from '@/utils';
import { saveRating } from '../api/api';
import { detailView } from '../detailView/detailView';
import { useOptimisticEdit } from '@/hooks/useOptimisticEdit/useOptimisticEdit';
import { useTmdbRatings } from '@/App/useTmdbRatings/useTmdbRatings';

/**
 * Where the load is. Four, not three: a movie that is gone and a movie that
 * failed to load want different buttons — `not-found` offers a way back to the
 * library, and Retry on a 404 is a button that can never work.
 */
export type MovieDetailStatus = 'loading' | 'ready' | 'not-found' | 'error';

/**
 * Status and movie move together, as one value, so "ready" can never be read
 * beside a stale or absent movie — and the caller that has narrowed to `ready`
 * has the movie without a null check the state already ruled out.
 *
 * One member per status, rather than one member for the three empty ones: a
 * member holding `'loading' | 'not-found' | 'error'` only narrows to a smaller
 * union of those, never away, so the page would still be handed a nullable
 * movie after ruling all three out.
 */
type MovieDetailState =
  | { status: 'loading'; movie: null }
  | { status: 'not-found'; movie: null }
  | { status: 'error'; movie: null }
  | { status: 'ready'; movie: MovieDetailModel };

/**
 * What the hook holds: the same four members, the `ready` one carrying the
 * record the read answered rather than the model drawn from it —
 * `useSeriesRead`'s shape, so the model is drawn per render under the live
 * preference.
 */
type HeldMovie =
  | { status: 'loading'; movie: null }
  | { status: 'not-found'; movie: null }
  | { status: 'error'; movie: null }
  | { status: 'ready'; movie: Movie };

export type UseMovieDetailResult = MovieDetailState & {
  /** Re-run the load after a failure. */
  retry: () => void;
  /** Flip the watched flag, showing the new value immediately. */
  toggleWatched: () => void;
  /** Flip the favorite flag, showing the new value immediately. */
  toggleFavorite: () => void;
  /**
   * Score the movie, as a 0–100 percent, or `null` to clear it — showing the
   * new rating immediately.
   */
  rate: (percent: number | null) => void;
};

/** What a watched mark costs: the flag, and the resume offer it spends. */
type WatchState = Pick<Movie, 'watched' | 'status' | 'resumePositionSeconds'>;

/**
 * The record marked by the movie's watched rule: watched forgets the resume
 * position — the repository's convention — and unwatched keeps it, so the
 * button must not keep offering a 52:00 the server has already discarded.
 */
function withWatched(movie: Movie, watched: boolean): Movie {
  if (watched) {
    return {
      ...movie,
      watched: true,
      resumePositionSeconds: 0,
      status: 'watched',
    };
  }
  return {
    ...movie,
    watched: false,
    status: movie.resumePositionSeconds > 0 ? 'in-progress' : 'unwatched',
  };
}

/** The record with the favorite flag set. */
function withFavorite(movie: Movie, isFavorite: boolean): Movie {
  return { ...movie, isFavorite };
}

/** The record scored, or unscored — `null` is a cleared rating, not a missing one. */
function withRating(movie: Movie, rating: number | null): Movie {
  return { ...movie, rating };
}

/**
 * Loads one movie by the id in the page's URL and hands it back mapped for the
 * screen. The id is the whole input: the page renders identically from a click,
 * a reload, or a pasted deep link, because nothing arrives through navigation
 * state.
 *
 * A 404 resolves rather than rejects (see `fetchMovie`), which is what keeps
 * `not-found` distinct from `error` here — the difference the parent sees is
 * which button they are offered.
 *
 * It holds the record and draws it per render through `detailView`, under the
 * household's _Fill in ratings from TMDB_, so a flip in Settings — or the
 * preference landing after the film — redraws the page without reading it
 * again.
 *
 * It also owns the three edits this page can make — the watched tick, the
 * favorite heart and the rating — each patching the held record. All three keep
 * one bargain and `useOptimisticEdit` is where that bargain is written; what
 * each one says here is only what it writes, what that costs, and how to save
 * it. A refused save costs the edit, not the page.
 */
export function useMovieDetail(id: string): UseMovieDetailResult {
  const [state, setState] = useState<HeldMovie>({
    status: 'loading',
    movie: null,
  });
  const [attempt, setAttempt] = useState(0);
  const tmdbRatings = useTmdbRatings();

  useEffect(() => {
    let current = true;
    setState({ status: 'loading', movie: null });

    fetchMovie(id)
      .then((movie) => {
        if (!current) {
          return;
        }
        setState(
          movie === null
            ? { status: 'not-found', movie: null }
            : { status: 'ready', movie }
        );
      })
      .catch(() => {
        if (!current) {
          return;
        }
        setState({ status: 'error', movie: null });
      });

    // A retry that lands while an earlier load is still in flight must not have
    // the stale response overwrite it.
    return () => {
      current = false;
    };
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  /**
   * Edit the movie on screen, if there still is one. Every optimistic write goes
   * through here so a save that answers after the page has moved on — a retry, a
   * different movie — cannot resurrect a movie the state has already dropped.
   */
  const editMovie = useCallback((update: (movie: Movie) => Movie) => {
    setState((current) =>
      current.status === 'ready'
        ? { status: 'ready', movie: update(current.movie) }
        : current
    );
  }, []);

  const movie = state.status === 'ready' ? state.movie : null;

  /**
   * The bargain all three edits below keep. Each one says what it writes, what
   * that costs and how to save it; the reconcile and the revert live in one
   * place rather than three (see `useOptimisticEdit`).
   */
  const edit = useOptimisticEdit(movie, editMovie);

  /**
   * The one edit that costs more than the field it writes: marking watched also
   * spends the resume offer, so what a refused save hands back is the watch
   * state whole, not the flag. A save that never landed never discarded the
   * position.
   */
  const toggleWatched = useCallback(() => {
    if (movie === null) {
      return;
    }

    edit({
      next: !movie.watched,
      capture: ({ watched, status, resumePositionSeconds }): WatchState => ({
        watched,
        status,
        resumePositionSeconds,
      }),
      apply: withWatched,
      restore: (current, previous) => ({ ...current, ...previous }),
      save: saveWatched,
    });
  }, [movie, edit]);

  const toggleFavorite = useCallback(() => {
    if (movie === null) {
      return;
    }

    edit({
      next: !movie.isFavorite,
      capture: (current) => current.isFavorite,
      apply: withFavorite,
      restore: withFavorite,
      save: saveFavorite,
    });
  }, [movie, edit]);

  /**
   * Percent at the door, stored units from there in — the picker above knows
   * nothing about the domain, and the record and the column below both speak
   * 0–10. The route's echo is units too, so the reconcile compares units.
   */
  const rate = useCallback(
    (percent: number | null) => {
      edit({
        next: toRatingUnits(percent),
        capture: (current) => current.rating,
        apply: withRating,
        restore: withRating,
        save: saveRating,
      });
    },
    [edit]
  );

  const handlers = { retry, toggleWatched, toggleFavorite, rate };
  return state.status === 'ready'
    ? {
        status: 'ready',
        movie: detailView(state.movie, tmdbRatings),
        ...handlers,
      }
    : { status: state.status, movie: null, ...handlers };
}
