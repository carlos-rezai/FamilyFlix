import { useLibraryTab } from '@/hooks/useLibraryTab/useLibraryTab';

import { HomeRows } from '../home/HomeRows/HomeRows';
import { MovieGrid } from '../home/MovieGrid/MovieGrid';
import { SeriesHome } from '../series/SeriesHome/SeriesHome';
import { useRowView } from '../useRowView/useRowView';

/** Movies' body, picked off its **Row view**: nothing until the read lands. */
function MoviesBody() {
  const { rowView } = useRowView();
  if (rowView === null) return null;
  return rowView === 'all' ? <MovieGrid /> : <HomeRows />;
}

/**
 * The browse home's body, picked off the **Library tab** the URL names:
 * _All series_ under the Series tab; under Movies, the grid under **All** and
 * the genre rows under **By genre**, the **Row view** the household holds
 * rather than the URL, so back from a title lands on it again. The choice
 * lives here rather than in `LibraryPage`, which stays composition only.
 */
export function LibraryBody() {
  return useLibraryTab() === 'series' ? <SeriesHome /> : <MoviesBody />;
}
