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
    'UPDATE movies SET resume_position_seconds = ? WHERE id = ?'
  );
  const updateMarkWatched = db.prepare(
    'UPDATE movies SET watched = 1, resume_position_seconds = 0 WHERE id = ?'
  );
  const updateMarkUnwatched = db.prepare(
    'UPDATE movies SET watched = 0 WHERE id = ?'
  );

  function setResumePosition(id: string, seconds: number): void {
    updateResumePosition.run(seconds, id);
  }

  function markWatched(id: string): void {
    updateMarkWatched.run(id);
  }

  function markUnwatched(id: string): void {
    updateMarkUnwatched.run(id);
  }

  return { setResumePosition, markWatched, markUnwatched };
}
