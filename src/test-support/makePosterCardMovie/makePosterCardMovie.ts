import type { PosterCardMovie } from '@/types';

/**
 * Build a complete `PosterCardMovie` for a test, overriding only what that test
 * cares about — the view-model counterpart to `makeMovie`.
 *
 * Four files build this shape (CardCarousel, GenreRow, FavoritesRow,
 * LibraryGrid), three of them from a byte-identical literal, so the same bill
 * `Movie` sent in issue 80 was accruing here one rung down. The defaults are
 * those three copies' specimen, adopted unchanged.
 *
 * `ContinueCardMovie` deliberately has no builder here: one file renders it,
 * and a shape with one caller stays at its call site.
 */
export function makePosterCardMovie(
  overrides: Partial<PosterCardMovie> = {}
): PosterCardMovie {
  return {
    id: 'm1',
    title: 'Comet Season',
    posterUrl: null,
    g1: '#1f2a3a',
    g2: '#3a6a8a',
    rating: 80,
    watched: false,
    progress: 0,
    favorite: false,
    ...overrides,
  };
}
