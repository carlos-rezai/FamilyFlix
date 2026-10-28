import { useCallback, useState } from 'react';

import type { BusyPhase } from '@/types';
import { useDelayedBusy } from '@/hooks/useDelayedBusy/useDelayedBusy';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { deleteMovie as sendDelete } from '@/api/deleteMovie/deleteMovie';

export interface DeleteMovie {
  /**
   * The delete's **Busy phase**, on the **Loader timing**: `waiting` from
   * the confirm, `shown` once it has run 300ms. Its outcome, the leaving or
   * the failure, lands only once the loader's hold is out.
   */
  deleting: BusyPhase;
  /** Whether the last delete failed; the next confirm clears it. */
  failed: boolean;
  /**
   * Sends the delete and, once the movie is gone, leaves its page. Rejects
   * with the request's own error when the delete failed, in which case
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
  const { phase: deleting, run } = useDelayedBusy();
  const [failed, setFailed] = useState(false);

  const deleteMovie = useCallback(async () => {
    setFailed(false);
    try {
      await run(() => sendDelete(movieId));
    } catch (error: unknown) {
      setFailed(true);
      throw error;
    }
    goBack();
  }, [movieId, goBack, run]);

  return { deleting, failed, deleteMovie };
}
