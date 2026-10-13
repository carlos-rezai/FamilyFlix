import type { EnrichField } from '@/types';
import type { TmdbSeason } from '../tmdbClient/tmdbClient';

/** What one season is to be given: the **Season poster** to fetch. */
export interface SeasonPlan {
  /** TMDB's image path for the Season poster wanted, or `null` for none. */
  poster: string | null;
}

/**
 * Pure: the **Season poster** held × TMDB's season of the same number × the
 * chips → the poster a **Sync** fetches. The Still's rule: only under Poster,
 * only when none is held, never replaced, never a **Decision**.
 */
export function planSeason(
  held: string | null,
  theirs: TmdbSeason,
  fields: readonly EnrichField[]
): SeasonPlan {
  const poster =
    fields.includes('poster') && held === null && theirs.poster_path
      ? theirs.poster_path
      : null;
  return { poster };
}
