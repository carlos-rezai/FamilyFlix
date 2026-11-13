import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchSettings } from '@/api/fetchSettings/fetchSettings';
import {
  DisplayPreferenceContext,
  type DisplayPreferenceApi,
} from '@/App/useDisplayPreference/useDisplayPreference';
import { saveUltrawideMargins } from '@/App/saveUltrawideMargins/saveUltrawideMargins';
import { saveTmdbRatings } from '@/App/saveTmdbRatings/saveTmdbRatings';
import { saveStartTab } from '@/App/saveStartTab/saveStartTab';
import { saveMovieRowView } from '@/App/saveMovieRowView/saveMovieRowView';
import { saveSeriesRowView } from '@/App/saveSeriesRowView/saveSeriesRowView';
import {
  DEFAULT_MOVIE_ROW_VIEW,
  DEFAULT_SERIES_ROW_VIEW,
  type LibraryTab,
  type RowView,
} from '@/types';

/** One held display preference: its value, what lands it, and its setter. */
interface HeldValue<T> {
  /** `null` until the read lands, the stored value after. */
  value: T | null;
  /** The read's answer, taken as it is. */
  land: (value: T) => void;
  /** Shown at once, posted, the echo kept, put back on refusal. Never rejects. */
  set: (next: T) => Promise<void>;
}

/**
 * The bargain every preference keeps, written once over the save it is
 * handed: `useSettings`' bargain. Shown at once, posted, the echo kept, the
 * previous value put back on a refusal, never rejecting. The preferences
 * differ only in the route they post to and the value they carry.
 */
function useHeldValue<T>(save: (next: T) => Promise<T>): HeldValue<T> {
  const [value, setValue] = useState<T | null>(null);

  const set = useCallback(
    async (next: T): Promise<void> => {
      const previous = value;
      setValue(next);

      try {
        setValue(await save(next));
      } catch {
        setValue(previous);
      }
    },
    [value, save]
  );

  return { value, land: setValue, set };
}

/**
 * The household's display preferences (**Ultrawide margins**, _Fill in
 * ratings from TMDB_, the **Start tab** and each tab's **Row view**), held
 * app-wide so a change on the Settings page reaches the **Content frame** and
 * every star at once, and a choice on the **Row view switch** redraws the
 * browse home in **All** or **By genre**: `SnackbarProvider`'s shape. It reads
 * the shared `fetchSettings` once on mount, and one read lands them all
 * (**Blank until it lands**: `null` until then). A refused read leaves every
 * preference `null` but the two Row views, which land their defaults, Movies
 * By genre and Series All, so the home is still drawn. Its setters are one
 * bargain, `useHeldValue`'s, each over its own save: the Row views' post to
 * `/api/settings/movie-row-view` and `/api/settings/series-row-view`.
 */
export function DisplayPreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const margins = useHeldValue<boolean>(saveUltrawideMargins);
  const ratings = useHeldValue<boolean>(saveTmdbRatings);
  const startTab = useHeldValue<LibraryTab>(saveStartTab);
  const { land: landMargins } = margins;
  const { land: landRatings } = ratings;
  const movieRowView = useHeldValue<RowView>(saveMovieRowView);
  const seriesRowView = useHeldValue<RowView>(saveSeriesRowView);
  const { land: landStartTab } = startTab;
  const { land: landMovieRowView } = movieRowView;
  const { land: landSeriesRowView } = seriesRowView;

  useEffect(() => {
    let wanted = true;

    fetchSettings().then(
      (landed) => {
        if (wanted) {
          landMargins(landed.ultrawideMargins);
          landRatings(landed.tmdbRatings);
          landStartTab(landed.startTab);
          landMovieRowView(landed.movieRowView);
          landSeriesRowView(landed.seriesRowView);
        }
      },
      () => {
        // A refused read lands the two Row view defaults alone, so the home
        // is still drawn; every other preference keeps `null`.
        if (wanted) {
          landMovieRowView(DEFAULT_MOVIE_ROW_VIEW);
          landSeriesRowView(DEFAULT_SERIES_ROW_VIEW);
        }
      }
    );

    return () => {
      wanted = false;
    };
  }, [
    landMargins,
    landRatings,
    landStartTab,
    landMovieRowView,
    landSeriesRowView,
  ]);

  const api = useMemo<DisplayPreferenceApi>(
    () => ({
      ultrawideMargins: margins.value,
      setUltrawideMargins: margins.set,
      tmdbRatings: ratings.value,
      setTmdbRatings: ratings.set,
      startTab: startTab.value,
      setStartTab: startTab.set,
      movieRowView: movieRowView.value,
      setMovieRowView: movieRowView.set,
      seriesRowView: seriesRowView.value,
      setSeriesRowView: seriesRowView.set,
    }),
    [
      margins.value,
      margins.set,
      ratings.value,
      ratings.set,
      startTab.value,
      startTab.set,
      movieRowView.value,
      movieRowView.set,
      seriesRowView.value,
      seriesRowView.set,
    ]
  );

  return (
    <DisplayPreferenceContext.Provider value={api}>
      {children}
    </DisplayPreferenceContext.Provider>
  );
}
