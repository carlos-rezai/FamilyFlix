import { useCallback, useState } from 'react';

import { deleteMovie as sendDelete } from '../api/api';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';

export interface DeleteMovie {
  /** True for the life of the request, false before and after. */
  deleting: boolean;
  /**
   * Sends the delete and, once the movie is gone, leaves its page. Rejects
   * with the request's own error when the server refused, in which case
   * nothing moved.
   */
  deleteMovie: () => Promise<void>;
}

/**
 * The hook behind the Delete dialog's confirm.
 *
 * On resolution it goes back through `useGoBack` — the app's one Back rule,
 * which steps through history and falls back to the browse home only when
 * there is none. Not `navigate('/')`: that is the prototype's `goBrowse()`, and
 * a step is what lands on the shelf as it was left, sort and scroll included,
 * refetched on the way in and so without the movie's card. The deleted movie's
 * entry stays in the forward stack; stepping onto it lands on the detail page's
 * existing `not-found` state, which was written for precisely this.
 *
 * "Resolution" includes a `404` — see `api.deleteMovie` — so a movie the server
 * no longer has still takes the maintainer off its page.
 */
export function useDeleteMovie(movieId: string): DeleteMovie {
  const goBack = useGoBack();
  const [deleting, setDeleting] = useState(false);

  const deleteMovie = useCallback(async () => {
    setDeleting(true);
    try {
      await sendDelete(movieId);
    } finally {
      setDeleting(false);
    }
    goBack();
  }, [movieId, goBack]);

  return { deleting, deleteMovie };
}
