import type { EnrichField, Episode } from '@/types';
import type { EpisodeEnrichment, StillSource } from '../../library';
import type { TmdbSeasonEpisode } from '../tmdbClient/tmdbClient';

/**
 * The **Still** an episode is to be given: TMDB's, by its image path, with the
 * held **Frame still** it replaces — `null` when nothing is held — or a
 * **Frame still** off its own video; or `null` for none.
 */
export type StillPlan =
  | { kind: 'tmdb'; path: string; replaces: string | null }
  | { kind: 'frame' }
  | null;

/** What one episode is to be given: its columns, and the still to take. */
export interface EpisodePlan {
  /** The columns to write; empty when there is nothing to fill. */
  enrichment: EpisodeEnrichment;
  /** The still wanted, or `null` for none. */
  still: StillPlan;
}

/** An empty string or `null`: nothing there yet. */
const blank = (value: string | null): boolean =>
  value === null || value.trim() === '';

/**
 * The still rule, under Poster only: TMDB's when it offers one and nothing is
 * held or only a frame is; a frame when nothing is held and TMDB offers none
 * or does not list the episode; never over a TMDB or picked still, and never a
 * second frame.
 */
function planStill(
  theirs: TmdbSeasonEpisode | undefined,
  fields: readonly EnrichField[],
  heldPath: string | null,
  held: StillSource | null
): StillPlan {
  if (!fields.includes('poster')) return null;
  const offered = theirs?.still_path;
  if (offered && (held === null || held === 'frame')) {
    return {
      kind: 'tmdb',
      path: offered,
      replaces: held === 'frame' ? heldPath : null,
    };
  }
  return held === null ? { kind: 'frame' } : null;
}

/**
 * Pure: an **Episode** on disk × TMDB's episode of the same number — absent
 * when TMDB does not list it — × the chips × its held **Still source** → what
 * a **Sync** writes on it. Title and air date are filled when empty, whatever
 * the chips; the runtime only under Runtime and only when empty — all three
 * only when TMDB lists the episode. The still follows `planStill`. Never a
 * **Decision**, never the watch state.
 */
export function planEpisode(
  episode: Episode,
  theirs: TmdbSeasonEpisode | undefined,
  fields: readonly EnrichField[],
  held: StillSource | null
): EpisodePlan {
  const enrichment: EpisodeEnrichment = {};
  const still = planStill(theirs, fields, episode.stillPath, held);
  if (theirs === undefined) return { enrichment, still };
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
  return { enrichment, still };
}
