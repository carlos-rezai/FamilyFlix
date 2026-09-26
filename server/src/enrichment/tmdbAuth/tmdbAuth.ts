/**
 * How a TMDB key is sent. themoviedb.org → Settings → API hands out a v4
 * **Read Access Token** — a JWT, sent as `Authorization: Bearer` — beside a v3
 * **API key**, sent as the `api_key` query parameter, and the maintainer may
 * paste either.
 */
export type TmdbAuth =
  | { version: 'v4'; bearer: string }
  | { version: 'v3'; apiKey: string };

/** Three base64url segments, the header's `{"` encoded as `eyJ` first. */
const JWT_SHAPE = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Pure: a key → how to send it, told apart by shape alone. A JWT-shaped string
 * is a v4 token; anything else is a v3 key.
 */
export function tmdbAuth(key: string): TmdbAuth {
  return JWT_SHAPE.test(key)
    ? { version: 'v4', bearer: key }
    : { version: 'v3', apiKey: key };
}
