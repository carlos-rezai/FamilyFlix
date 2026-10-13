import type { SqliteDatabase } from '../../../db';

/** The series' curation slice: the Favorites toggle and the household rating
 *  over the series table — the movie's `curation` beside it. */
export interface SeriesCuration {
  /**
   * Set one series' favorite flag. Answers whether the library holds that
   * series — `false` for an unknown id, a movie's among them, touching nothing.
   */
  setSeriesFavorite(id: string, value: boolean): boolean;
  /**
   * Set one series' household rating in half-star units, or clear it with
   * `null`. Answers whether the library holds that series.
   */
  setSeriesRating(id: string, units: number | null): boolean;
}

export function createSeriesCuration(db: SqliteDatabase): SeriesCuration {
  const updateFavorite = db.prepare(
    'UPDATE series SET is_favorite = ? WHERE id = ?'
  );
  const updateRating = db.prepare('UPDATE series SET rating = ? WHERE id = ?');

  return {
    setSeriesFavorite: (id, value) =>
      updateFavorite.run(value ? 1 : 0, id).changes > 0,
    setSeriesRating: (id, units) => updateRating.run(units, id).changes > 0,
  };
}
