import type { SqliteDatabase } from '../../db';

/** The **Art sweep**'s slice: every picture the rows hold. */
export interface HeldArtRepository {
  heldArt(): string[];
}

/**
 * Every image **Stored path** the rows name: each movie's and series' poster
 * and backdrop, each **Season poster**, each episode's **Still**. Art is
 * always copied in, so each one is a Managed path. An empty slot is no path.
 */
export function createHeldArt(db: SqliteDatabase): HeldArtRepository {
  const select = db.prepare(
    `SELECT poster_path AS path FROM movies WHERE poster_path IS NOT NULL
     UNION ALL SELECT backdrop_path FROM movies WHERE backdrop_path IS NOT NULL
     UNION ALL SELECT poster_path FROM series WHERE poster_path IS NOT NULL
     UNION ALL SELECT backdrop_path FROM series WHERE backdrop_path IS NOT NULL
     UNION ALL SELECT poster_path FROM season_posters
     UNION ALL SELECT still_path FROM episodes WHERE still_path IS NOT NULL`
  );

  return {
    heldArt() {
      return (select.all() as { path: string }[]).map((row) => row.path);
    },
  };
}
