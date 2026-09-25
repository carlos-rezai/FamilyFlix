import type { SqliteDatabase } from '../../../db';

/**
 * The series' watch-tracking slice: the movie's `watch/` rules over the
 * `episodes` table — the hot resume-position write, the watched toggle on one
 * episode, and the same toggle over a whole season. A series carries no watch
 * state of its own; it is derived from its episodes on every read.
 */
export interface SeriesWatch {
  /** `setResumePosition` over an **Episode**: the position, stamped. */
  setEpisodeResumePosition(id: string, seconds: number): void;
  /**
   * The movie's watched toggle over one **Episode** — watched zeroes the resume
   * position and stamps, unwatched keeps both. Answers whether the library
   * holds it; a movie's id is not one.
   */
  setEpisodeWatched(id: string, value: boolean): boolean;
  /**
   * {@link setEpisodeWatched} over every episode of one season. Answers whether
   * the series holds that season — `false` for an unknown series, a movie's id
   * among them, or a season with no episodes.
   */
  setSeasonWatched(seriesId: string, season: number, value: boolean): boolean;
}

export function createSeriesWatch(db: SqliteDatabase): SeriesWatch {
  const updateResumePosition = db.prepare(
    'UPDATE episodes SET resume_position_seconds = ?, last_watched_at = ? WHERE id = ?'
  );
  const updateMarkWatched = db.prepare(
    'UPDATE episodes SET watched = 1, resume_position_seconds = 0, last_watched_at = ? WHERE id = ?'
  );
  const updateMarkUnwatched = db.prepare(
    'UPDATE episodes SET watched = 0 WHERE id = ?'
  );
  const updateMarkSeasonWatched = db.prepare(
    'UPDATE episodes SET watched = 1, resume_position_seconds = 0, last_watched_at = ? WHERE series_id = ? AND season_number = ?'
  );
  const updateMarkSeasonUnwatched = db.prepare(
    'UPDATE episodes SET watched = 0 WHERE series_id = ? AND season_number = ?'
  );

  /** The stamp every writer here shares — an ISO string, as the movie's
   *  `watch/` generates it, never SQLite's `datetime('now')`. */
  function watchedNow(): string {
    return new Date().toISOString();
  }

  return {
    setEpisodeResumePosition: (id, seconds) => {
      updateResumePosition.run(seconds, watchedNow(), id);
    },

    // Watched forgets the resume position; unwatched keeps it and the stamp,
    // so correcting a mis-tap reshuffles nothing — the movie's rule.
    setEpisodeWatched: (id, value) =>
      (value
        ? updateMarkWatched.run(watchedNow(), id)
        : updateMarkUnwatched.run(id)
      ).changes > 0,

    // A season is held only while it has an episode, so no row touched is an
    // unknown season.
    setSeasonWatched: (seriesId, season, value) =>
      (value
        ? updateMarkSeasonWatched.run(watchedNow(), seriesId, season)
        : updateMarkSeasonUnwatched.run(seriesId, season)
      ).changes > 0,
  };
}
