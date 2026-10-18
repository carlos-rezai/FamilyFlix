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

/** One held language preference: its value, what lands it, and its setter. */
interface HeldLanguage {
  /** `null` until the read lands, the stored value after. */
  value: string | null;
  /** The read's answer, taken as it is. */
  land: (value: string) => void;
  /** Shown at once, posted, the echo kept, put back on refusal. Never rejects. */
  set: (language: string) => Promise<void>;
}

/**
 * The bargain both languages keep, written once over the save it is handed —
 * `useHeldFlag`'s twin over a string: shown at once, posted, the echo kept,
 * the previous value put back on a refusal, never rejecting. The two differ
 * only in the route they post to.
 */
function useHeldLanguage(
  save: (language: string) => Promise<string>
): HeldLanguage {
  const [value, setValue] = useState<string | null>(null);

  const set = useCallback(
    async (language: string): Promise<void> => {
      const previous = value;
      setValue(language);

      try {
        setValue(await save(language));
      } catch {
        setValue(previous);
      }
    },
    [value, save]
  );

  return { value, land: setValue, set };
}

/**
 * The household's **Preferred subtitle language** and **Preferred audio
 * language**, read once on mount off the shared `fetchSettings` — the two
 * fields of its answer this hook keeps, one read landing both.
 * **Ultrawide margins** rides the same read and is
 * `DisplayPreferenceProvider`'s to hold (log 27 Q13), so no screen holds a
 * copy that never updates.
 *
 * **Blank until it lands** — the Export summary's rule, and the shape every
 * read on the Settings page repeats: no skeleton, no error face, no snackbar.
 * A refused read shows no default the server never confirmed.
 *
 * Each `choose…` is one bargain, `useHeldLanguage`'s, over its own save — the
 * detail page's bargain in a few lines rather than `useOptimisticEdit`, which
 * edits a movie.
 */
export function useSettings(): SettingsState {
  const subtitle = useHeldLanguage(saveSubtitleLanguage);
  const audio = useHeldLanguage(saveAudioLanguage);
  const { land: landSubtitle } = subtitle;
  const { land: landAudio } = audio;

  useEffect(() => {
    let wanted = true;

    fetchSettings().then(
      (landed) => {
        if (wanted) {
          landSubtitle(landed.subtitleLanguage);
          landAudio(landed.audioLanguage);
        }
      },
      () => undefined
    );

    return () => {
      wanted = false;
    };
  }, [landSubtitle, landAudio]);

  return {
    subtitleLanguage: subtitle.value,
    chooseSubtitleLanguage: subtitle.set,
    audioLanguage: audio.value,
    chooseAudioLanguage: audio.set,
  };
}
