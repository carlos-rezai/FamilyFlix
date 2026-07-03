import type { SqliteDatabase } from '../../db';

/** The curation slice: the two single-column household signals — the Favorites
 *  toggle and the 0–10 half-star rating (nullable to clear back to unrated). */
export interface Curation {
  setFavorite(id: string, value: boolean): void;
  setRating(id: string, units: number | null): void;
}

export function createCuration(db: SqliteDatabase): Curation {
  const updateFavorite = db.prepare(
    'UPDATE movies SET is_favorite = ? WHERE id = ?'
  );
  const updateRating = db.prepare('UPDATE movies SET rating = ? WHERE id = ?');

  function setFavorite(id: string, value: boolean): void {
    updateFavorite.run(value ? 1 : 0, id);
  }

  function setRating(id: string, units: number | null): void {
    updateRating.run(units, id);
  }

  return { setFavorite, setRating };
}
