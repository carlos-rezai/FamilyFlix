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

/** One held display preference: its value, what lands it, and its setter. */
interface HeldFlag {
  /** `null` until the read lands, the stored value after. */
  value: boolean | null;
  /** The read's answer, taken as it is. */
  land: (value: boolean) => void;
  /** Shown at once, posted, the echo kept, put back on refusal. Never rejects. */
  set: (on: boolean) => Promise<void>;
}

/**
 * The bargain both preferences keep, written once over the save it is handed —
 * `useSettings`' bargain: shown at once, posted, the echo kept, the previous
 * value put back on a refusal, never rejecting. The two differ only in the
 * route they post to.
 */
function useHeldFlag(save: (on: boolean) => Promise<boolean>): HeldFlag {
  const [value, setValue] = useState<boolean | null>(null);

  const set = useCallback(
    async (on: boolean): Promise<void> => {
      const previous = value;
      setValue(on);

      try {
        setValue(await save(on));
      } catch {
        setValue(previous);
      }
    },
    [value, save]
  );

  return { value, land: setValue, set };
}

/**
 * The household's display preferences — **Ultrawide margins** and _Fill in
 * ratings from TMDB_ — held app-wide so a flip on the Settings page reaches
 * the **Content frame** and every star at once, `SnackbarProvider`'s shape. It
 * reads the shared `fetchSettings` once on mount (**Blank until it lands**:
 * `null` until then, `null` still after a refusal), and one read lands both.
 * Its setters are one bargain, `useHeldFlag`'s, each over its own save.
 */
export function DisplayPreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const margins = useHeldFlag(saveUltrawideMargins);
  const ratings = useHeldFlag(saveTmdbRatings);
  const { land: landMargins } = margins;
  const { land: landRatings } = ratings;

  useEffect(() => {
    let wanted = true;

    fetchSettings().then(
      (landed) => {
        if (wanted) {
          landMargins(landed.ultrawideMargins);
          landRatings(landed.tmdbRatings);
        }
      },
      () => undefined
    );

    return () => {
      wanted = false;
    };
  }, [landMargins, landRatings]);

  const api = useMemo<DisplayPreferenceApi>(
    () => ({
      ultrawideMargins: margins.value,
      setUltrawideMargins: margins.set,
      tmdbRatings: ratings.value,
      setTmdbRatings: ratings.set,
    }),
    [margins.value, margins.set, ratings.value, ratings.set]
  );

  return (
    <DisplayPreferenceContext.Provider value={api}>
      {children}
    </DisplayPreferenceContext.Provider>
  );
}
