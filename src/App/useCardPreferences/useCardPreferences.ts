import { useContext, useMemo } from 'react';

import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';
import type { CardPreferences } from '@/types';

/**
 * The **Card preferences** every Poster card is mapped under, off the
 * app-level display preference: _Fill in ratings from TMDB_ and _Show video
 * quality_, each `true` only once the read has landed on. The context rather
 * than the throwing `useDisplayPreference()`, `useTmdbRatings`' rule, so a
 * screen rendered without the provider reads both as off.
 */
export function useCardPreferences(): CardPreferences {
  const preference = useContext(DisplayPreferenceContext);
  const tmdbRatings = preference?.tmdbRatings === true;
  const qualityTags = preference?.qualityTags === true;
  // One object per pair of values, so a caller's memo holds across renders.
  return useMemo(
    () => ({ tmdbRatings, qualityTags }),
    [tmdbRatings, qualityTags]
  );
}
