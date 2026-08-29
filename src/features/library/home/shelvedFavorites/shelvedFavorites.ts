import type { PosterCardMovie } from '@/types';

/**
 * The movies the Favorites shelf actually draws, out of the ones its home
 * section is holding. The two are not the same list: the hook never removes an
 * un-hearted movie from `favorites` — that indirection is what gives a refused
 * save a card to put back — so a section can hold movies and draw none.
 *
 * Written once because two callers need the same answer. `FavoritesRow` maps it
 * into cards, and `HomeRows`' empty guard counts it, and a screen whose guard
 * and whose shelf disagree about what is on screen renders nothing at all with
 * nothing to say about it.
 */
export function shelvedFavorites(movies: PosterCardMovie[]): PosterCardMovie[] {
  return movies.filter((movie) => movie.favorite);
}
