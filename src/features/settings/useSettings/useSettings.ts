import { useCallback, useEffect, useState } from 'react';

import type { Settings } from '@/types';
import { fetchSettings } from '@/api/fetchSettings/fetchSettings';
import { saveSubtitleLanguage } from '../api/api';

export interface SettingsState {
  /**
   * The household's settings: `null` until the read lands, the payload after,
   * and `null` still if it never does.
   */
  settings: Settings | null;
  /**
   * Choose the preferred subtitle language: shown at once, posted, the echo
   * kept, and the previous value put back on a refusal. Never rejects — the
   * screen has no error face to show.
   */
  chooseSubtitleLanguage(language: string): Promise<void>;
}

/**
 * The household's one preference, fetched once on mount.
 *
 * **Blank until it lands** — the Export summary's rule, and the shape every
 * read on the Settings page repeats: no skeleton, no error face, no snackbar.
 * A refused read shows no default the server never confirmed.
 *
 * `chooseSubtitleLanguage` is the detail page's bargain in two lines: set the
 * value on screen, post, take the echo, and put the previous value back on
 * rejection. Two lines inside the hook rather than `useOptimisticEdit`, which
 * edits a movie.
 */
export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let wanted = true;

    fetchSettings().then(
      (landed) => {
        if (wanted) {
          setSettings(landed);
        }
      },
      () => undefined
    );

    return () => {
      wanted = false;
    };
  }, []);

  const chooseSubtitleLanguage = useCallback(
    async (language: string): Promise<void> => {
      const previous = settings;
      setSettings((current) =>
        current ? { ...current, subtitleLanguage: language } : current
      );

      try {
        const stored = await saveSubtitleLanguage(language);
        setSettings((current) =>
          current ? { ...current, subtitleLanguage: stored } : current
        );
      } catch {
        setSettings(previous);
      }
    },
    [settings]
  );

  return { settings, chooseSubtitleLanguage };
}
