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

/**
 * The household's display preferences — **Ultrawide margins** and _Fill in
 * ratings from TMDB_ — held app-wide so the **Content
 * frame** follows a flip on the Settings page at once — `SnackbarProvider`'s
 * shape. It reads the shared `fetchSettings` once on mount (**Blank until it
 * lands**: `null` until then, `null` still after a refusal), and its setter is
 * `useSettings`' bargain: shown at once, posted, the echo kept, the previous
 * value put back on refusal, never rejecting. One read lands both.
 */
export function DisplayPreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [ultrawideMargins, setValue] = useState<boolean | null>(null);
  const [tmdbRatings, setRatingsValue] = useState<boolean | null>(null);

  useEffect(() => {
    let wanted = true;

    fetchSettings().then(
      (landed) => {
        if (wanted) {
          setValue(landed.ultrawideMargins);
          setRatingsValue(landed.tmdbRatings);
        }
      },
      () => undefined
    );

    return () => {
      wanted = false;
    };
  }, []);

  const setUltrawideMargins = useCallback(
    async (on: boolean): Promise<void> => {
      const previous = ultrawideMargins;
      setValue(on);

      try {
        setValue(await saveUltrawideMargins(on));
      } catch {
        setValue(previous);
      }
    },
    [ultrawideMargins]
  );

  const setTmdbRatings = useCallback(
    async (on: boolean): Promise<void> => {
      const previous = tmdbRatings;
      setRatingsValue(on);

      try {
        setRatingsValue(await saveTmdbRatings(on));
      } catch {
        setRatingsValue(previous);
      }
    },
    [tmdbRatings]
  );

  const api = useMemo<DisplayPreferenceApi>(
    () => ({
      ultrawideMargins,
      setUltrawideMargins,
      tmdbRatings,
      setTmdbRatings,
    }),
    [ultrawideMargins, setUltrawideMargins, tmdbRatings, setTmdbRatings]
  );

  return (
    <DisplayPreferenceContext.Provider value={api}>
      {children}
    </DisplayPreferenceContext.Provider>
  );
}
