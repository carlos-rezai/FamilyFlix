import { useSearchParams } from 'react-router-dom';

import { HomeRows } from '../home/HomeRows/HomeRows';
import { SeriesHome } from '../series/SeriesHome/SeriesHome';

/**
 * The browse home's body, picked off `tab`: _All series_ under the Series
 * tab, the genre rows everywhere else. The choice lives here rather than in
 * `LibraryPage`, which stays composition only.
 */
export function LibraryBody() {
  const [searchParams] = useSearchParams();
  return searchParams.get('tab') === 'series' ? <SeriesHome /> : <HomeRows />;
}
