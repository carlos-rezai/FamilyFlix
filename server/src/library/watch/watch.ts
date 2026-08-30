import type { SqliteDatabase } from '../../db';

/** The watch-tracking slice: the hot resume-position write plus the two
 *  watched-flag toggles that drive the Continue Watching row. */
export interface Watch {
  setResumePosition(id: string, seconds: number): void;
  markWatched(id: string): void;
  markUnwatched(id: string): void;
}

export function createWatch(db: SqliteDatabase): Watch {
  const updateResumePosition = db.prepare(
    'UPDATE movies SET resume_position_seconds = ?, last_watched_at = ? WHERE id = ?'
  );
  const updateMarkWatched = db.prepare(
    'UPDATE movies SET watched = 1, resume_position_seconds = 0, last_watched_at = ? WHERE id = ?'
  );
  const updateMarkUnwatched = db.prepare(
    'UPDATE movies SET watched = 0 WHERE id = ?'
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

  // Deliberately does not stamp: un-marking is not watching. It leaves any
  // existing stamp exactly as it was, so correcting a mis-tap reshuffles
  // nothing, and it leaves the resume position at 0 so the movie cannot
  // re-enter the Continue Watching row anyway.
  function markUnwatched(id: string): void {
    updateMarkUnwatched.run(id);
  }

  return { setResumePosition, markWatched, markUnwatched };
}
