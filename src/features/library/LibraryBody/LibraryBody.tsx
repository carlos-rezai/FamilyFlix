import { useLibraryTab } from '@/hooks/useLibraryTab/useLibraryTab';

import { MovieRows } from '../home/MovieRows/MovieRows';
import { MovieGrid } from '../home/MovieGrid/MovieGrid';
import { SeriesHome } from '../series/SeriesHome/SeriesHome';
import { SeriesRows } from '../series/SeriesRows/SeriesRows';
import { useRowView } from '../useRowView/useRowView';

/** Movies' body, picked off its **Row view**: nothing until the read lands. */
function MoviesBody() {
  const { rowView } = useRowView();
  if (rowView === null) return null;
  return rowView === 'all' ? <MovieGrid /> : <MovieRows />;
}

/** Series' body, picked off its own **Row view**: nothing until the read lands. */
function SeriesBody() {
  const { rowView } = useRowView();
  if (rowView === null) return null;
  return rowView === 'all' ? <SeriesHome /> : <SeriesRows />;
}

/**
 * The browse home's body, picked off the **Library tab** the URL names, then
 * off that tab's **Row view**. Movies under **By genre** (the default) are
 * `MovieRows`, the genre rows and the **Other row** last; under **All**,
 * `MovieGrid`, _All movies_ in one uncapped grid. Series under **All** (the
 * default) are `SeriesHome`, _All series_; under **By genre**, `SeriesRows`,
 * the series genre rows and the **Other series row** last. The Row view is
 * the household's, set by the **Row view switch** and kept in Settings rather
 * than the URL, so back from a title lands on the same view. Nothing is drawn
 * until the settings read lands. The choice lives here rather than in
 * `LibraryPage`, which stays composition only.
 */
export function LibraryBody() {
  return useLibraryTab() === 'series' ? <SeriesBody /> : <MoviesBody />;
}
