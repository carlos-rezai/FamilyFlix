import { useCallback, useEffect, useState } from 'react';

import type { MovieDetailModel } from '@/types';
// `saveFavorite` lives with the browse shelf because that is where the heart
// shipped first. CLAUDE.md assigns Favorites both surfaces, so when that feature
// lands it re-homes this call and the shelf's together, once — one flag, one
// route, and never a second copy of the save in the meantime.
import { saveFavorite } from '@/features/library/api/api';
import { fetchMovie, saveWatched } from '../api/api';
import { detailView } from '../detailView/detailView';

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
 * It also owns the two edits this page can make — the watched tick and the
 * favorite heart — because the optimistic value and the loaded movie are the
 * same state. Both keep one bargain, the same one the browse shelf's heart
 * keeps: show the new value at once, take the route's echo over what was
 * assumed, and put it back if the save is refused, so the page never claims
 * something is saved that isn't. A refused save costs the toggle, not the page.
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

  const toggleWatched = useCallback(() => {
    if (movie === null) {
      return;
    }

    const next = !movie.isWatched;
    // What the click cost, kept so a refused save can hand it back — including
    // the resume offer, which was never actually discarded if nothing persisted.
    const { isWatched, playLabel } = movie;

    editMovie((current) => withWatched(current, next));

    saveWatched(movie.id, next)
      // The route echoes what it stored; trust that over what we assumed.
      .then((saved) => {
        if (saved !== next) {
          editMovie((current) => withWatched(current, saved));
        }
      })
      .catch(() => {
        editMovie((current) => ({ ...current, isWatched, playLabel }));
      });
  }, [movie, editMovie]);

  const toggleFavorite = useCallback(() => {
    if (movie === null) {
      return;
    }

    const next = !movie.isFavorite;

    editMovie((current) => ({ ...current, isFavorite: next }));

    saveFavorite(movie.id, next)
      .then((saved) => {
        if (saved !== next) {
          editMovie((current) => ({ ...current, isFavorite: saved }));
        }
      })
      .catch(() => {
        editMovie((current) => ({ ...current, isFavorite: !next }));
      });
  }, [movie, editMovie]);

  return { ...state, retry, toggleWatched, toggleFavorite };
}
