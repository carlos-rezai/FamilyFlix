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

/** One result of `/3/search/tv`, the fields a Sync reads. */
export interface TmdbTvResult {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string;
  genre_ids: number[];
  original_language: string;
  poster_path: string | null;
  vote_average: number;
}

/** `/3/tv/{id}?append_to_response=credits`, the fields a Sync reads. */
export interface TmdbTvDetail {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  last_air_date: string | null;
  genres: { id: number; name: string }[];
  vote_average: number;
  poster_path: string | null;
  backdrop_path: string | null;
  created_by: { name: string }[];
  credits: {
    cast: { name: string; order: number }[];
    crew: { name: string; job: string }[];
  };
}

/** One episode of `/3/tv/{id}/season/{n}`, the fields a Sync reads. */
export interface TmdbSeasonEpisode {
  episode_number: number;
  name: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
}

/** `/3/tv/{id}/season/{n}`, the fields a Sync reads. */
export interface TmdbSeason {
  season_number: number;
  episodes: TmdbSeasonEpisode[];
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
    year: number | null,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbMovieResult[]>>;
  /** `/3/movie/{id}` with its credits appended. */
  movie(
    key: string,
    id: number,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbMovieDetail>>;
  /** `/3/search/tv` for a title, and its first year when it has one. */
  searchTv(
    key: string,
    title: string,
    year: number | null,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbTvResult[]>>;
  /** `/3/tv/{id}` with its credits appended. */
  tv(
    key: string,
    id: number,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbTvDetail>>;
  /** `/3/tv/{id}/season/{n}`: one season's episodes. */
  season(
    key: string,
    id: number,
    seasonNumber: number,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbSeason>>;
  /**
   * An image's bytes off `image.tmdb.org`, as a stream. Each of the three
   * takes the caller's signal last: aborting it aborts the request in flight,
   * and the call still answers a value.
   */
  image(path: string, signal?: AbortSignal): Promise<TmdbOutcome<Readable>>;
  /**
   * The short reachability probe, asked with no key: any answer from TMDB's
   * API — a `401` included — is `true`; a network error or no answer within
   * `probeTimeoutMs` is `false`. Never throws.
   */
  reachable(): Promise<boolean>;
}

export interface TmdbClientOptions {
  /** How long a request may go unanswered before TMDB counts as unreachable. */
  timeoutMs?: number;
  /** How long the reachability probe waits before TMDB counts as offline. */
  probeTimeoutMs?: number;
}

const TMDB_ORIGIN = 'https://api.themoviedb.org';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/original';
/** Every answer fixed to one language, whatever machine asks. */
const LANGUAGE = 'en-US';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_PROBE_TIMEOUT_MS = 3000;

/**
 * A TMDB client over an injected `fetch`, so nothing that composes one in a
 * test goes online. `main.ts` hands it the global `fetch`.
 */
export function createTmdbClient(
  fetchImpl: typeof fetch,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    probeTimeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
  }: TmdbClientOptions = {}
): TmdbClient {
  /** One GET under the key and the timeout; `null` when nothing answered. */
  async function get(
    path: string,
    key: string,
    params: Record<string, string> = {},
    signal?: AbortSignal
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

    return send(url, headers, signal);
  }

  /** One request under the timeout; `null` when nothing answered. */
  async function send(
    url: URL,
    headers: Headers,
    signal?: AbortSignal
  ): Promise<Response | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal?.aborted) {
      controller.abort();
    } else {
      signal?.addEventListener('abort', onAbort, { once: true });
    }
    try {
      return await fetchImpl(url, { headers, signal: controller.signal });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
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
    year: number | null,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbMovieResult[]>> {
    const params: Record<string, string> = { query: title, language: LANGUAGE };
    if (year !== null) {
      params.year = String(year);
    }
    const outcome = await json<{ results: TmdbMovieResult[] }>(
      await get('/3/search/movie', key, params, signal)
    );
    return outcome.kind === 'ok'
      ? { kind: 'ok', value: outcome.value.results }
      : outcome;
  }

  async function movie(
    key: string,
    id: number,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbMovieDetail>> {
    return json<TmdbMovieDetail>(
      await get(
        `/3/movie/${id}`,
        key,
        { append_to_response: 'credits', language: LANGUAGE },
        signal
      )
    );
  }

  async function searchTv(
    key: string,
    title: string,
    year: number | null,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbTvResult[]>> {
    const params: Record<string, string> = { query: title, language: LANGUAGE };
    if (year !== null) {
      params.first_air_date_year = String(year);
    }
    const outcome = await json<{ results: TmdbTvResult[] }>(
      await get('/3/search/tv', key, params, signal)
    );
    return outcome.kind === 'ok'
      ? { kind: 'ok', value: outcome.value.results }
      : outcome;
  }

  async function tv(
    key: string,
    id: number,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbTvDetail>> {
    return json<TmdbTvDetail>(
      await get(
        `/3/tv/${id}`,
        key,
        { append_to_response: 'credits', language: LANGUAGE },
        signal
      )
    );
  }

  async function season(
    key: string,
    id: number,
    seasonNumber: number,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbSeason>> {
    return json<TmdbSeason>(
      await get(
        `/3/tv/${id}/season/${seasonNumber}`,
        key,
        { language: LANGUAGE },
        signal
      )
    );
  }

  async function image(
    path: string,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<Readable>> {
    const response = await send(
      new URL(`${IMAGE_BASE}${path}`),
      new Headers(),
      signal
    );
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

  async function reachable(): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), probeTimeoutMs);
    try {
      await fetchImpl(new URL('/3/configuration', TMDB_ORIGIN), {
        headers: new Headers({ Accept: 'application/json' }),
        signal: controller.signal,
      });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    authenticate,
    searchMovie,
    movie,
    searchTv,
    tv,
    season,
    image,
    reachable,
  };
}
