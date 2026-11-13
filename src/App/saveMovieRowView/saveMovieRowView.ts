import { postValue } from '@/api/postValue/postValue';
import type { RowView } from '@/types';
import { isRowView } from '@/utils';

/** Where the Movie tab's **Row view** is written. */
const MOVIE_ROW_VIEW_ENDPOINT = '/api/settings/movie-row-view';

/**
 * Saves the Movie tab's **Row view** and answers with the view that was
 * stored: the wire contract in `postValue`, `saveStartTab`'s twin. Rejects if
 * the save did not succeed, which is the provider's cue to put the previous
 * view back.
 */
export function saveMovieRowView(view: RowView): Promise<RowView> {
  return postValue(MOVIE_ROW_VIEW_ENDPOINT, view, isRowView);
}
