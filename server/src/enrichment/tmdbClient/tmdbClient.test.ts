// @vitest-environment node
//
// 23 — Enrichment, Phase 1: "the TMDB key" (issue #203).
//
// `tmdbClient` — the injected seam of the fifth server domain,
// `enrichment/`: `createTmdbClient(fetch, { timeoutMs })`, built over an
// injected `fetch` so nothing in this suite goes online. This slice asks one
// thing of it, `authenticate(key)`: TMDB's `/3/authentication` with the key
// sent the way its shape says — a v3 key as `api_key`, a v4 token as
// `Authorization: Bearer` — answering **accepted**, **refused** (`401`) or
// **unreachable** (a network error, or no answer within the timeout) as
// values. It never throws.

import { describe, expect, it, vi } from 'vitest';

import { createTmdbClient } from './tmdbClient';

const V3_KEY = '0123456789abcdef0123456789abcdef';
const V4_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIwMTIzNDU2Nzg5YWJjZGVmIiwic2NvcGVzIjpbImFwaV9yZWFkIl19.Zm9vYmFyYmF6cXV4LXNpZ25hdHVyZQ';

type Fetch = typeof fetch;

/** A `Response` by status, the only fields a client reads. */
function answer(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A fake `fetch` answering every request with `status`. */
function answering(status: number) {
  return vi.fn<Fetch>(() =>
    Promise.resolve(
      answer(
        status,
        status === 200
          ? { success: true, status_code: 1 }
          : { success: false, status_code: 7 }
      )
    )
  );
}

/** The URL and headers of the one request a fake saw. */
function onlyRequest(fetchMock: ReturnType<typeof vi.fn<Fetch>>) {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [input, init] = fetchMock.mock.calls[0];
  const url = new URL(input instanceof Request ? input.url : String(input));
  const headers = new Headers(
    input instanceof Request ? input.headers : init?.headers
  );
  return { url, headers };
}

describe('tmdbClient: authenticate — how the key is sent', () => {
  it("asks TMDB's /3/authentication", async () => {
    const fetchMock = answering(200);

    await createTmdbClient(fetchMock).authenticate(V3_KEY);

    const { url } = onlyRequest(fetchMock);
    expect(url.origin).toBe('https://api.themoviedb.org');
    expect(url.pathname).toBe('/3/authentication');
  });

  it('sends a v3 key as the api_key query parameter, and no Bearer header', async () => {
    const fetchMock = answering(200);

    await createTmdbClient(fetchMock).authenticate(V3_KEY);

    const { url, headers } = onlyRequest(fetchMock);
    expect(url.searchParams.get('api_key')).toBe(V3_KEY);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('sends a v4 token as Authorization: Bearer, and no api_key', async () => {
    const fetchMock = answering(200);

    await createTmdbClient(fetchMock).authenticate(V4_TOKEN);

    const { url, headers } = onlyRequest(fetchMock);
    expect(headers.get('Authorization')).toBe(`Bearer ${V4_TOKEN}`);
    expect(url.searchParams.has('api_key')).toBe(false);
  });
});

describe('tmdbClient: authenticate — the three answers, as values', () => {
  it('answers accepted when TMDB says 200', async () => {
    const outcome = await createTmdbClient(answering(200)).authenticate(V3_KEY);

    expect(outcome).toBe('accepted');
  });

  it('answers refused when TMDB says 401', async () => {
    const outcome = await createTmdbClient(answering(401)).authenticate(V3_KEY);

    expect(outcome).toBe('refused');
  });

  it('answers refused for a v4 token TMDB says 401 to', async () => {
    const outcome = await createTmdbClient(answering(401)).authenticate(
      V4_TOKEN
    );

    expect(outcome).toBe('refused');
  });

  it('answers unreachable when the network fails, rather than throwing', async () => {
    const fetchMock = vi.fn<Fetch>(() =>
      Promise.reject(new TypeError('fetch failed'))
    );

    const outcome = await createTmdbClient(fetchMock).authenticate(V3_KEY);

    expect(outcome).toBe('unreachable');
  });

  it('answers unreachable when TMDB does not answer within the timeout', async () => {
    // A request that never answers on its own — only the client giving up
    // ends it, by aborting the signal it passed or by not waiting any longer.
    const fetchMock = vi.fn<Fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          );
        })
    );

    const outcome = await createTmdbClient(fetchMock, {
      timeoutMs: 20,
    }).authenticate(V3_KEY);

    expect(outcome).toBe('unreachable');
  });
});

// 23 — Enrichment, Phase 2: "the tracer — Just this movie" (issue #204).
//
// The client learns what a Sync asks of TMDB for one movie: `searchMovie(key,
// title, year)` → `/3/search/movie`, `movie(key, id)` → `/3/movie/{id}` with
// `append_to_response=credits`, and `image(path)` → the image's bytes as a
// stream. Each answers `{ kind: 'ok', value }`, or **refused** / **unreachable**
// as values — never a throw. Every API request asks for `en-US`: the answers
// are fixed to one language, whatever machine asks.

/** A fake `fetch` answering every request with `body` under `status`. */
function answeringWith(body: unknown, status = 200) {
  return vi.fn<Fetch>(() => Promise.resolve(answer(status, body)));
}

const SEARCH_BODY = {
  page: 1,
  total_results: 1,
  results: [
    {
      id: 550123,
      title: 'The Lantern Keeper',
      original_title: 'Le Gardien du phare',
      release_date: '2019-06-14',
      genre_ids: [18],
      original_language: 'fr',
      poster_path: '/lantern-poster.jpg',
      vote_average: 7.4,
    },
  ],
};

const MOVIE_BODY = {
  id: 550123,
  title: 'The Lantern Keeper',
  original_title: 'Le Gardien du phare',
  overview: 'A keeper tends a light nobody needs any more.',
  release_date: '2019-06-14',
  runtime: 112,
  genres: [{ id: 18, name: 'Drama' }],
  vote_average: 7.456,
  poster_path: '/lantern-poster.jpg',
  backdrop_path: '/lantern-backdrop.jpg',
  credits: {
    cast: [{ name: 'Ada Brennan', order: 0 }],
    crew: [{ name: 'Paul Verhoek', job: 'Director' }],
  },
};

describe('tmdbClient: searchMovie', () => {
  it('asks /3/search/movie for the title and its year, in en-US', async () => {
    const fetchMock = answeringWith(SEARCH_BODY);

    await createTmdbClient(fetchMock).searchMovie(
      V3_KEY,
      'The Lantern Keeper',
      2019
    );

    const { url } = onlyRequest(fetchMock);
    expect(url.origin).toBe('https://api.themoviedb.org');
    expect(url.pathname).toBe('/3/search/movie');
    expect(url.searchParams.get('query')).toBe('The Lantern Keeper');
    expect(url.searchParams.get('year')).toBe('2019');
    expect(url.searchParams.get('language')).toBe('en-US');
  });

  it('sends no year for a title that has none', async () => {
    const fetchMock = answeringWith(SEARCH_BODY);

    await createTmdbClient(fetchMock).searchMovie(V3_KEY, 'Northwind', null);

    const { url } = onlyRequest(fetchMock);
    expect(url.searchParams.has('year')).toBe(false);
    expect(url.searchParams.get('language')).toBe('en-US');
  });

  it('sends the key the way its shape says', async () => {
    const fetchMock = answeringWith(SEARCH_BODY);

    await createTmdbClient(fetchMock).searchMovie(V4_TOKEN, 'Northwind', null);

    const { headers } = onlyRequest(fetchMock);
    expect(headers.get('Authorization')).toBe(`Bearer ${V4_TOKEN}`);
  });

  it('answers the results', async () => {
    const outcome = await createTmdbClient(
      answeringWith(SEARCH_BODY)
    ).searchMovie(V3_KEY, 'The Lantern Keeper', 2019);

    expect(outcome).toEqual({ kind: 'ok', value: SEARCH_BODY.results });
  });

  it('answers refused on a 401, and unreachable when the network fails', async () => {
    const refused = await createTmdbClient(
      answeringWith({ status_code: 7 }, 401)
    ).searchMovie(V3_KEY, 'Northwind', null);
    const unreachable = await createTmdbClient(
      vi.fn<Fetch>(() => Promise.reject(new TypeError('fetch failed')))
    ).searchMovie(V3_KEY, 'Northwind', null);

    expect(refused).toEqual({ kind: 'refused' });
    expect(unreachable).toEqual({ kind: 'unreachable' });
  });
});

describe('tmdbClient: movie — the detail with its credits', () => {
  it('asks /3/movie/{id} with its credits appended, in en-US', async () => {
    const fetchMock = answeringWith(MOVIE_BODY);

    await createTmdbClient(fetchMock).movie(V3_KEY, 550123);

    const { url } = onlyRequest(fetchMock);
    expect(url.origin).toBe('https://api.themoviedb.org');
    expect(url.pathname).toBe('/3/movie/550123');
    expect(url.searchParams.get('append_to_response')).toBe('credits');
    expect(url.searchParams.get('language')).toBe('en-US');
    expect(url.searchParams.get('api_key')).toBe(V3_KEY);
  });

  it('answers the detail', async () => {
    const outcome = await createTmdbClient(answeringWith(MOVIE_BODY)).movie(
      V3_KEY,
      550123
    );

    expect(outcome).toEqual({ kind: 'ok', value: MOVIE_BODY });
  });

  it('answers refused on a 401, and unreachable when the network fails', async () => {
    const refused = await createTmdbClient(
      answeringWith({ status_code: 7 }, 401)
    ).movie(V3_KEY, 550123);
    const unreachable = await createTmdbClient(
      vi.fn<Fetch>(() => Promise.reject(new TypeError('fetch failed')))
    ).movie(V3_KEY, 550123);

    expect(refused).toEqual({ kind: 'refused' });
    expect(unreachable).toEqual({ kind: 'unreachable' });
  });
});

describe('tmdbClient: image — the bytes as a stream', () => {
  /** Everything a Node stream yields, as one buffer. */
  async function drain(stream: AsyncIterable<unknown>): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }

  it('asks image.tmdb.org for the path', async () => {
    const fetchMock = vi.fn<Fetch>(() =>
      Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    );

    await createTmdbClient(fetchMock).image('/lantern-poster.jpg');

    const { url } = onlyRequest(fetchMock);
    expect(url.origin).toBe('https://image.tmdb.org');
    expect(url.pathname.endsWith('/lantern-poster.jpg')).toBe(true);
  });

  it('answers the image’s bytes as a stream', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 7, 7, 7]);
    const fetchMock = vi.fn<Fetch>(() =>
      Promise.resolve(new Response(bytes, { status: 200 }))
    );

    const outcome = await createTmdbClient(fetchMock).image(
      '/lantern-poster.jpg'
    );

    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    expect(await drain(outcome.value)).toEqual(Buffer.from(bytes));
  });

  it('answers unreachable when the network fails, rather than throwing', async () => {
    const outcome = await createTmdbClient(
      vi.fn<Fetch>(() => Promise.reject(new TypeError('fetch failed')))
    ).image('/lantern-poster.jpg');

    expect(outcome).toEqual({ kind: 'unreachable' });
  });
});

// 23 — Enrichment, Phase 3 (issue #205): _Stop_ aborts the requests in flight.
// `searchMovie`, `movie` and `image` each take an optional `AbortSignal` last;
// aborting it aborts the request the client sent, and the call still answers
// a value rather than throwing.
describe('tmdbClient: a caller’s signal aborts the request in flight', () => {
  /** A `fetch` that never answers until its own signal aborts it. */
  function hanging() {
    return vi.fn<Fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
    );
  }

  /** The signal the client handed its `fetch`. */
  const sentSignal = (fetchMock: ReturnType<typeof vi.fn<Fetch>>) =>
    fetchMock.mock.calls[0]?.[1]?.signal;

  it('aborts a search', async () => {
    const fetchMock = hanging();
    const controller = new AbortController();

    const outcome = createTmdbClient(fetchMock).searchMovie(
      V3_KEY,
      'Northwind',
      null,
      controller.signal
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();

    expect(sentSignal(fetchMock)?.aborted).toBe(true);
    await expect(outcome).resolves.toEqual({ kind: 'unreachable' });
  });

  it('aborts a detail read', async () => {
    const fetchMock = hanging();
    const controller = new AbortController();

    const outcome = createTmdbClient(fetchMock).movie(
      V3_KEY,
      550123,
      controller.signal
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();

    expect(sentSignal(fetchMock)?.aborted).toBe(true);
    await expect(outcome).resolves.toEqual({ kind: 'unreachable' });
  });

  it('aborts an image', async () => {
    const fetchMock = hanging();
    const controller = new AbortController();

    const outcome = createTmdbClient(fetchMock).image(
      '/lantern-poster.jpg',
      controller.signal
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();

    expect(sentSignal(fetchMock)?.aborted).toBe(true);
    await expect(outcome).resolves.toEqual({ kind: 'unreachable' });
  });
});
