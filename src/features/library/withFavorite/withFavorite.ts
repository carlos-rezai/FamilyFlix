import type { GenreRowModel, PosterCardMovie } from '@/types';

/**
 * The movies with one of them's favorite flag set. The list comes back at its
 * own length and in its own order — the server decided which cards are on the
 * grid and where; a heart only ever changes what one of them says about itself.
 *
 * Pure: the movies handed in are never mutated, so an optimistic value can be
 * applied and reverted from the same source list.
 */
export function withFavoriteInList(
  movies: PosterCardMovie[],
  id: string,
  favorite: boolean
): PosterCardMovie[] {
  return movies.map((movie) =>
    movie.id === id ? { ...movie, favorite } : movie
  );
}

/**
 * The Favorites shelf with one movie's favorite flag set — and, for a heart on
 * a movie the shelf does not hold yet, that movie's card from the rows put at
 * the front. The shelf was loaded as a snapshot, so a movie hearted from a
 * genre row has no card on it to flip; this is what gives it one.
 *
 * Nothing is ever removed: an un-hearted movie stays with its flag false, and
 * `shelvedFavorites` leaves it out, so a refused save has a card to put back.
 * A heart on a movie no row carries either has nothing to shelve, and the shelf
 * comes back flipped and nothing more.
 *
 * Pure: the shelf and rows handed in are never mutated.
 */
export function withShelved(
  favorites: PosterCardMovie[],
  rows: GenreRowModel[],
  id: string,
  favorite: boolean
): PosterCardMovie[] {
  if (!favorite || favorites.some((movie) => movie.id === id)) {
    return withFavoriteInList(favorites, id, favorite);
  }

  const card = rows
    .flatMap((row) => row.movies)
    .find((movie) => movie.id === id);
  return card === undefined ? favorites : [{ ...card, favorite }, ...favorites];
}

/**
 * The rows with one movie's favorite flag set in every row it appears in. A
 * movie tagged with three genres has three cards, and they are one movie —
 * they must never disagree about whether it is a favorite.
 *
 * The same rule as {@link withFavoriteInList}, applied row by row: a row's
 * movies *are* a flat list, so setting the flag across rows is that one concept
 * repeated, not a second one. Only the shape around the list differs.
 *
 * Pure: the rows handed in are never mutated, so an optimistic value can be
 * applied and reverted from the same source rows.
 */
export function withFavorite(
  rows: GenreRowModel[],
  id: string,
  favorite: boolean
): GenreRowModel[] {
  return rows.map((row) => ({
    ...row,
    movies: withFavoriteInList(row.movies, id, favorite),
  }));
}
