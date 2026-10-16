import type { EnrichField, SeasonSummary } from '@/types';
import type { TmdbPoster, TmdbSeason } from '../tmdbClient/tmdbClient';

/** What one season is to be given: the **Season poster** to fetch. */
export interface SeasonPlan {
  /** TMDB's image path for the Season poster wanted, or `null` for none. */
  poster: string | null;
}

/**
 * Pure: a **Season** on disk × TMDB's season of the same number × the chips →
 * the **Season poster** a **Sync** fetches: only under Poster, only when none
 * is held, never replaced, never a **Decision** — modelled on the TMDB
 * **Still**'s rule. When TMDB has no default poster, the top of the season's
 * `images` — ordered by vote, in any language — is the poster instead.
 */
export function planSeason(
  season: SeasonSummary,
  theirs: TmdbSeason,
  fields: readonly EnrichField[],
  images: readonly TmdbPoster[] = []
): SeasonPlan {
  if (!wantsSeasonPoster(season, fields)) return { poster: null };
  return { poster: theirs.poster_path || images[0]?.file_path || null };
}

/** Whether a Season's poster is wanted at all: under Poster, none held. */
export function wantsSeasonPoster(
  season: SeasonSummary,
  fields: readonly EnrichField[]
): boolean {
  return fields.includes('poster') && season.posterPath === null;
}
