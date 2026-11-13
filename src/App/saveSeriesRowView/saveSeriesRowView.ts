import { postValue } from '@/api/postValue/postValue';
import type { RowView } from '@/types';
import { isRowView } from '@/utils';

/** Where the Series tab's **Row view** is written. */
const SERIES_ROW_VIEW_ENDPOINT = '/api/settings/series-row-view';

/**
 * Saves the Series tab's **Row view** and answers with the view that was
 * stored: the wire contract in `postValue`, `saveStartTab`'s twin. Rejects if
 * the save did not succeed, which is the provider's cue to put the previous
 * view back.
 */
export function saveSeriesRowView(view: RowView): Promise<RowView> {
  return postValue(SERIES_ROW_VIEW_ENDPOINT, view, isRowView);
}
