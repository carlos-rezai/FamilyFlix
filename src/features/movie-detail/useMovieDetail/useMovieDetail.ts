import { useCallback, useEffect, useState } from 'react';

import type { MovieDetailModel } from '@/types';
// `saveFavorite` lives with the browse shelf because that is where the heart
// shipped first. CLAUDE.md assigns Favorites both surfaces, so when that feature
// lands it re-homes this call and the shelf's together, once — one flag, one
// route, and never a second copy of the save in the meantime.
import { saveFavorite } from '@/features/library/api/api';
import { toRatingPercent, toRatingUnits } from '@/utils';
import { fetchMovie, saveRating, saveWatched } from '../api/api';
import { detailView } from '../detailView/detailView';
import { useOptimisticEdit } from '../useOptimisticEdit/useOptimisticEdit';

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

/** The primary button once there is no resume point left to offer. */
const PLAY_LABEL = 'Play';

/**
 * The model with the watched flag set — and with the resume offer dropped along
 * with it, because marking watched clears the stored position by repository
 * convention and un-marking does not hand it back. The button must not keep
 * offering a 52:00 the server has already discarded.
 */
function withWatched(
  movie: MovieDetailModel,
  watched: boolean
): MovieDetailModel {
  return { ...movie, isWatched: watched, playLabel: PLAY_LABEL };
}

/** The model with the favorite flag set. */
function withFavorite(
  movie: MovieDetailModel,
  favorite: boolean
): MovieDetailModel {
  return { ...movie, isFavorite: favorite };
}

/** The model scored, or unscored — `null` is a cleared rating, not a missing one. */
function withRating(
  movie: MovieDetailModel,
  percent: number | null
): MovieDetailModel {
  return { ...movie, ratingPercent: percent };
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
 * It also owns the three edits this page can make — the watched tick, the
 * favorite heart and the rating — because the optimistic value and the loaded
 * movie are the same state. All three keep one bargain and `useOptimisticEdit`
 * is where that bargain is written; what each one says here is only what it
 * writes, what that costs, and how to save it. A refused save costs the edit,
 * not the page.
 */
export function useMovieDetail(id: string): UseMovieDetailResult {
  const [state, setState] = useState<MovieDetailState>({
    status: 'loading',
    movie: null,
  });
  const [attempt, setAttempt] = useState(0);

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
            : { status: 'ready', movie: detailView(movie) }
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
  const editMovie = useCallback(
    (update: (movie: MovieDetailModel) => MovieDetailModel) => {
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', movie: update(current.movie) }
          : current
      );
    },
    []
  );

  const movie = state.status === 'ready' ? state.movie : null;

  /**
   * The bargain all three edits below keep. Each one says what it writes, what
   * that costs and how to save it; the reconcile and the revert live in one
   * place rather than three (see `useOptimisticEdit`).
   */
  const edit = useOptimisticEdit(movie, editMovie);

  /**
   * The one edit that costs more than the field it writes: marking watched also
   * spends the resume offer, so what a refused save hands back is the pair, not
   * the flag. A save that never landed never discarded the position.
   */
  const toggleWatched = useCallback(() => {
    if (movie === null) {
      return;
    }

    edit({
      next: !movie.isWatched,
      capture: ({ isWatched, playLabel }) => ({ isWatched, playLabel }),
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
   * Percent on the way in, stored units on the wire — the picker above knows
   * nothing about the domain and the column below stores 0–10. The echo comes
   * back as units and is mapped before the hook reconciles it, so both sides of
   * that comparison speak percent.
   */
  const rate = useCallback(
    (percent: number | null) => {
      edit({
        next: percent,
        capture: (current) => current.ratingPercent,
        apply: withRating,
        restore: withRating,
        save: (id, value) =>
          saveRating(id, toRatingUnits(value)).then(toRatingPercent),
      });
    },
    [edit]
  );

  return { ...state, retry, toggleWatched, toggleFavorite, rate };
}
