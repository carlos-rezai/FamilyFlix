import type { RatingSource } from '@/types';

/** The mark after a TMDB-drawn value — the one spelling of the word. */
export const TMDB_TAG = 'TMDB';

/** What `StarRating` is handed to tell a TMDB-drawn rating from the family's. */
export interface TmdbMarks {
  tag: string | undefined;
}

/**
 * The **TMDB-marked stars** for a **Rating source**: tagged when the stars
 * draw TMDB's rating, plain for the household's Rating and for none. The
 * primitive stays domain-free; every surface that draws stars asks here rather
 * than spelling the mapping itself.
 */
export function tmdbMarks(source: RatingSource | null): TmdbMarks {
  return source === 'tmdb' ? { tag: TMDB_TAG } : { tag: undefined };
}
