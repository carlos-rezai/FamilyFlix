import { useDisplayPreference } from '@/App/useDisplayPreference/useDisplayPreference';
import { useLibraryTab } from '@/hooks/useLibraryTab/useLibraryTab';
import type { RowView } from '@/types';

/** What `useRowView()` hands the switch and the body. */
export interface RowViewApi {
  /** The current tab's **Row view**: `null` until the settings read lands. */
  rowView: RowView | null;
  /** Choose the current tab's view alone. Never rejects. */
  setRowView: (view: RowView) => Promise<void>;
}

/**
 * The current **Library tab**'s **Row view** and a setter for it alone, read
 * off the URL's tab, so neither the switch nor the body knows the household
 * keeps one per tab.
 */
export function useRowView(): RowViewApi {
  const tab = useLibraryTab();
  const { movieRowView, setMovieRowView, seriesRowView, setSeriesRowView } =
    useDisplayPreference();

  return tab === 'series'
    ? { rowView: seriesRowView, setRowView: setSeriesRowView }
    : { rowView: movieRowView, setRowView: setMovieRowView };
}
