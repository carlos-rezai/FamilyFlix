import { useCallback, useEffect, useState } from 'react';

import { fetchSettings } from '@/api/fetchSettings/fetchSettings';
import { saveAudioLanguage, saveSubtitleLanguage } from '../api/api';

export interface SettingsState {
  /**
   * The **Preferred subtitle language**: `null` until the read lands, the
   * stored value after, and `null` still if it never does.
   */
  subtitleLanguage: string | null;
  /**
   * Choose the preferred subtitle language: shown at once, posted, the echo
   * kept, and the previous value put back on a refusal. Never rejects — the
   * screen has no error face to show.
   */
  chooseSubtitleLanguage(language: string): Promise<void>;
  /** The **Preferred audio language**, read and held as the subtitle one is. */
  audioLanguage: string | null;
  /** Choose the preferred audio language — the subtitle language's bargain. */
  chooseAudioLanguage(language: string): Promise<void>;
}

/**
 * The household's **Preferred subtitle language** and **Preferred audio
 * language**, read once on mount off the shared `fetchSettings` — the two
 * fields of its answer this hook keeps.
 * **Ultrawide margins** rides the same read and is
 * `DisplayPreferenceProvider`'s to hold (log 27 Q13), so no screen holds a
 * copy that never updates.
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
  const [subtitleLanguage, setSubtitleLanguage] = useState<string | null>(null);
  const [audioLanguage, setAudioLanguage] = useState<string | null>(null);

  useEffect(() => {
    let wanted = true;

    fetchSettings().then(
      (landed) => {
        if (wanted) {
          setSubtitleLanguage(landed.subtitleLanguage);
          setAudioLanguage(landed.audioLanguage);
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
      const previous = subtitleLanguage;
      setSubtitleLanguage(language);

      try {
        setSubtitleLanguage(await saveSubtitleLanguage(language));
      } catch {
        setSubtitleLanguage(previous);
      }
    },
    [subtitleLanguage]
  );

  const chooseAudioLanguage = useCallback(
    async (language: string): Promise<void> => {
      const previous = audioLanguage;
      setAudioLanguage(language);

      try {
        setAudioLanguage(await saveAudioLanguage(language));
      } catch {
        setAudioLanguage(previous);
      }
    },
    [audioLanguage]
  );

  return {
    subtitleLanguage,
    chooseSubtitleLanguage,
    audioLanguage,
    chooseAudioLanguage,
  };
}
