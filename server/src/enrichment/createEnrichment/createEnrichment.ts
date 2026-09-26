import type { LibraryStorage } from '../../library';
import type { TmdbClient } from '../tmdbClient/tmdbClient';

/** What saving a key came to, as a value the route maps to a status. */
export type SaveKeyOutcome =
  | { kind: 'saved'; key: string }
  | { kind: 'empty' }
  | { kind: 'refused' }
  | { kind: 'unreachable' };

/**
 * The `enrichment/` domain, injected into the router so no route learns there
 * is a TMDB. This slice holds the key: read it, and test-and-save it in one.
 */
export interface Enrichment {
  /** The stored TMDB key, or `null` when none is. */
  key(): string | null;
  /**
   * Ask TMDB about `key` and store it only when TMDB accepts it; a refused or
   * unreachable key leaves whatever was stored before exactly as it was.
   */
  saveKey(key: unknown): Promise<SaveKeyOutcome>;
}

export interface EnrichmentDeps {
  storage: LibraryStorage;
  client: TmdbClient;
}

export function createEnrichment({
  storage,
  client,
}: EnrichmentDeps): Enrichment {
  function key(): string | null {
    return storage.tmdbKey();
  }

  async function saveKey(candidate: unknown): Promise<SaveKeyOutcome> {
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      return { kind: 'empty' };
    }
    // A pasted key often carries the whitespace around it; TMDB's never does.
    const trimmed = candidate.trim();
    const outcome = await client.authenticate(trimmed);
    if (outcome !== 'accepted') {
      return { kind: outcome };
    }
    storage.setTmdbKey(trimmed);
    return { kind: 'saved', key: trimmed };
  }

  return { key, saveKey };
}
