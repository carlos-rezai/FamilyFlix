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

/**
 * The household's **Ultrawide margins**, held app-wide so the **Content
 * frame** follows a flip on the Settings page at once — `SnackbarProvider`'s
 * shape. It reads the shared `fetchSettings` once on mount (**Blank until it
 * lands**: `null` until then, `null` still after a refusal), and its setter is
 * `useSettings`' bargain: shown at once, posted, the echo kept, the previous
 * value put back on refusal, never rejecting.
 */
export function DisplayPreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [ultrawideMargins, setValue] = useState<boolean | null>(null);

  useEffect(() => {
    let wanted = true;

    fetchSettings().then(
      (landed) => {
        if (wanted) {
          setValue(landed.ultrawideMargins);
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

  const api = useMemo<DisplayPreferenceApi>(
    () => ({ ultrawideMargins, setUltrawideMargins }),
    [ultrawideMargins, setUltrawideMargins]
  );

  return (
    <DisplayPreferenceContext.Provider value={api}>
      {children}
    </DisplayPreferenceContext.Provider>
  );
}
