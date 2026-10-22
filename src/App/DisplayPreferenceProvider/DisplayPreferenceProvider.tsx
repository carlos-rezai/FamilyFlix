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
import type { LibraryTab } from '@/types';

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
 * The household's display preferences — **Ultrawide margins**, _Fill in
 * ratings from TMDB_ and the **Start tab** — held app-wide so a flip on the
 * Settings page reaches
 * the **Content frame** and every star at once, `SnackbarProvider`'s shape. It
 * reads the shared `fetchSettings` once on mount (**Blank until it lands**:
 * `null` until then, `null` still after a refusal), and one read lands all three.
 * Its setters are one bargain, `useHeldValue`'s, each over its own save.
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
  const { land: landStartTab } = startTab;

  useEffect(() => {
    let wanted = true;

    fetchSettings().then(
      (landed) => {
        if (wanted) {
          landMargins(landed.ultrawideMargins);
          landRatings(landed.tmdbRatings);
          landStartTab(landed.startTab);
        }
      },
      () => undefined
    );

    return () => {
      wanted = false;
    };
  }, [landMargins, landRatings, landStartTab]);

  const api = useMemo<DisplayPreferenceApi>(
    () => ({
      ultrawideMargins: margins.value,
      setUltrawideMargins: margins.set,
      tmdbRatings: ratings.value,
      setTmdbRatings: ratings.set,
      startTab: startTab.value,
      setStartTab: startTab.set,
    }),
    [
      margins.value,
      margins.set,
      ratings.value,
      ratings.set,
      startTab.value,
      startTab.set,
    ]
  );

  return (
    <DisplayPreferenceContext.Provider value={api}>
      {children}
    </DisplayPreferenceContext.Provider>
  );
}
