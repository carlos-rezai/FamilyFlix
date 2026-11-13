import { useLibraryTab } from '@/hooks/useLibraryTab/useLibraryTab';

import { HomeRows } from '../home/HomeRows/HomeRows';
import { MovieGrid } from '../home/MovieGrid/MovieGrid';
import { SeriesHome } from '../series/SeriesHome/SeriesHome';
import { SeriesRows } from '../series/SeriesRows/SeriesRows';
import { useRowView } from '../useRowView/useRowView';

/** Movies' body, picked off its **Row view**: nothing until the read lands. */
function MoviesBody() {
  const { rowView } = useRowView();
  if (rowView === null) return null;
  return rowView === 'all' ? <MovieGrid /> : <HomeRows />;
}

/** Series' body, picked off its own **Row view**: nothing until the read lands. */
function SeriesBody() {
  const { rowView } = useRowView();
  if (rowView === null) return null;
  return rowView === 'all' ? <SeriesHome /> : <SeriesRows />;
}

/**
 * The browse home's body, picked off the **Library tab** the URL names:
 * on either tab, the grid (_All series_ on Series) under **All** and the genre
 * rows under **By genre**, each tab's **Row view** the household holds
 * rather than the URL, so back from a title lands on it again. The choice
 * lives here rather than in `LibraryPage`, which stays composition only.
 */
export function LibraryBody() {
  return useLibraryTab() === 'series' ? <SeriesBody /> : <MoviesBody />;
}
