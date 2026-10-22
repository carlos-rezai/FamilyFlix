import { useLibraryTab } from '@/hooks/useLibraryTab/useLibraryTab';

import { HomeRows } from '../home/HomeRows/HomeRows';
import { SeriesHome } from '../series/SeriesHome/SeriesHome';

/**
 * The browse home's body, picked off the **Library tab** the URL names:
 * _All series_ under the Series tab, the genre rows under Movies. The choice lives here rather than in
 * `LibraryPage`, which stays composition only.
 */
export function LibraryBody() {
  return useLibraryTab() === 'series' ? <SeriesHome /> : <HomeRows />;
}
