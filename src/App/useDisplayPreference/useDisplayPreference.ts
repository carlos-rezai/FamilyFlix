import { createContext, useContext } from 'react';

/** What `useDisplayPreference()` hands a consumer. */
export interface DisplayPreferenceApi {
  /**
   * The household's **Ultrawide margins**: `null` until the settings read
   * lands, the stored value after, and `null` still if it never does.
   */
  ultrawideMargins: boolean | null;
  /**
   * Turn it on or off: shown at once, posted, the echo kept, and the previous
   * value put back on a refusal. Never rejects.
   */
  setUltrawideMargins: (on: boolean) => Promise<void>;
  /**
   * The household's _Fill in ratings from TMDB_: `null` until the same read
   * lands — which every caller reads as off — the stored value after.
   */
  tmdbRatings: boolean | null;
  /** Turn it on or off, on `setUltrawideMargins`' bargain. Never rejects. */
  setTmdbRatings: (on: boolean) => Promise<void>;
}

/**
 * The context object, owned here rather than by the provider so the
 * dependency runs one way — provider → hook — `useSnackbar`'s precedent.
 */
export const DisplayPreferenceContext =
  createContext<DisplayPreferenceApi | null>(null);

/**
 * `{ ultrawideMargins, setUltrawideMargins, tmdbRatings, setTmdbRatings }` off the app-level
 * `DisplayPreferenceProvider`. The provider is mounted in `App`, so a consumer
 * outside one is a wiring mistake, and a silent `null` would hide it: it
 * throws, naming itself.
 */
export function useDisplayPreference(): DisplayPreferenceApi {
  const value = useContext(DisplayPreferenceContext);
  if (value === null) {
    throw new Error(
      'useDisplayPreference must be used within a DisplayPreferenceProvider'
    );
  }
  return value;
}
