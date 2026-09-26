import { tmdbAuth } from '../tmdbAuth/tmdbAuth';

/** What TMDB made of a key, as a value — the client never throws. */
export type TmdbAuthOutcome = 'accepted' | 'refused' | 'unreachable';

/**
 * The injected seam of the `enrichment/` domain: what can be asked of TMDB.
 * Nothing else in the server is a network client.
 */
export interface TmdbClient {
  /**
   * `/3/authentication` with the key sent the way its shape says: **accepted**
   * on a `200`, **refused** on a `401`, **unreachable** on a network error, a
   * timeout, or any other answer.
   */
  authenticate(key: string): Promise<TmdbAuthOutcome>;
}

export interface TmdbClientOptions {
  /** How long a request may go unanswered before TMDB counts as unreachable. */
  timeoutMs?: number;
}

const TMDB_ORIGIN = 'https://api.themoviedb.org';
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * A TMDB client over an injected `fetch`, so nothing that composes one in a
 * test goes online. `main.ts` hands it the global `fetch`.
 */
export function createTmdbClient(
  fetchImpl: typeof fetch,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: TmdbClientOptions = {}
): TmdbClient {
  /** One GET under the key and the timeout; `null` when nothing answered. */
  async function get(path: string, key: string): Promise<Response | null> {
    const url = new URL(path, TMDB_ORIGIN);
    const headers = new Headers({ Accept: 'application/json' });
    const auth = tmdbAuth(key);
    if (auth.version === 'v4') {
      headers.set('Authorization', `Bearer ${auth.bearer}`);
    } else {
      url.searchParams.set('api_key', auth.apiKey);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { headers, signal: controller.signal });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function authenticate(key: string): Promise<TmdbAuthOutcome> {
    const response = await get('/3/authentication', key);
    if (response === null) {
      return 'unreachable';
    }
    if (response.status === 401) {
      return 'refused';
    }
    return response.ok ? 'accepted' : 'unreachable';
  }

  return { authenticate };
}
