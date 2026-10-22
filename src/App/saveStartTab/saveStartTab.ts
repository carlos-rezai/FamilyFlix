import { postValue } from '@/api/postValue/postValue';
import type { LibraryTab } from '@/types';
import { isLibraryTab } from '@/utils';

/** Where the **Start tab** is written. */
const START_TAB_ENDPOINT = '/api/settings/start-tab';

/**
 * Saves the household's **Start tab** and answers with the tab that was
 * stored: the wire contract in `postValue`, with a **Library tab** as its
 * echo. Rejects if the save did not succeed, which is the provider's cue to
 * put the previous tab back.
 *
 * One caller, `DisplayPreferenceProvider`, so it stays beside it in `App/`,
 * `saveTmdbRatings`' twin.
 */
export function saveStartTab(tab: LibraryTab): Promise<LibraryTab> {
  return postValue(START_TAB_ENDPOINT, tab, isLibraryTab);
}
