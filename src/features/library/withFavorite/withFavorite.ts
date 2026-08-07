import type { GenreRowModel } from '@/types';

/**
 * The rows with one movie's favorite flag set in every row it appears in. A
 * movie tagged with three genres has three cards, and they are one movie —
 * they must never disagree about whether it is a favorite.
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
    movies: row.movies.map((movie) =>
      movie.id === id ? { ...movie, favorite } : movie
    ),
  }));
}
