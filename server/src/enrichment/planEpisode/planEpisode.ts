import type { EnrichField, Episode } from '@/types';
import type { EpisodeEnrichment } from '../../library';
import type { TmdbSeasonEpisode } from '../tmdbClient/tmdbClient';

/** What one episode is to be given: its columns, and the still to fetch. */
export interface EpisodePlan {
  /** The columns to write; empty when there is nothing to fill. */
  enrichment: EpisodeEnrichment;
  /** TMDB's image path for the **Still** wanted, or `null` for none. */
  still: string | null;
}

/** An empty string or `null`: nothing there yet. */
const blank = (value: string | null): boolean =>
  value === null || value.trim() === '';

/**
 * Pure: an **Episode** on disk × TMDB's episode of the same number × the chips
 * → what a **Sync** writes on it. Title and air date are filled when empty,
 * whatever the chips; the runtime only under Runtime and only when empty; a
 * **Still** is wanted only under Poster and only when none is held. Never a
 * **Decision**, never the watch state.
 */
export function planEpisode(
  episode: Episode,
  theirs: TmdbSeasonEpisode,
  fields: readonly EnrichField[]
): EpisodePlan {
  const enrichment: EpisodeEnrichment = {};
  if (blank(episode.title) && theirs.name && theirs.name.trim() !== '') {
    enrichment.title = theirs.name;
  }
  if (blank(episode.airDate) && theirs.air_date) {
    enrichment.airDate = theirs.air_date;
  }
  if (
    fields.includes('runtime') &&
    episode.runtimeMinutes === null &&
    theirs.runtime
  ) {
    enrichment.runtimeMinutes = theirs.runtime;
  }
  const still =
    fields.includes('poster') && episode.stillPath === null && theirs.still_path
      ? theirs.still_path
      : null;
  return { enrichment, still };
}
