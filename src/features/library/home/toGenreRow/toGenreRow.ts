import type { GenreRowModel, HomeRow } from '@/types';
import { view } from '../../view/view';

/**
 * Maps one row of the home payload to the row a `GenreRow` renders: the genre
 * and its true total pass through untouched, and each movie is narrowed to the
 * card view model through `view`. The count is the genre's full total, not the
 * number of cards in the row — "View all 214" above two cards is correct.
 */
export function toGenreRow(row: HomeRow): GenreRowModel {
  return { genre: row.genre, count: row.count, movies: row.movies.map(view) };
}
