import type { PosterCardMovie } from '@/types';

/**
 * Loaded cards as the preference draws them. The browse loads map each title
 * once as it lands, with every rating it could show — `view(movie, true)` —
 * so a flip of _Fill in ratings from TMDB_ redraws the cards without reading
 * the library again: on, they pass through; off, a card whose rating is TMDB's
 * goes back to unrated. A household rating is never touched.
 *
 * Pure, and the list comes back as it was handed in while on, so a memo over
 * it keeps its identity.
 */
export function underTmdbRatings(
  cards: PosterCardMovie[],
  tmdbRatings: boolean
): PosterCardMovie[] {
  if (tmdbRatings) return cards;
  return cards.map((card) =>
    card.ratingSource === 'tmdb'
      ? { ...card, rating: null, ratingSource: null }
      : card
  );
}
