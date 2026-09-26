import type { TmdbClient } from '../../enrichment/tmdbClient/tmdbClient';

/**
 * A TMDB client that never goes online: every question answers
 * **unreachable**. For the suites that compose the router for something else
 * and must still hand it an `enrichment/` domain.
 */
export function offlineTmdb(): TmdbClient {
  const unreachable = { kind: 'unreachable' } as const;
  return {
    authenticate: () => Promise.resolve('unreachable'),
    searchMovie: () => Promise.resolve(unreachable),
    movie: () => Promise.resolve(unreachable),
    image: () => Promise.resolve(unreachable),
  };
}
