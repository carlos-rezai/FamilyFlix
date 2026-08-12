import { useCallback, useEffect, useState } from 'react';

import type { MovieDetailModel } from '@/types';
import { fetchMovie } from '../api/api';
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
};

/**
 * Loads one movie by the id in the page's URL and hands it back mapped for the
 * screen. The id is the whole input: the page renders identically from a click,
 * a reload, or a pasted deep link, because nothing arrives through navigation
 * state.
 *
 * A 404 resolves rather than rejects (see `fetchMovie`), which is what keeps
 * `not-found` distinct from `error` here — the difference the parent sees is
 * which button they are offered.
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

  return { ...state, retry };
}
