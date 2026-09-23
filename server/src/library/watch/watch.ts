import type { SqliteDatabase } from '../../db';

/** The watch-tracking slice: the hot resume-position write plus the two
 *  watched-flag toggles that drive the Continue Watching row. */
export interface Watch {
  setResumePosition(id: string, seconds: number): void;
  markWatched(id: string): void;
  markUnwatched(id: string): void;
  markEpisodeWatched(id: string): void;
  setEpisodeResumePosition(id: string, seconds: number): void;
  setEpisodeWatched(id: string, value: boolean): boolean;
  setSeasonWatched(seriesId: string, season: number, value: boolean): boolean;
}

export function createWatch(db: SqliteDatabase): Watch {
  const updateResumePosition = db.prepare(
    'UPDATE movies SET resume_position_seconds = ?, last_watched_at = ? WHERE id = ?'
  );
  const updateMarkWatched = db.prepare(
    'UPDATE movies SET watched = 1, resume_position_seconds = 0, last_watched_at = ? WHERE id = ?'
  );
  const updateMarkEpisodeWatched = db.prepare(
    'UPDATE episodes SET watched = 1, resume_position_seconds = 0, last_watched_at = ? WHERE id = ?'
  );
  const updateMarkUnwatched = db.prepare(
    'UPDATE movies SET watched = 0 WHERE id = ?'
  );
  const updateEpisodeResumePosition = db.prepare(
    'UPDATE episodes SET resume_position_seconds = ?, last_watched_at = ? WHERE id = ?'
  );
  const updateMarkEpisodeUnwatched = db.prepare(
    'UPDATE episodes SET watched = 0 WHERE id = ?'
  );
  const updateMarkSeasonWatched = db.prepare(
    'UPDATE episodes SET watched = 1, resume_position_seconds = 0, last_watched_at = ? WHERE series_id = ? AND season_number = ?'
  );
  const updateMarkSeasonUnwatched = db.prepare(
    'UPDATE episodes SET watched = 0 WHERE series_id = ? AND season_number = ?'
  );

  /** The stamp both writers share. Generated here rather than by SQLite's
   *  `datetime('now')`, which yields `YYYY-MM-DD HH:MM:SS` and would violate the
   *  ISO-strings code rule. */
  function watchedNow(): string {
    return new Date().toISOString();
  }

  function setResumePosition(id: string, seconds: number): void {
    updateResumePosition.run(seconds, watchedNow(), id);
  }

  function markWatched(id: string): void {
    updateMarkWatched.run(watchedNow(), id);
  }

  // The movie's markWatched over an episode: finishing it is watching it.
  function markEpisodeWatched(id: string): void {
    updateMarkEpisodeWatched.run(watchedNow(), id);
  }

  // Deliberately does not stamp: un-marking is not watching. It leaves any
  // existing stamp exactly as it was, so correcting a mis-tap reshuffles
  // nothing, and it leaves the resume position at 0 so the movie cannot
  // re-enter the Continue Watching row anyway.
  function markUnwatched(id: string): void {
    updateMarkUnwatched.run(id);
  }

  function setEpisodeResumePosition(id: string, seconds: number): void {
    updateEpisodeResumePosition.run(seconds, watchedNow(), id);
  }

  // The movie's watched toggle over one episode: watched forgets the resume
  // position, unwatched keeps it. Answers whether the library holds the
  // episode — a movie's id is not one.
  function setEpisodeWatched(id: string, value: boolean): boolean {
    const result = value
      ? updateMarkEpisodeWatched.run(watchedNow(), id)
      : updateMarkEpisodeUnwatched.run(id);
    return result.changes > 0;
  }

  // The same toggle over every episode of one season. A season is held only
  // while it has an episode, so no row touched is an unknown season.
  function setSeasonWatched(
    seriesId: string,
    season: number,
    value: boolean
  ): boolean {
    const result = value
      ? updateMarkSeasonWatched.run(watchedNow(), seriesId, season)
      : updateMarkSeasonUnwatched.run(seriesId, season);
    return result.changes > 0;
  }

  return {
    setResumePosition,
    markWatched,
    markUnwatched,
    markEpisodeWatched,
    setEpisodeResumePosition,
    setEpisodeWatched,
    setSeasonWatched,
  };
}
