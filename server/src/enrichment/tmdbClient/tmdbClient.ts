import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

import { tmdbAuth } from '../tmdbAuth/tmdbAuth';

/** What TMDB made of a key, as a value — the client never throws. */
export type TmdbAuthOutcome = 'accepted' | 'refused' | 'unreachable';

/** An answer from TMDB as a value: the body, or why there is none. */
export type TmdbOutcome<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'refused' }
  | { kind: 'unreachable' };

/** One result of `/3/search/movie`, the fields a Sync reads. */
export interface TmdbMovieResult {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  genre_ids: number[];
  original_language: string;
  poster_path: string | null;
  vote_average: number;
}

/** `/3/movie/{id}?append_to_response=credits`, the fields a Sync reads. */
export interface TmdbMovieDetail {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
  vote_average: number;
  poster_path: string | null;
  backdrop_path: string | null;
  credits: {
    cast: { name: string; order: number }[];
    crew: { name: string; job: string }[];
  };
}

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
  /** `/3/search/movie` for a title, and its year when it has one. */
  searchMovie(
    key: string,
    title: string,
    year: number | null
  ): Promise<TmdbOutcome<TmdbMovieResult[]>>;
  /** `/3/movie/{id}` with its credits appended. */
  movie(key: string, id: number): Promise<TmdbOutcome<TmdbMovieDetail>>;
  /** An image's bytes off `image.tmdb.org`, as a stream. */
  image(path: string): Promise<TmdbOutcome<Readable>>;
}

export interface TmdbClientOptions {
  /** How long a request may go unanswered before TMDB counts as unreachable. */
  timeoutMs?: number;
}

const TMDB_ORIGIN = 'https://api.themoviedb.org';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/original';
/** Every answer fixed to one language, whatever machine asks. */
const LANGUAGE = 'en-US';
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
  async function get(
    path: string,
    key: string,
    params: Record<string, string> = {}
  ): Promise<Response | null> {
    const url = new URL(path, TMDB_ORIGIN);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }
    const headers = new Headers({ Accept: 'application/json' });
    const auth = tmdbAuth(key);
    if (auth.version === 'v4') {
      headers.set('Authorization', `Bearer ${auth.bearer}`);
    } else {
      url.searchParams.set('api_key', auth.apiKey);
    }

    return send(url, headers);
  }

  /** One request under the timeout; `null` when nothing answered. */
  async function send(url: URL, headers: Headers): Promise<Response | null> {
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

  /** A JSON body as a value, or why there is none. */
  async function json<T>(response: Response | null): Promise<TmdbOutcome<T>> {
    if (response === null) return { kind: 'unreachable' };
    if (response.status === 401) return { kind: 'refused' };
    if (!response.ok) return { kind: 'unreachable' };
    try {
      return { kind: 'ok', value: (await response.json()) as T };
    } catch {
      return { kind: 'unreachable' };
    }
  }

  async function searchMovie(
    key: string,
    title: string,
    year: number | null
  ): Promise<TmdbOutcome<TmdbMovieResult[]>> {
    const params: Record<string, string> = { query: title, language: LANGUAGE };
    if (year !== null) {
      params.year = String(year);
    }
    const outcome = await json<{ results: TmdbMovieResult[] }>(
      await get('/3/search/movie', key, params)
    );
    return outcome.kind === 'ok'
      ? { kind: 'ok', value: outcome.value.results }
      : outcome;
  }

  async function movie(
    key: string,
    id: number
  ): Promise<TmdbOutcome<TmdbMovieDetail>> {
    return json<TmdbMovieDetail>(
      await get(`/3/movie/${id}`, key, {
        append_to_response: 'credits',
        language: LANGUAGE,
      })
    );
  }

  async function image(path: string): Promise<TmdbOutcome<Readable>> {
    const response = await send(new URL(`${IMAGE_BASE}${path}`), new Headers());
    if (response === null || !response.ok || response.body === null) {
      return { kind: 'unreachable' };
    }
    return {
      kind: 'ok',
      value: Readable.fromWeb(response.body as WebReadableStream<Uint8Array>),
    };
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

  return { authenticate, searchMovie, movie, image };
}
