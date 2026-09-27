/** Where the maintainer's TMDB key is read. */
const TMDB_KEY_ENDPOINT = '/api/tmdb/key';

/**
 * The stored TMDB key — `GET /api/tmdb/key`, `null` when none is stored. A
 * status that is not OK rejects.
 *
 * It lives on this rung because two features read it: the Settings hub's
 * `useTmdbKey` fills the Network group's field with it, and the Import flow
 * chooses the _Also fetch from TMDB_ card's hint by it — treating a rejection
 * as no key.
 */
export async function fetchTmdbKey(): Promise<string | null> {
  const response = await fetch(TMDB_KEY_ENDPOINT);

  if (!response.ok) {
    throw new Error(`GET ${TMDB_KEY_ENDPOINT} failed: ${response.status}`);
  }

  const { key } = (await response.json()) as { key: string | null };
  return key;
}
