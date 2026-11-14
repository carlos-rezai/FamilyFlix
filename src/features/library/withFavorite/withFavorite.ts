import type { HomeRow } from '@/types';

/** Any **Title** a heart can land on: a **Movie** or a **Series**. */
export interface Heartable {
  id: string;
  isFavorite: boolean;
}

/**
 * The titles with one of them's favorite flag set. The list comes back at its
 * own length and in its own order — the server decided which cards are on the
 * grid and where; a heart only ever changes what one of them says about itself.
 *
 * Pure: the titles handed in are never mutated, so an optimistic value can be
 * applied and reverted from the same source list.
 */
export function withFavoriteInList<T extends Heartable>(
  titles: T[],
  id: string,
  favorite: boolean
): T[] {
  return titles.map((title) =>
    title.id === id ? { ...title, isFavorite: favorite } : title
  );
}

/**
 * The Favorites shelf with one title's favorite flag set — and, for a heart on
 * a title the shelf does not hold yet, that title's record put at the front,
 * found among the records the heart can come from (the caller flattens its
 * rows into them). The shelf was loaded as a snapshot, so a title hearted from
 * a genre row has no card on it to flip; this is what gives it one.
 *
 * Nothing is ever removed: an un-hearted title stays with its flag false, and
 * `shelvedFavorites` leaves it out, so a refused save has a card to put back.
 * A heart on a title none of the records carries has nothing to shelve, and
 * the shelf comes back flipped and nothing more.
 *
 * Pure: the shelf and records handed in are never mutated.
 */
export function withShelved<T extends Heartable>(
  favorites: T[],
  records: T[],
  id: string,
  favorite: boolean
): T[] {
  if (!favorite || favorites.some((title) => title.id === id)) {
    return withFavoriteInList(favorites, id, favorite);
  }

  const record = records.find((title) => title.id === id);
  return record === undefined
    ? favorites
    : [{ ...record, isFavorite: favorite }, ...favorites];
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
  rows: HomeRow[],
  id: string,
  favorite: boolean
): HomeRow[] {
  return rows.map((row) => ({
    ...row,
    movies: withFavoriteInList(row.movies, id, favorite),
  }));
}
