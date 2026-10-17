import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

import { tmdbAuth } from '../tmdbAuth/tmdbAuth';

/** What TMDB made of a key, as a value — the client never throws. */
export type TmdbAuthOutcome = 'accepted' | 'refused' | 'unreachable';

/** An answer from TMDB as a value: the body, or why there is none. */
export type TmdbOutcome<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'refused' }
  | { kind: 'unreachable' }
  /** TMDB answered `404`: it holds no such thing — not a lost connection. */
  | { kind: 'not-found' };

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
  /** The **Season poster**'s image path, or `null` when TMDB has none. */
  poster_path: string | null;
  episodes: TmdbSeasonEpisode[];
}

/**
 * One poster off an `/images` call — a season's,
 * `/3/tv/{id}/season/{n}/images`, or a show's own, `/3/tv/{id}/images`.
 */
export interface TmdbPoster {
  file_path: string;
  vote_average: number;
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
   * `/3/tv/{id}/season/{n}/images`: a season's posters, highest vote first —
   * asked in English or no language, then again with no language filter when
   * that answers none.
   */
  seasonImages(
    key: string,
    id: number,
    seasonNumber: number,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbPoster[]>>;
  /**
   * `/3/tv/{id}/images`: a show's own posters, highest vote first — asked as
   * `seasonImages` asks, in English or no language, then with no filter.
   */
  seriesImages(
    key: string,
    id: number,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbPoster[]>>;
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
  /**
   * How a `429`'s `Retry-After` is waited out — resolving early once `signal`
   * aborts. A real timer unless a test hands in its own.
   */
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** How many times a `429` is asked again before it counts as unreachable. */
  rateLimitRetries?: number;
}

const TMDB_ORIGIN = 'https://api.themoviedb.org';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/original';
/** Every answer fixed to one language, whatever machine asks. */
const LANGUAGE = 'en-US';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_PROBE_TIMEOUT_MS = 3000;
const DEFAULT_RATE_LIMIT_RETRIES = 3;
/** A `429`'s wait when its `Retry-After` is absent or unreadable. */
const DEFAULT_RETRY_AFTER_MS = 1000;
/** The longest a single `Retry-After` is waited, whatever TMDB asks. */
const MAX_RETRY_AFTER_MS = 10_000;

/** A real timer, cut short when the signal aborts. */
function waitFor(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/** A `Retry-After` in seconds → milliseconds to wait, bounded. */
function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get('Retry-After'));
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_RETRY_AFTER_MS;
  return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
}

/**
 * A TMDB client over an injected `fetch`, so nothing that composes one in a
 * test goes online. `main.ts` hands it the global `fetch`.
 */
export function createTmdbClient(
  fetchImpl: typeof fetch,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    probeTimeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
    wait = waitFor,
    rateLimitRetries = DEFAULT_RATE_LIMIT_RETRIES,
  }: TmdbClientOptions = {}
): TmdbClient {
  /**
   * One GET under the key and the timeout; `null` when nothing answered. A
   * `429` is waited out for its `Retry-After` and asked again, at most
   * `rateLimitRetries` times; the last `429` is answered as it came.
   */
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

    let response = await send(url, headers, signal);
    for (
      let retry = 0;
      retry < rateLimitRetries && response?.status === 429 && !signal?.aborted;
      retry += 1
    ) {
      await wait(retryAfterMs(response), signal);
      if (signal?.aborted) break;
      response = await send(url, headers, signal);
    }
    return response;
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
    if (response.status === 404) return { kind: 'not-found' };
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

  function seasonImages(
    key: string,
    id: number,
    seasonNumber: number,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbPoster[]>> {
    return posters(`/3/tv/${id}/season/${seasonNumber}/images`, key, signal);
  }

  function seriesImages(
    key: string,
    id: number,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbPoster[]>> {
    return posters(`/3/tv/${id}/images`, key, signal);
  }

  /**
   * The posters an `/images` path answers, highest vote first: asked in
   * English or no language, then with no filter when that answers none.
   */
  async function posters(
    path: string,
    key: string,
    signal?: AbortSignal
  ): Promise<TmdbOutcome<TmdbPoster[]>> {
    const ask = async (
      params: Record<string, string>
    ): Promise<TmdbOutcome<TmdbPoster[]>> => {
      const outcome = await json<{ posters?: TmdbPoster[] }>(
        await get(path, key, params, signal)
      );
      if (outcome.kind !== 'ok') return outcome;
      const found = (outcome.value.posters ?? [])
        .map(({ file_path, vote_average }) => ({ file_path, vote_average }))
        .sort((a, b) => b.vote_average - a.vote_average);
      return { kind: 'ok', value: found };
    };
    const english = await ask({ include_image_language: 'en,null' });
    if (english.kind !== 'ok' || english.value.length > 0) return english;
    return ask({});
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
    seasonImages,
    seriesImages,
    image,
    reachable,
  };
}
