import type { SqliteDatabase } from '../../../db';

/** The series' curation slice: the Favorites toggle over the series table —
 *  the movie's `curation` beside it. A series carries no household rating. */
export interface SeriesCuration {
  /**
   * Set one series' favorite flag. Answers whether the library holds that
   * series — `false` for an unknown id, a movie's among them, touching nothing.
   */
  setSeriesFavorite(id: string, value: boolean): boolean;
}

export function createSeriesCuration(db: SqliteDatabase): SeriesCuration {
  const updateFavorite = db.prepare(
    'UPDATE series SET is_favorite = ? WHERE id = ?'
  );

  return {
    setSeriesFavorite: (id, value) =>
      updateFavorite.run(value ? 1 : 0, id).changes > 0,
  };
}
