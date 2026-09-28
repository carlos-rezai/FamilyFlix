import { Readable } from 'node:stream';
import { expect, vi, type Mock } from 'vitest';

import type { EnrichmentRun } from '@/types';
import type {
  TmdbAuthOutcome,
  TmdbClient,
  TmdbMovieDetail,
  TmdbMovieResult,
  TmdbOutcome,
  TmdbSeason,
  TmdbTvDetail,
  TmdbTvResult,
} from '../../enrichment/tmdbClient/tmdbClient';

/** A key TMDB's shape accepts: 32 hex characters. */
export const TMDB_KEY = '0123456789abcdef0123456789abcdef';

/**
 * What the fake knows, one table per question. A search for a title the table
 * does not list answers no results; an id it does not hold answers
 * **unreachable**, as a TMDB that has gone away would.
 */
export interface TmdbScript {
  /** `searchMovie`'s results, by the title it is sent. */
  searches?: Readonly<Record<string, readonly TmdbMovieResult[]>>;
  /** `movie`'s details, found by id. */
  movies?: readonly TmdbMovieDetail[];
  /** `searchTv`'s results, by the title it is sent. */
  tvSearches?: Readonly<Record<string, readonly TmdbTvResult[]>>;
  /** `tv`'s details, found by id. */
  shows?: readonly TmdbTvDetail[];
  /** `season`'s answers: a show's id, then the season number. */
  seasons?: Readonly<Record<number, Readonly<Record<number, TmdbSeason>>>>;
  /** What `reachable` answers; `true` unless the suite says otherwise. */
  reachable?: boolean;
  /** What `authenticate` answers; `accepted` unless the suite says otherwise. */
  authenticate?: TmdbAuthOutcome;
  /** Told of every call, as it is made — before it is answered. */
  onCall?: (call: TmdbCall) => void;
}

/** One question the fake was asked. */
export interface TmdbCall {
  method: keyof TmdbClient;
  args: readonly unknown[];
}

/** A call held in flight until the suite lets it go. */
export interface HeldTmdbCall<T> {
  /** Resolves once the held call has been made and is waiting. */
  reached: Promise<void>;
  /** Answers the held call: with `outcome`, or with the table's own answer. */
  release: (outcome?: TmdbOutcome<T>) => void;
}

type Answer<M extends keyof TmdbClient> =
  Awaited<ReturnType<TmdbClient[M]>> extends TmdbOutcome<infer T> ? T : never;

/** The scripted client: every method a `vi.fn`, so a suite can still read its calls. */
export type FakeTmdb = { [M in keyof TmdbClient]: Mock<TmdbClient[M]> } & {
  /** Every call in the order it was made, across all methods. */
  readonly calls: readonly TmdbCall[];
  /** Hold the `nth` call to `method` (the next one by default) until released. */
  hold<M extends Exclude<keyof TmdbClient, 'authenticate' | 'reachable'>>(
    method: M,
    nth?: number
  ): HeldTmdbCall<Answer<M>>;
  /** Answer the `nth` call to `method` with `kind` instead of the table. */
  fail(
    method: Exclude<keyof TmdbClient, 'authenticate' | 'reachable'>,
    nth: number,
    kind: 'refused' | 'unreachable'
  ): void;
};

/** The bytes the fake's image stream yields for a TMDB image path. */
export const tmdbImageBytes = (path: string): string =>
  `image bytes of ${path}`;

const ok = <T>(value: T): TmdbOutcome<T> => ({ kind: 'ok', value });
const unreachable = { kind: 'unreachable' } as const;

/**
 * A scripted TMDB client for the suites that drive the `enrichment/` domain:
 * each question answered from the table the suite hands in, every call
 * recorded in order, and any one call held until released — for the Stop
 * leaves, as `heldCopy` holds a copy — or failed in place.
 *
 * `offlineTmdb` is the other double: one line, for suites composing the router
 * for something else. A test double's neighbour rather than backend logic —
 * nothing that ships imports it.
 */
export function fakeTmdb(script: TmdbScript = {}): FakeTmdb {
  const calls: TmdbCall[] = [];
  const counts = new Map<keyof TmdbClient, number>();
  const holds: {
    method: keyof TmdbClient;
    nth: number;
    arrive: () => void;
    gate: Promise<TmdbOutcome<unknown> | undefined>;
  }[] = [];
  const failures: {
    method: keyof TmdbClient;
    nth: number;
    kind: 'refused' | 'unreachable';
  }[] = [];

  /** Record the call, then answer it — failed, held, or off the table. */
  function answer<T>(
    method: keyof TmdbClient,
    args: readonly unknown[],
    scripted: () => TmdbOutcome<T>
  ): Promise<TmdbOutcome<T>> {
    const call = { method, args };
    calls.push(call);
    script.onCall?.(call);
    const nth = (counts.get(method) ?? 0) + 1;
    counts.set(method, nth);

    const failure = failures.find(
      (each) => each.method === method && each.nth === nth
    );
    if (failure !== undefined) return Promise.resolve({ kind: failure.kind });
    const held = holds.find(
      (each) => each.method === method && each.nth === nth
    );
    if (held === undefined) return Promise.resolve(scripted());
    held.arrive();
    return held.gate.then(
      (outcome) => (outcome as TmdbOutcome<T> | undefined) ?? scripted()
    );
  }

  const fake = {
    calls,
    authenticate: vi.fn<TmdbClient['authenticate']>((...args) => {
      const call = { method: 'authenticate' as const, args };
      calls.push(call);
      script.onCall?.(call);
      return Promise.resolve(script.authenticate ?? 'accepted');
    }),
    reachable: vi.fn<TmdbClient['reachable']>(() => {
      const call = { method: 'reachable' as const, args: [] };
      calls.push(call);
      script.onCall?.(call);
      return Promise.resolve(script.reachable ?? true);
    }),
    searchMovie: vi.fn<TmdbClient['searchMovie']>((...args) =>
      answer('searchMovie', args, () =>
        ok([...(script.searches?.[args[1]] ?? [])])
      )
    ),
    movie: vi.fn<TmdbClient['movie']>((...args) =>
      answer('movie', args, () => {
        const found = script.movies?.find((each) => each.id === args[1]);
        return found === undefined ? unreachable : ok(found);
      })
    ),
    searchTv: vi.fn<TmdbClient['searchTv']>((...args) =>
      answer('searchTv', args, () =>
        ok([...(script.tvSearches?.[args[1]] ?? [])])
      )
    ),
    tv: vi.fn<TmdbClient['tv']>((...args) =>
      answer('tv', args, () => {
        const found = script.shows?.find((each) => each.id === args[1]);
        return found === undefined ? unreachable : ok(found);
      })
    ),
    season: vi.fn<TmdbClient['season']>((...args) =>
      answer('season', args, () => {
        const found = script.seasons?.[args[1]]?.[args[2]];
        return found === undefined ? unreachable : ok(found);
      })
    ),
    image: vi.fn<TmdbClient['image']>((...args) =>
      answer('image', args, () =>
        ok(Readable.from([Buffer.from(tmdbImageBytes(args[0]))]))
      )
    ),
    hold(method, nth = (counts.get(method) ?? 0) + 1) {
      let arrive: () => void = () => undefined;
      const reached = new Promise<void>((resolve) => {
        arrive = resolve;
      });
      let release: (outcome?: TmdbOutcome<unknown>) => void = () => undefined;
      const gate = new Promise<TmdbOutcome<unknown> | undefined>((resolve) => {
        release = resolve;
      });
      holds.push({ method, nth, arrive, gate });
      return { reached, release: (outcome) => release(outcome) };
    },
    fail(method, nth, kind) {
      failures.push({ method, nth, kind });
    },
  } satisfies FakeTmdb;
  return fake;
}

/** One `/3/search/movie` result: a June release in Drama, English, a poster. */
export function tmdbMovieResult(
  id: number,
  title: string,
  year: number,
  overrides: Partial<TmdbMovieResult> = {}
): TmdbMovieResult {
  return {
    id,
    title,
    original_title: title,
    release_date: `${year}-06-14`,
    genre_ids: [18],
    original_language: 'en',
    poster_path: `/poster-${id}.jpg`,
    vote_average: 7.1,
    ...overrides,
  };
}

/** One `/3/movie/{id}` with credits: a lead, a director, both images. */
export function tmdbMovieDetail(
  id: number,
  title: string,
  year: number,
  overrides: Partial<TmdbMovieDetail> = {}
): TmdbMovieDetail {
  return {
    id,
    title,
    original_title: title,
    overview: `The ${year} ${title}.`,
    release_date: `${year}-06-14`,
    runtime: 98,
    genres: [{ id: 18, name: 'Drama' }],
    vote_average: 7.1,
    poster_path: `/poster-${id}.jpg`,
    backdrop_path: `/backdrop-${id}.jpg`,
    credits: {
      cast: [{ name: `Lead of ${id}`, order: 0 }],
      crew: [{ name: `Director of ${id}`, job: 'Director' }],
    },
    ...overrides,
  };
}

/** One `/3/tv/{id}` with credits: a creator, a lead, both images, still airing. */
export function tmdbTvDetail(
  id: number,
  name: string,
  firstYear: number,
  overrides: Partial<TmdbTvDetail> = {}
): TmdbTvDetail {
  return {
    id,
    name,
    original_name: name,
    overview: `The ${firstYear} ${name}.`,
    first_air_date: `${firstYear}-09-02`,
    last_air_date: null,
    genres: [{ id: 18, name: 'Drama' }],
    vote_average: 7.1,
    poster_path: `/poster-${id}.jpg`,
    backdrop_path: `/backdrop-${id}.jpg`,
    created_by: [{ name: `Creator of ${id}` }],
    credits: {
      cast: [{ name: `Lead of ${id}`, order: 0 }],
      crew: [],
    },
    ...overrides,
  };
}

/** One `/3/tv/{id}/season/{n}`: the episodes given, in the order given. */
export function tmdbSeason(
  seasonNumber: number,
  episodes: TmdbSeason['episodes']
): TmdbSeason {
  return { season_number: seasonNumber, episodes };
}

/** The Current enrichment run, once it has reached review. */
export async function reviewed(enrichment: {
  current(): EnrichmentRun | null;
}): Promise<EnrichmentRun> {
  await vi.waitFor(() => {
    expect(enrichment.current()?.phase).toBe('review');
  });
  const run = enrichment.current();
  if (run === null) throw new Error('no Current enrichment run');
  return run;
}
