import { useContext } from 'react';

import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';

/**
 * Whether a title with no household Rating draws TMDB's, on every surface that
 * draws stars — the cards, the movie page's placeholder, the series page: the
 * household's _Fill in ratings from TMDB_, `true` only once the read has landed
 * on. The context rather than the throwing `useDisplayPreference()` — the
 * Snackbar stack's precedent — so a screen rendered without the provider reads
 * as off, as it does before the read lands.
 */
export function useTmdbRatings(): boolean {
  return useContext(DisplayPreferenceContext)?.tmdbRatings === true;
}
