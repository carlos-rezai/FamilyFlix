import { useContext } from 'react';

import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';

/**
 * Whether a **Quality tag** is drawn and the **Quality filter** offered: the
 * household's _Show video quality_, `true` only once the read has landed on.
 * `useTmdbRatings`' twin: the context rather than the throwing
 * `useDisplayPreference()`, so a screen rendered without the provider reads
 * as off, as it does before the read lands.
 */
export function useQualityTags(): boolean {
  return useContext(DisplayPreferenceContext)?.qualityTags === true;
}
