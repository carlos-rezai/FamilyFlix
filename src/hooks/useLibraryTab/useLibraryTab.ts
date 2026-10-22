import { useSearchParams } from 'react-router-dom';

import type { LibraryTab } from '@/types';
import { isLibraryTab } from '@/utils';

/**
 * The **Library tab** the URL names: `tab` when it is one of the
 * **Library tabs**, else Movies. The URL writer omits `tab` at `movies`, so
 * its absence is the Movies tab, and a hand-edited name the guard refuses
 * reads the same way.
 *
 * A global hook rather than a feature module: the library feature picks its
 * body and its switch off it, and the search feature its placeholder and its
 * genre list, so the reading must not exist twice.
 */
export function useLibraryTab(): LibraryTab {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  return isLibraryTab(tab) ? tab : 'movies';
}
