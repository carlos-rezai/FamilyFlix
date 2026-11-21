import { useMemo } from 'react';

import { useQualityTags } from '@/App/useQualityTags/useQualityTags';
import { useTmdbRatings } from '@/App/useTmdbRatings/useTmdbRatings';
import type { CardPreferences } from '@/types';

/**
 * The **Card preferences** every Poster card is mapped under: _Fill in
 * ratings from TMDB_ from `useTmdbRatings` and _Show video quality_ from
 * `useQualityTags`, each `true` only once the read has landed on, so a screen
 * rendered without the provider reads both as off.
 */
export function useCardPreferences(): CardPreferences {
  const tmdbRatings = useTmdbRatings();
  const qualityTags = useQualityTags();
  // One object per pair of values, so a caller's memo holds across renders.
  return useMemo(
    () => ({ tmdbRatings, qualityTags }),
    [tmdbRatings, qualityTags]
  );
}
